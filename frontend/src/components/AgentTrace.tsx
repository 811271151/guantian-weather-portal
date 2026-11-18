import {
  CheckCircle2,
  ChevronDown,
  LoaderCircle,
  Workflow,
} from "lucide-react";
import type { AgentEvent } from "../lib/types";
export function AgentTrace({
  events,
  running = false,
}: {
  events: AgentEvent[];
  running?: boolean;
}) {
  if (!events.length) return null;
  const tools = events.filter((e) => e.type === "tool_end").length;
  return (
    <details
      className="rounded-xl border border-slate-200 bg-white text-xs"
      open={running}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-slate-500">
        <Workflow size={14} />
        <span>执行过程</span>
        <span className="text-slate-400">· {tools} 次工具返回</span>
        <ChevronDown size={13} className="ml-auto" />
      </summary>
      <div className="max-h-72 space-y-3 overflow-auto border-t border-slate-100 px-4 py-4">
        {events.map((e, i) =>
          e.type === "model" ? (
            <div key={i} className="flex items-start gap-2 text-slate-500">
              {running && i === events.length - 1 ? (
                <LoaderCircle
                  size={13}
                  className="mt-0.5 shrink-0 animate-spin"
                />
              ) : (
                <CheckCircle2
                  size={13}
                  className="mt-0.5 shrink-0 text-teal-600"
                />
              )}
              <span>
                第 {e.round} 轮 · {e.message}
              </span>
            </div>
          ) : (
            <details key={i} className="ml-1 border-l-2 border-teal-100 pl-3">
              <summary className="cursor-pointer text-slate-600">
                {e.type === "tool_start" ? "调用" : "返回"}{" "}
                <code className="rounded bg-slate-100 px-1 text-teal-700">
                  {e.name}
                </code>
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-3 text-[11px] leading-5">
                {JSON.stringify(e.args ?? e.result, null, 2)}
              </pre>
            </details>
          ),
        )}
      </div>
    </details>
  );
}
