"""Agent construction, tool execution and conversation state."""
import json
import time
import httpx
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from langchain_ollama import ChatOllama
from weather_agent.config import Settings
from weather_agent.prompts import SYSTEM_PROMPT
from weather_agent.tools.weather import WEATHER_TOOLS

TOOLS = {t.name: t for t in WEATHER_TOOLS}


def run_turn(model, history, question, on_event=None, cancelled=None, max_rounds=10, deadline=None,
             require_weather_evidence=False):
    """完整完成一轮后才提交会话，避免失败后留下未配对工具消息。"""
    messages = [*history, HumanMessage(content=question)]
    emit = on_event or (lambda event: None)
    has_weather = False
    evidence_retry = False
    for round_index in range(max_rounds):
        if cancelled and cancelled.is_set():
            raise RuntimeError('请求已取消')
        if deadline and time.monotonic() > deadline:
            raise RuntimeError('问询已达到时间上限，请缩小问题范围后重试')
        emit({'type': 'model', 'round': round_index + 1, 'message': '模型正在思考并选择工具'})
        response = model.invoke(messages)
        messages.append(response)
        if response.invalid_tool_calls:
            raise RuntimeError('模型工具参数无效，请重新提问或更换支持工具调用的模型。')
        if not response.tool_calls:
            if require_weather_evidence and not has_weather:
                if not evidence_retry:
                    evidence_retry = True
                    messages.append(HumanMessage(content='校验提示：本轮尚未取得天气数据。城市搜索不是天气查询。请先调用 get_weather 获取数据；如果城市不明确则询问地区，禁止编造温度或预报。'))
                    emit({'type': 'model', 'round': round_index + 1, 'message': '尚无天气数据，正在要求模型补查；不会展示未经查询的天气结论'})
                    continue
                return '尚未取得有效天气数据，不能提供天气结论。请明确城市及省份后重试，例如“江苏南京今天的天气”。', messages
            return response.text, messages
        for call in response.tool_calls:
            if cancelled and cancelled.is_set():
                raise RuntimeError('请求已取消')
            emit({'type': 'tool_start', 'name': call['name'], 'args': call['args']})
            try:
                selected = TOOLS.get(call['name'])
                result = selected.invoke(call['args']) if selected else {'error': '未知工具'}
            except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
                result = {'error': f'查询失败：{type(exc).__name__}: {exc}'}
            messages.append(ToolMessage(content=json.dumps(result, ensure_ascii=False), tool_call_id=call['id']))
            if call['name'] == 'get_weather' and 'current' in result and 'daily' in result and 'error' not in result:
                has_weather = True
            emit({'type': 'tool_end', 'name': call['name'], 'result': result})
    raise RuntimeError('工具调用次数达到上限，请缩小问题范围后重试。')



def create_model(settings=None):
    settings = settings or Settings.from_env()
    return ChatOllama(model=settings.model, base_url=settings.base_url,
        num_ctx=settings.num_ctx, reasoning=settings.reasoning, temperature=0,
        client_kwargs={'timeout': settings.timeout}).bind_tools(list(WEATHER_TOOLS))


class WeatherAgent:
    """One instance owns one conversation; reusable across entry points."""

    def __init__(self, model=None):
        self.model = model if model is not None else create_model()
        self.history = [SystemMessage(content=SYSTEM_PROMPT)]

    def chat(self, question: str) -> str:
        answer, history = run_turn(self.model, self.history, question)
        self.history = history
        return answer
