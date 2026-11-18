"""Open-Meteo HTTP client and data conversion."""
import httpx


def request_json(url, params):
    response = httpx.get(url, params=params, timeout=20)
    response.raise_for_status()
    data = response.json()
    if data.get('error'):
        raise ValueError(data.get('reason', '天气服务错误'))
    return data


def search_locations(city: str, country_code: str = '') -> dict:
    """搜索城市坐标，返回候选地点。city 可用中文或英文；country_code 为可选两位国家代码，如 CN。同名地点需确认地区。"""
    if not city.strip():
        return {'error': '请提供城市名'}
    params = {'name': city.strip(), 'count': 5, 'language': 'zh'}
    if country_code:
        params['countryCode'] = country_code.upper()
    data = request_json('https://geocoding-api.open-meteo.com/v1/search', params)
    fields = ('name', 'country', 'admin1', 'admin2', 'latitude', 'longitude', 'timezone')
    return {'locations': [{k: r.get(k) for k in fields} for r in data.get('results', [])],
            'hint': '无结果可尝试英文或拼音名；仍无结果请向用户澄清。'}


WEATHER_CODES = {0: '晴', 1: '大部晴朗', 2: '局部多云', 3: '阴', 45: '雾', 48: '雾凇',
    51: '小毛毛雨', 53: '中毛毛雨', 55: '强毛毛雨', 56: '轻冻毛毛雨', 57: '强冻毛毛雨',
    61: '小雨', 63: '中雨', 65: '大雨', 66: '轻冻雨', 67: '强冻雨', 71: '小雪',
    73: '中雪', 75: '大雪', 77: '米雪', 80: '小阵雨', 81: '中阵雨', 82: '强阵雨',
    85: '小阵雪', 86: '强阵雪', 95: '雷暴', 96: '雷暴伴小冰雹', 99: '雷暴伴大冰雹'}


def get_weather(latitude: float, longitude: float, days: int = 3) -> dict:
    """使用城市搜索返回的经纬度查询当前天气及当地今天开始的预报。days 含今天，范围1到7；查询明天至少需要2天。温度摄氏度，风速km/h。"""
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return {'error': '经纬度无效'}
    if not 1 <= days <= 7:
        return {'error': '仅支持包含今天的未来1到7天'}
    data = request_json('https://api.open-meteo.com/v1/forecast', {
        'latitude': latitude, 'longitude': longitude, 'timezone': 'auto', 'forecast_days': days,
        'current': 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
        'daily': 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max'})
    current = data['current']
    current['description'] = WEATHER_CODES.get(current.get('weather_code'), '未知')
    daily = data['daily']
    forecasts = []
    for i in range(len(daily['time'])):
        row = {key: values[i] for key, values in daily.items()}
        row['description'] = WEATHER_CODES.get(row.get('weather_code'), '未知')
        forecasts.append(row)
    return {'source': 'Open-Meteo (https://open-meteo.com/)', 'timezone': data['timezone'],
            'current': current, 'current_units': data['current_units'],
            'daily': forecasts, 'daily_units': data['daily_units']}
