# 观天：本地天气监控与问询平台

## 启动

日常使用时双击项目目录中的 `Start-Portal.cmd`，或在项目目录的 PowerShell 中执行 `.\Start-Portal.cmd`。启动后访问 <http://127.0.0.1:8000>，按 Ctrl+C 停止。启动文件会复用已运行的服务，并在需要时尝试启动默认位置安装的 Ollama。

保持 Ollama 后台运行，在本项目目录执行：

首次安装或修改前端后，先构建 React 前端：

```powershell
cd frontend
corepack pnpm install --frozen-lockfile
corepack pnpm build
cd ..
```

已在 PATH 中启用 pnpm 时可以直接使用 `pnpm`，这里通过 Corepack 调用，无需 npm。
然后启动后端（同一地址提供 React 构建产物及 API）：

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn portal:app --host 127.0.0.1 --port 8000
```

浏览器打开 <http://127.0.0.1:8000>。接口文档：<http://127.0.0.1:8000/docs>。
也可用 `powershell -ExecutionPolicy Bypass -File .\start-portal.ps1` 启动，终端按 Ctrl+C 停止。

## 链路

浏览器 → FastAPI (`portal.py`) → LangChain 工具循环 → Ollama (`11434`) → Qwen。
天气工具请求 Open-Meteo，将结果返回模型，再整理成自然语言答案。
城市看板直接调用天气服务，不调用大模型。原有 `main.py` 命令行入口仍可使用。

## 功能与运行边界

- 默认监控南京、上海、北京；可搜索并管理最多12个城市。
- 服务运行期间每5分钟刷新。规则基于当天最高温、降水概率和最大风速，仅页面内提醒，不是官方气象预警。
- 城市、最近天气快照和规则保存在 `data/weather.sqlite3`。失败保留旧数据并标注，不用过期数据生成新提醒。
- 问询显示模型阶段、工具参数、工具返回数据；最终答案完成后一次返回，不逐字流式展示。
- 网页 thinking 默认开启，按次取消勾选可关闭。网页参数独立于命令行环境变量和 VS Code 插件设置。
- 网页使用8192上下文、最多6轮；每次模型调用90秒读取超时，轮次之间检查180秒预算。
  这不是强制墙钟超时，当前调用和工具请求需要收尾。停止等待会断开页面流，阻止后续步骤，不能保证立刻中断GPU计算。
- 同时只执行一个问询，保护本机显存；看板可并行刷新。
- 会话保留在内存中1小时，服务重启后丢失。长会话在完整轮次结束后清理历史，建议适时新建对话。
- 本轮没有成功的天气工具结果时，后端拦截模型天气结论并要求补查一次；仍失败则明确返回无法查询。
  模型对数据的解释仍可能有误，可展开工具记录核对。
- 此版本仅监听127.0.0.1，没有登录与多用户权限，不应直接暴露到公网。
- Open-Meteo 数据为模型估算及预报。联网查询将发送城市名或城市坐标；无需发送聊天历史给天气服务。

## API

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/health` | Ollama与模型状态 |
| GET | `/api/dashboard` | 城市天气、规则、提醒 |
| GET | `/api/locations?q=Hangzhou` | 搜索城市 |
| POST / DELETE | `/api/cities` / `/api/cities/{id}` | 管理城市 |
| POST | `/api/refresh` | 手动刷新 |
| PUT | `/api/rules` | 设置提醒阈值 |
| POST | `/api/chat` | SSE问询 |

问询参数：`question`、`session_id`（首次可省略）、`thinking`（默认true）。
事件：`session` → `model` → `tool_start` → `tool_end` → … → `answer` / `error` → `done`。
HTTP 429表示另一个问询仍在进行，请稍后重试。

## 代码与验证

- `portal.py`：HTTP接口、后台刷新、SQLite、问询事件流。
- `frontend/`：React + TypeScript + Vite + Tailwind CSS 前端，pnpm管理依赖。
- `frontend/src/components/`：聊天、Markdown、工具记录、天气卡片、预报、城市弹窗、提醒规则组件。
- `frontend/src/hooks/`：看板轮询和聊天状态；`src/lib/`：类型及API/SSE客户端。
- `frontend/src/components/MarkdownContent.tsx`：react-markdown + remark-gfm，支持表格、加粗、列表、链接和代码块；不执行模型返回的原始HTML。
- `weather_agent/agent.py`：工具调用循环、进度回调、天气证据校验。
- `tests/test_portal.py`：规则、城市、SSE事件、并发拒绝与失败处理。

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
cd frontend
corepack pnpm build
```

## 前端独立开发

后端保持运行，在另一个终端执行 `cd frontend`、`corepack pnpm dev`。
访问 <http://127.0.0.1:5173>，Vite 将 `/api` 请求代理到8000端口，支持热更新。
修改后执行 `corepack pnpm build`，8000端口便会使用新构建，刷新浏览器即可。
