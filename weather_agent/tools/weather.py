"""将天气服务暴露为模型可调用的 LangChain 工具。"""
from langchain_core.tools import tool
from weather_agent.services import open_meteo


@tool
def search_locations(city: str, country_code: str = '') -> dict:
    """搜索城市坐标并返回候选地点。city 可用中文或英文；country_code 为可选两位国家代码，如 CN。同名地点需确认地区。"""
    return open_meteo.search_locations(city, country_code)


@tool
def get_weather(latitude: float, longitude: float, days: int = 3) -> dict:
    """使用城市搜索返回的经纬度查询当前天气及当地今天开始的预报。days 含今天，范围1到7；查询明天至少需要2天。温度摄氏度，风速km/h。"""
    return open_meteo.get_weather(latitude, longitude, days)


WEATHER_TOOLS = (search_locations, get_weather)
