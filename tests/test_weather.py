import unittest
from unittest.mock import Mock, patch
import httpx
from langchain_core.messages import AIMessage, SystemMessage, ToolMessage
from weather_agent.agent import run_turn
from weather_agent.tools.weather import search_locations, get_weather


class WeatherTests(unittest.TestCase):
    def test_empty_location(self):
        with patch('weather_agent.services.open_meteo.request_json', return_value={}):
            self.assertEqual(search_locations.invoke({'city': '不存在'})['locations'], [])

    def test_invalid_days_and_coordinates(self):
        with patch('weather_agent.services.open_meteo.request_json') as request:
            for args in ({'latitude': 91, 'longitude': 0}, {'latitude': 0, 'longitude': 0, 'days': 8}):
                self.assertIn('error', get_weather.invoke(args))
            request.assert_not_called()

    def test_forecast_keeps_null_and_units(self):
        data = {'timezone': 'Asia/Shanghai', 'current': {'weather_code': 0},
                'current_units': {'temperature_2m': '°C'}, 'daily_units': {},
                'daily': {'time': ['2026-11-16'], 'weather_code': [61], 'temperature_2m_max': [None]}}
        with patch('weather_agent.services.open_meteo.request_json', return_value=data):
            result = get_weather.invoke({'latitude': 40, 'longitude': 116, 'days': 1})
        self.assertEqual(result['daily'][0]['description'], '小雨')
        self.assertIsNone(result['daily'][0]['temperature_2m_max'])

    def test_tool_failure_returned_to_model_and_history_unchanged(self):
        model = Mock()
        model.invoke.side_effect = [AIMessage(content='', tool_calls=[
            {'name': 'search_locations', 'args': {'city': '北京'}, 'id': 'call1'}]),
            AIMessage(content='查询失败，请稍后重试。')]
        history = [SystemMessage(content='test')]
        with patch('weather_agent.services.open_meteo.request_json', side_effect=httpx.ConnectError('offline')):
            answer, messages = run_turn(model, history, '北京天气')
        self.assertEqual(len(history), 1)
        self.assertIsInstance(messages[-2], ToolMessage)
        self.assertIn('查询失败', messages[-2].content)
        self.assertIn('查询失败', answer)

    def test_loop_is_bounded(self):
        model = Mock()
        model.invoke.return_value = AIMessage(content='', tool_calls=[
            {'name': 'unknown', 'args': {}, 'id': 'call1'}])
        with self.assertRaises(RuntimeError):
            run_turn(model, [], '天气')
        self.assertEqual(model.invoke.call_count, 10)


if __name__ == '__main__':
    unittest.main()
