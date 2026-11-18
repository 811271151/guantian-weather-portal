# 配合漫画海报理解架构与准备面试

海报：`artifacts/weather-agent-architecture-comic.png`。

## 一分钟项目介绍

我开发了一套本地天气监控与智能问询平台。前端采用 React、TypeScript、Tailwind 和 Vite；后端用 FastAPI 提供业务接口，并用 SQLite 保存城市、规则和最新天气快照。

平台有两条业务链路。天气看板直接由后端请求 Open-Meteo，不经过大模型。自然语言问询则进入 Agent：借助 LangChain 的模型适配、工具定义和消息类型，由 Python 显式循环协调模型与工具。Ollama 在本机加载并运行 Qwen3.5:9B，模型提出工具名称和参数，Python 后端实际执行天气查询，将结果作为 ToolMessage 交回模型，再生成回答。

页面通过 SSE 接收执行过程和最终答案，并将 Markdown 渲染成表格、列表等客户端内容。当前不是逐 token 显示最终回答。为了适应8GB显存，我对网页问询使用8192上下文、单问询并发和轮次预算，并拦截没有天气工具成功结果的天气结论。

## 代码对照

| 环节 | 位置 | 实际做的事情 |
| --- | --- | --- |
| 界面 | frontend/src/components/ChatPanel.tsx | 收集输入，展示消息和工具记录 |
| 前端状态 | frontend/src/hooks/useChat.ts | 管理会话、thinking、取消与问询状态 |
| HTTP/SSE | frontend/src/lib/api.ts | 发起POST请求，读取事件流 |
| 业务接口 | portal.py /api/chat | 接收问题，控制并发，创建Agent并返回SSE |
| 模型创建 | weather_agent/agent.py create_model | ChatOllama连接Ollama，bind_tools提供工具描述 |
| Agent循环 | weather_agent/agent.py run_turn | 调用模型，检查tool_calls，执行函数，回传ToolMessage |
| 工具定义 | weather_agent/tools/weather.py | 用@tool定义城市搜索及天气查询 |
| 外部数据 | weather_agent/services/open_meteo.py | 真正发送天气HTTP请求、整理单位和预报 |
| 本地推理 | Ollama进程 / 11434 | 加载Qwen权重，使用GPU/CPU推理 |
| 看板/规则 | portal.py /api/dashboard等 | 天气快照、阈值计算、SQLite持久化 |

## 如何按海报讲一次完整问询

1. 浏览器提交“江苏南京明天会下雨吗”，携带会话ID及thinking设置。
2. FastAPI接收请求，找到会话历史，将问题交给Agent。
3. LangChain的ChatOllama把消息和工具描述发送到Ollama。Ollama让Qwen推理，返回结构化工具调用；发送的是工具名称、参数结构和说明，不是让模型直接运行Python源码。
4. Python循环解析search_locations调用并执行，取得南京坐标。工具返回值通过ToolMessage再次传给模型。
5. 模型提出get_weather调用，后端用坐标和天数请求Open-Meteo。明天的预报至少需包含今天和明天两天。
6. 后端把天气结果再次作为ToolMessage传入模型。模型若需要更多信息可继续调用工具，否则生成回答。
7. 后端通过SSE返回执行事件和最终答案，React安全渲染Markdown。工具结果可展开查看。

## 面试中容易混淆的边界

- 模型是权重及网络，Ollama是运行与服务层；两者不是同一种东西。
- FastAPI提供完整业务接口，Ollama提供模型推理接口。前端通常调用FastAPI，不直接绕过业务后端。
- LangChain是代码框架，不是默认就运行着的独立HTTP服务。本项目使用它的组件，循环是我们自己写的，并未使用create_agent代替循环。
- Agent不是新训练出的模型，而是“模型＋工具＋执行循环＋会话状态”组成的应用。thinking只改变推理行为，不更新权重。
- 工具调用需要程序执行。模型返回JSON工具请求，不代表天气API已经被访问。
- VS Code的Ollama插件和网页Agent共享推理服务，但不自动共享自定义Python工具。
- 天气数据来自外部联网服务；模型推理在本机。不能把整个系统描述为完全离线。
- 监控刷新需要后端运行；只有页面内阈值提醒，不是官方预警或邮件推送。
- 当前版只监听本机，尚无登录及多用户隔离。生产化还需要认证、会话持久化、任务取消与限流、可观测性和更完整的质量评估。

## 启动与开发

保持Ollama运行。在项目目录运行：

```powershell
.\.venv\Scripts\python.exe -m uvicorn portal:app --host 127.0.0.1 --port 8000
```

访问 http://127.0.0.1:8000。此时FastAPI提供已构建好的React页面，不需要额外启动Vite。

修改前端时：进入frontend，执行`corepack pnpm dev`，访问5173端口；/api代理到8000。完成后`corepack pnpm build`，刷新8000页面使用新产物。首次安装用`corepack pnpm install --frozen-lockfile`。
