import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch, Mock
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage
import portal


class PortalTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.patches = [patch.object(portal,'DATA',root),patch.object(portal,'DB',root/'test.db')]
        for p in self.patches:
            p.start()
        portal.init_db()
        self.client = TestClient(portal.app)

    def tearDown(self):
        self.client.close()
        for p in reversed(self.patches):
            p.stop()
        self.temp.cleanup()

    def test_rules_validation_and_persistence(self):
        self.assertEqual(self.client.put('/api/rules',json={'temperature':35,'rain':101,'wind':40}).status_code,422)
        rules={'temperature':30,'rain':60,'wind':35}
        self.assertEqual(self.client.put('/api/rules',json=rules).status_code,200)
        self.assertEqual(self.client.get('/api/dashboard').json()['rules'],rules)

    def test_city_add_deduplicate_and_remove(self):
        data={'name':'杭州','latitude':30.25,'longitude':120.16}
        with patch.object(portal,'refresh_city'):
            first=self.client.post('/api/cities',json=data).json()['id']
            second=self.client.post('/api/cities',json=data).json()['id']
        self.assertEqual(first,second)
        self.assertEqual(len(self.client.get('/api/dashboard').json()['cities']),4)
        self.client.delete('/api/cities/'+first)
        self.assertEqual(len(self.client.get('/api/dashboard').json()['cities']),3)

    def test_agent_stream_exposes_tool_execution(self):
        model=Mock()
        model.invoke.side_effect=[
            AIMessage(content='',tool_calls=[{'name':'search_locations','args':{'city':'南京'},'id':'tool1'}]),
            AIMessage(content='',tool_calls=[{'name':'get_weather','args':{'latitude':32,'longitude':118},'id':'tool2'}]),
            AIMessage(content='测试回答')]
        tools={'search_locations':Mock(),'get_weather':Mock()}
        tools['search_locations'].invoke.return_value={'locations':[{'latitude':32,'longitude':118}]}
        tools['get_weather'].invoke.return_value={'current':{'temperature_2m':15},'daily':[{}]}
        with patch.object(portal,'create_model',return_value=model),patch('weather_agent.agent.TOOLS',tools):
            response=self.client.post('/api/chat',json={'question':'南京天气','thinking':False})
        events=[json.loads(line[6:]) for line in response.text.splitlines() if line.startswith('data: ')]
        self.assertEqual([e['type'] for e in events],['session','model','tool_start','tool_end','model','tool_start','tool_end','model','answer','done'])
        self.assertEqual(events[-2]['text'],'测试回答')

    def test_busy_and_blank_requests(self):
        self.assertEqual(self.client.post('/api/chat',json={'question':' '}).status_code,422)
        portal.gpu_lock.acquire()
        try:
            self.assertEqual(self.client.post('/api/chat',json={'question':'天气'}).status_code,429)
        finally:
            portal.gpu_lock.release()

    def test_failed_refresh_preserves_old_data_and_marks_error(self):
        with portal.database() as db:
            city=dict(db.execute('SELECT * FROM cities LIMIT 1').fetchone())
            db.execute('UPDATE cities SET weather=? WHERE id=?',(json.dumps({'current':{},'daily':[{}]}),city['id']))
        with patch.object(portal,'get_weather',side_effect=TimeoutError()):
            portal.refresh_city(city)
        result=self.client.get('/api/dashboard').json()
        updated=next(c for c in result['cities'] if c['id']==city['id'])
        self.assertTrue(updated['stale'])
        self.assertTrue(updated['error'])
        self.assertIsNotNone(updated['weather'])

    def test_no_weather_evidence_never_releases_model_claims(self):
        from weather_agent.agent import run_turn
        model=Mock()
        model.invoke.return_value=AIMessage(content='今天23度，晴天')
        answer,_=run_turn(model,[],'南京天气',require_weather_evidence=True)
        self.assertNotIn('23',answer)
        self.assertIn('尚未取得',answer)
        self.assertEqual(model.invoke.call_count,2)
