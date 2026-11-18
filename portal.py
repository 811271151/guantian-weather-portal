"""Local weather portal. Run: python -m uvicorn portal:app --host 127.0.0.1 --port 8000."""
import asyncio
from contextlib import asynccontextmanager, contextmanager
import json
import logging
from pathlib import Path
import queue
import sqlite3
import threading
import time
import uuid

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from weather_agent.agent import create_model, run_turn
from weather_agent.config import Settings
from weather_agent.prompts import SYSTEM_PROMPT
from weather_agent.services.open_meteo import get_weather, search_locations
from langchain_core.messages import SystemMessage

ROOT = Path(__file__).parent
DATA = ROOT / 'data'
DATA.mkdir(exist_ok=True)
DB = DATA / 'weather.sqlite3'
gpu_lock = threading.Lock()
refresh_lock = threading.Lock()
sessions = {}
session_lock = threading.Lock()


@contextmanager
def database():
    con = sqlite3.connect(DB, timeout=20)
    con.row_factory = sqlite3.Row
    try:
        with con:
            yield con
    finally:
        con.close()


def init_db():
    with database() as con:
        con.executescript('''
        CREATE TABLE IF NOT EXISTS cities(id TEXT PRIMARY KEY, name TEXT, region TEXT,
          latitude REAL, longitude REAL, weather TEXT, updated REAL, error TEXT);
        CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY, temperature REAL,
          rain REAL, wind REAL);
        INSERT OR IGNORE INTO settings VALUES(1,35,70,40);
        ''')
        # Seed only once, so removing every city remains a valid choice.
        marker = DATA / '.initialized'
        if not marker.exists():
            for name, region, lat, lon in [('南京','江苏',32.0617,118.7778),('上海','上海',31.2222,121.4581),('北京','北京',39.9075,116.3972)]:
                con.execute('INSERT INTO cities VALUES(?,?,?,?,?,NULL,0,NULL)',
                            (str(uuid.uuid4()),name,region,lat,lon))
            marker.touch()


def refresh_city(city):
    try:
        result = get_weather(city['latitude'], city['longitude'], 7)
        if 'error' in result:
            raise ValueError(result['error'])
        with database() as con:
            con.execute('UPDATE cities SET weather=?,updated=?,error=NULL WHERE id=?',
                        (json.dumps(result,ensure_ascii=False),time.time(),city['id']))
    except Exception as exc:
        with database() as con:
            con.execute('UPDATE cities SET error=? WHERE id=?',(f'天气数据更新失败：{type(exc).__name__}',city['id']))


def refresh_all():
    if not refresh_lock.acquire(blocking=False):
        return
    try:
        with database() as con:
            cities = [dict(r) for r in con.execute('SELECT * FROM cities')]
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(refresh_city,cities))
    finally:
        refresh_lock.release()


@asynccontextmanager
async def lifespan(app):
    init_db()
    async def monitor():
        while True:
            await asyncio.to_thread(refresh_all)
            await asyncio.sleep(300)
    task = asyncio.create_task(monitor())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title='观天 · 天气监控与问询',lifespan=lifespan)
FRONTEND = ROOT / 'frontend' / 'dist'
app.mount('/assets',StaticFiles(directory=FRONTEND/'assets',check_dir=False),name='assets')


@app.get('/')
def index():
    if not (FRONTEND/'index.html').exists():
        raise HTTPException(503,'请先在 frontend 目录执行 pnpm install 和 pnpm build')
    return FileResponse(FRONTEND/'index.html',headers={'Cache-Control':'no-cache'})


@app.get('/api/health')
def health():
    settings = Settings.from_env()
    result = {'model':settings.model,'ollama':False,'model_ready':False,'busy':gpu_lock.locked()}
    try:
        models = httpx.get(settings.base_url+'/api/tags',timeout=3).raise_for_status().json()['models']
        result.update(ollama=True, model_ready=any(m['name']==settings.model for m in models))
    except Exception:
        pass
    return result


@app.get('/api/dashboard')
def dashboard():
    with database() as con:
        cities = [dict(r) for r in con.execute('SELECT * FROM cities ORDER BY rowid')]
        rules = dict(con.execute('SELECT temperature,rain,wind FROM settings WHERE id=1').fetchone())
    alerts = []
    for city in cities:
        city['weather'] = json.loads(city['weather']) if city['weather'] else None
        city['stale'] = bool(city['error']) or time.time()-city['updated']>900
        if not city['weather'] or city['stale']:
            continue
        forecast = city['weather']['daily'][0]
        for field, limit, title, unit in [
            ('temperature_2m_max',rules['temperature'],'高温','℃'),
            ('precipitation_probability_max',rules['rain'],'降水概率','%'),
            ('wind_speed_10m_max',rules['wind'],'大风','km/h')]:
            value = forecast.get(field)
            if value is not None and value >= limit:
                alerts.append({'city':city['name'],'title':title,'value':value,'unit':unit,'limit':limit})
    return {'cities':cities,'rules':rules,'alerts':alerts,'refreshing':refresh_lock.locked(),'interval':300}


@app.get('/api/locations')
def locations(q: str):
    if not 1 <= len(q.strip()) <= 80:
        raise HTTPException(422,'请输入1到80个字符的城市名')
    try:
        return search_locations(q)
    except Exception:
        raise HTTPException(502,'城市搜索服务暂时不可用，请稍后重试')


class CityInput(BaseModel):
    name: str = Field(min_length=1,max_length=80)
    region: str = Field(default='',max_length=160)
    latitude: float = Field(ge=-90,le=90)
    longitude: float = Field(ge=-180,le=180)


@app.post('/api/cities')
def add_city(city: CityInput):
    with database() as con:
        existing = con.execute('SELECT id FROM cities WHERE ABS(latitude-?)<0.01 AND ABS(longitude-?)<0.01',(city.latitude,city.longitude)).fetchone()
        if existing:
            return {'id':existing['id']}
        if con.execute('SELECT COUNT(*) FROM cities').fetchone()[0]>=12:
            raise HTTPException(422,'最多监控12个城市')
        cid = str(uuid.uuid4())
        con.execute('INSERT INTO cities VALUES(?,?,?,?,?,NULL,0,NULL)',(cid,city.name,city.region,city.latitude,city.longitude))
    refresh_city({'id':cid,**city.model_dump()})
    return {'id':cid}


@app.delete('/api/cities/{cid}')
def delete_city(cid: str):
    with database() as con:
        con.execute('DELETE FROM cities WHERE id=?',(cid,))
    return {'ok':True}


@app.post('/api/refresh')
async def refresh():
    await asyncio.to_thread(refresh_all)
    return {'ok':True}


class Rules(BaseModel):
    temperature: float = Field(ge=-50,le=60)
    rain: float = Field(ge=0,le=100)
    wind: float = Field(ge=0,le=300)


@app.put('/api/rules')
def update_rules(rules: Rules):
    with database() as con:
        con.execute('UPDATE settings SET temperature=?,rain=?,wind=? WHERE id=1',(rules.temperature,rules.rain,rules.wind))
    return {'ok':True}


class Question(BaseModel):
    question: str = Field(min_length=1,max_length=2000)
    session_id: str | None = Field(default=None,max_length=64)
    thinking: bool = True


@app.post('/api/chat')
def chat(body: Question):
    if not body.question.strip():
        raise HTTPException(422,'请输入问题')
    if not gpu_lock.acquire(blocking=False):
        raise HTTPException(429,'模型正在处理另一条问询，请等待完成或取消后重试')
    sid = body.session_id or str(uuid.uuid4())
    with session_lock:
        now = time.time()
        for key in list(sessions):
            if now-sessions[key][0]>3600:
                del sessions[key]
        if sid not in sessions and len(sessions)>=100:
            del sessions[min(sessions,key=lambda k:sessions[k][0])]
        history = sessions.get(sid,(now,[SystemMessage(content=SYSTEM_PROMPT)]))[1]
    events = queue.Queue()
    cancelled = threading.Event()
    def worker():
        try:
            events.put({'type':'session','session_id':sid})
            # Bound context for the 8GB laptop; keep thinking a per-request choice.
            settings = Settings(model=Settings.from_env().model,base_url=Settings.from_env().base_url,
                                num_ctx=8192,timeout=90,reasoning=body.thinking)
            model = create_model(settings)
            answer, messages = run_turn(model,history,body.question,events.put,cancelled,
                                        max_rounds=6,deadline=time.monotonic()+180,
                                        require_weather_evidence=True)
            if not cancelled.is_set():
                # Compact at whole-turn boundaries, never split tool-call pairs.
                retained = messages if len(messages)<40 else [messages[0]]
                with session_lock:
                    sessions[sid] = (time.time(),retained)
                events.put({'type':'answer','text':answer})
        except Exception as exc:
            logging.exception('Weather agent request failed')
            events.put({'type':'error','message':f'问询失败：{type(exc).__name__}。请检查 Ollama、模型及网络；也可关闭思考后重试。'})
        finally:
            events.put({'type':'done'})
            gpu_lock.release()
    threading.Thread(target=worker,daemon=True).start()
    async def stream():
        try:
            while True:
                try:
                    event = events.get_nowait()
                except queue.Empty:
                    yield ': heartbeat\n\n'
                    await asyncio.sleep(0.3)
                    continue
                yield 'data: '+json.dumps(event,ensure_ascii=False)+'\n\n'
                if event['type']=='done':
                    break
        finally:
            cancelled.set()
    return StreamingResponse(stream(),media_type='text/event-stream',headers={'Cache-Control':'no-cache','X-Accel-Buffering':'no'})
