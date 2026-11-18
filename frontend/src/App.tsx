import { useState } from "react";
import {
  ArrowUpRight,
  Bell,
  ChartNoAxesCombined,
  CloudSun,
  LayoutDashboard,
  LoaderCircle,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useDashboard } from "./hooks/useDashboard";
import { api } from "./lib/api";
import { ChatPanel } from "./components/ChatPanel";
import { WeatherBoard, ForecastPanel } from "./components/WeatherBoard";
import { AlertList, AlertsPanel } from "./components/AlertsPanel";
import { CityDialog } from "./components/CityDialog";
type View = "overview" | "chat" | "alerts";
const navigation = [
  { id: "overview" as View, label: "天气总览", icon: LayoutDashboard },
  { id: "chat" as View, label: "智能问询", icon: Sparkles },
  { id: "alerts" as View, label: "监控提醒", icon: Bell },
];
export default function App() {
  const { data, health, error, refreshing, reload, refresh } = useDashboard();
  const [view, setView] = useState<View>("overview"),
    [selected, setSelected] = useState(""),
    [dialog, setDialog] = useState(false),
    [notice, setNotice] = useState("");
  const city = data?.cities.find((c) => c.id === selected) || data?.cities[0];
  async function remove(id: string) {
    try {
      await api("/api/cities/" + id, { method: "DELETE" });
      await reload();
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  return (
    <div className="min-h-screen bg-[#f5f7f9] text-slate-800">
      <aside className="z-20 flex w-full items-center justify-between border-b border-slate-200 bg-white p-4 md:fixed md:inset-y-0 md:w-56 md:flex-col md:items-stretch md:border-r md:border-b-0 md:p-6">
        <a href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-teal-700 text-teal-700">
            <CloudSun size={27} />
          </div>
          <span className="text-2xl font-bold tracking-[.1em]">
            观天
            <small className="mt-1 hidden text-[8px] font-medium tracking-[.15em] text-slate-400 sm:block">
              WEATHER INTELLIGENCE
            </small>
          </span>
        </a>
        <div className="mt-12 hidden items-center justify-between text-[10px] text-slate-400 md:flex">
          <span>个人工作空间</span>
          <span className="rounded bg-slate-50 px-1.5 py-1 text-[8px]">
            LOCAL
          </span>
        </div>
        <nav className="flex gap-1 md:mt-5 md:flex-col md:gap-2">
          {navigation.map((item) => (
            <button
              key={item.id}
              aria-label={item.label}
              onClick={() => setView(item.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-3 text-xs transition md:gap-3 ${view === item.id ? "bg-teal-50 font-semibold text-teal-700" : "text-slate-500 hover:bg-slate-50"}`}
            >
              <item.icon size={16} />
              <span className="hidden sm:inline">{item.label}</span>
              {item.id === "alerts" && !!data?.alerts.length && (
                <span className="ml-auto rounded bg-amber-50 px-1.5 text-[10px] text-amber-600">
                  {data.alerts.length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="mt-auto hidden pt-8 md:block">
          <div className="flex items-center gap-2 text-[11px]">
            <span
              className={`h-1.5 w-1.5 rounded-full ${health?.model_ready ? "bg-teal-500" : "bg-amber-400"}`}
            />
            {health?.model_ready
              ? "Ollama 已连接"
              : health?.ollama
                ? "模型未就绪"
                : "Ollama 未连接"}
          </div>
          <p className="mt-4 text-[10px] leading-6 text-slate-400">
            模型在本机推理
            <br />
            天气数据来自 Open-Meteo
          </p>
        </div>
      </aside>
      <main className="md:ml-56">
        <header className="flex h-16 items-center justify-between border-b border-slate-200/70 bg-white px-5 text-xs sm:px-8">
          <div className="flex gap-4 text-slate-400">
            工作空间<span>/</span>
            <span className="font-medium text-slate-600">
              {navigation.find((n) => n.id === view)?.label}
            </span>
          </div>
          <div className="flex items-center gap-5">
            <span className="hidden text-[11px] text-slate-400 sm:block">
              {new Date().toLocaleDateString("zh-CN", {
                month: "long",
                day: "numeric",
                weekday: "long",
              })}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-teal-700">
              我
            </span>
          </div>
        </header>
        <div className="mx-auto max-w-[1480px] space-y-6 px-4 py-7 sm:px-8 sm:py-9">
          <section className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <p className="text-[9px] font-semibold tracking-[.2em] text-teal-700">
                WEATHER INTELLIGENCE WORKSPACE
              </p>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-[28px]">
                {view === "chat"
                  ? "让每一次问询，都有数据依据。"
                  : view === "alerts"
                    ? "提前感知变化，及时安排应对。"
                    : "读懂天气，从容安排每一天。"}
              </h1>
              <p className="mt-3 text-xs leading-6 text-slate-400">
                多城市动态监控 · 真实天气工具 · 本地智能问询
              </p>
            </div>
            <button onClick={() => setDialog(true)} className="btn-primary">
              <Plus size={15} />
              添加监控城市
            </button>
          </section>
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-teal-100 bg-teal-50/60 px-4 py-3 text-[10px] text-teal-800">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
              天气服务
            </span>
            <span className="text-slate-400">
              {data?.refreshing
                ? "正在更新…"
                : data?.cities.some((c) => c.updated)
                  ? `最近更新 ${new Date(Math.max(...data.cities.map((c) => c.updated)) * 1000).toLocaleTimeString("zh-CN", { hour12: false })}`
                  : "正在获取数据"}
            </span>
            <button
              disabled={refreshing}
              onClick={() => void refresh().catch((e) => setNotice(e.message))}
              className="ml-auto flex items-center gap-1.5 text-teal-700"
            >
              {refreshing ? (
                <LoaderCircle size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              刷新数据
            </button>
          </div>
          {(error || notice) && (
            <div
              role="alert"
              className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800"
            >
              {error || notice}
              <button
                className="ml-4 underline"
                onClick={() => {
                  setNotice("");
                  void reload();
                }}
              >
                重试
              </button>
            </div>
          )}
          {view === "overview" && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="section-title">
                  城市天气{" "}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {data?.cities.length || 0} 个监控城市
                  </span>
                </h2>
                <span className="text-[10px] text-slate-400">
                  每 5 分钟更新
                </span>
              </div>
              {data ? (
                <WeatherBoard
                  cities={data.cities}
                  selected={city?.id || ""}
                  onSelect={setSelected}
                  onRemove={(id) => void remove(id)}
                />
              ) : (
                <div className="panel animate-pulse p-12 text-center text-sm text-slate-400">
                  正在读取城市天气…
                </div>
              )}
              <div className="grid gap-5 xl:grid-cols-[1.8fr_1fr]">
                <ForecastPanel city={city} />
                <section className="panel p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="section-title">今日监控</h2>
                    <ChartNoAxesCombined size={17} className="text-teal-600" />
                  </div>
                  <AlertList alerts={data?.alerts.slice(0, 3) || []} />
                  <button
                    className="btn-ghost"
                    onClick={() => setView("alerts")}
                  >
                    管理提醒规则
                    <ArrowUpRight size={13} />
                  </button>
                  <p className="mt-4 border-t border-dashed border-slate-200 pt-4 text-[10px] leading-6 text-slate-400">
                    提醒基于当天预报与自定义阈值生成，不代表气象部门官方预警。
                  </p>
                </section>
              </div>
            </>
          )}
          {view === "alerts" && data && (
            <AlertsPanel
              key={`${data.rules.temperature}-${data.rules.rain}-${data.rules.wind}`}
              alerts={data.alerts}
              rules={data.rules}
              onSaved={() => void reload()}
            />
          )}
          <div hidden={view === "alerts"}>
            <ChatPanel health={health} />
          </div>
          <footer className="flex flex-wrap justify-between gap-3 py-1 text-[9px] leading-6 text-slate-400">
            <span>◉ 观天 · 让数据成为决策的依据</span>
            <span>
              天气为模型估算与预报，非气象站实测 ·{" "}
              <a
                href="https://open-meteo.com/"
                target="_blank"
                rel="noreferrer"
                className="hover:text-teal-700"
              >
                Open-Meteo ↗
              </a>
            </span>
          </footer>
        </div>
      </main>
      {dialog && (
        <CityDialog
          onClose={() => setDialog(false)}
          onAdded={() => void reload()}
        />
      )}
    </div>
  );
}
