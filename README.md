# 天气 Agent

Python 3.10+，保留本地 Ollama qwen3.5:9b，通过 LangChain 工具调用实现城市搜索、当前天气、未来7天（含今天）预报及中文多轮问答。

## Web 天气平台

已增加城市监控、七天预报、规则提醒及本地模型问询页面。启动方式与API说明见 [PORTAL.md](PORTAL.md)。

## 运行（PowerShell）

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
ollama pull qwen3.5:9b
# 确保 Ollama 服务启动，必要时在另一个终端运行 ollama serve
.venv\Scripts\python.exe main.py
# 单次查询
.venv\Scripts\python.exe main.py "北京明天会下雨吗？"
```

交互模式可追问“那后天呢？”或“上海呢？”，输入 exit、quit、退出结束。会话仅保存在进程内。

可通过 PowerShell 环境变量配置模型及地址：

```powershell
$env:OLLAMA_MODEL = "qwen3.5:9b"
$env:OLLAMA_BASE_URL = "http://localhost:11434"
```

开发时默认开启 thinking。上线时可在启动进程前关闭：

```powershell
$env:OLLAMA_THINKING = "false"
.venv\Scripts\python.exe main.py
```

重新开启使用 `$env:OLLAMA_THINKING = "true"`，然后重启程序。
思考内容由 ChatOllama 单独存放于 `additional_kwargs['reasoning_content']`，
命令行只显示最终回答。该开关控制推理行为，不会训练或更新模型权重。
VS Code Ollama 插件的 thinking 由其 `ollama.thinkingLevels` 设置独立控制。

更换的模型需支持工具调用。模型每次读取问题，自主选择 search_locations 和 get_weather 工具，再根据结果回答；最多执行10轮工具调用。工具失败会回传错误给模型，失败会话不写入历史。

## 数据与限制

使用 [Open-Meteo 天气 API](https://open-meteo.com/en/docs) 和 [城市搜索 API](https://open-meteo.com/en/docs/geocoding-api)，需要联网，个人非商业使用无需 API Key；商业使用请查看服务商授权及套餐。天气为模型估算和预报，非气象站实测。不支持历史天气。日期以目标城市时区为准。

工具调用参考 [LangChain ChatOllama 文档](https://docs.langchain.com/oss/python/integrations/chat/ollama)。

## 测试

```powershell
.venv\Scripts\python.exe -m unittest discover -s tests -v
```

## 项目结构与职责

```text
main.py                      # 仅启动命令行
weather_agent/
  cli.py                     # 参数解析、输入输出
  config.py                  # Ollama 配置与环境变量
  prompts.py                 # 系统提示词
  agent.py                   # 创建模型、工具调用循环、WeatherAgent 会话
  tools/
    weather.py               # @tool 定义、参数描述、工具集合
  services/
    open_meteo.py             # HTTP 请求、参数校验、数据整理
 tests/
  test_weather.py            # 工具与调用循环测试
```

LangChain 不要求固定目录结构。这里按职责组织：工具是模型能调用的能力，Agent 决定何时调用，service 负责实际访问天气接口。`@tool` 会把函数的名称、参数类型、说明转换成模型可理解的工具描述。

当前 Agent 使用 `ChatOllama.bind_tools()` 和显式循环：模型提出工具调用 → 执行工具 → 将结果作为 ToolMessage 交回模型 → 模型继续调用或回答。不是所有逻辑都属于 tools；会话和循环放在 agent.py。也可以使用 LangChain 的 create_agent 来管理循环，当前项目保留显式实现，方便理解调用过程，且不增加 langchain/langgraph 依赖。

其他 Python 入口可以直接复用会话对象：

```python
from weather_agent.agent import WeatherAgent

agent = WeatherAgent()
print(agent.chat("北京明天的天气怎么样？"))
print(agent.chat("那后天呢？"))
```
