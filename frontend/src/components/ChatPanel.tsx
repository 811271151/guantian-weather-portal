import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  BrainCircuit,
  Check,
  Copy,
  LoaderCircle,
  MessageSquarePlus,
  Sparkles,
  Square,
  UserRound,
} from "lucide-react";
import { useChat } from "../hooks/useChat";
import { MarkdownContent } from "./MarkdownContent";
import { AgentTrace } from "./AgentTrace";
import type { Health } from "../lib/types";

export function ChatPanel({ health }: { health: Health | null }) {
  const chat = useChat(),
    [input, setInput] = useState(""),
    [copied, setCopied] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (chat.messages.length > 0 || chat.busy) &&
      bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [chat.messages, chat.busy]);
  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setCopied("");
    }
  }
  function submit() {
    if (input.trim() && !chat.busy) {
      void chat.send(input.trim());
      setInput("");
    }
  }
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-5 sm:px-7">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
          <Sparkles size={23} />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-slate-800">
            天气问询助手{" "}
            <span className="ml-2 hidden rounded bg-teal-50 px-2 py-1 text-[9px] font-medium tracking-widest text-teal-700 sm:inline">
              LOCAL AGENT
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            查询实时数据，再给出有依据的回答
          </p>
        </div>
        <button className="btn-ghost" disabled={chat.busy} onClick={chat.reset}>
          <MessageSquarePlus size={15} />
          新建对话
        </button>
      </div>
      <div
        className="max-h-[620px] min-h-72 space-y-7 overflow-y-auto px-4 py-6 sm:px-7"
        aria-live="polite"
      >
        {!chat.messages.length && (
          <div className="py-9 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-100 text-teal-700">
              <Sparkles size={28} />
            </div>
            <h3 className="text-xl font-semibold">今天，想了解哪里的天气？</h3>
            <p className="mt-3 text-sm text-slate-400">
              从出行计划到城市对比，让天气数据帮你做决定。
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-2">
              {[
                "江苏南京明天需要带伞吗？",
                "比较上海和北京明天的天气",
                "杭州未来三天适合户外活动吗？",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => void chat.send(q)}
                  disabled={chat.busy}
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-xs text-slate-500 transition hover:border-teal-300 hover:bg-teal-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {chat.messages.map((message) => (
          <article
            key={message.id}
            className={
              message.role === "user"
                ? "ml-auto max-w-[88%] sm:max-w-[75%]"
                : "max-w-full"
            }
          >
            {message.role === "user" ? (
              <div className="rounded-2xl rounded-br-md bg-teal-700 px-5 py-3.5 text-sm leading-7 whitespace-pre-wrap text-white">
                <span className="mb-1 flex items-center gap-1.5 text-[10px] text-teal-100">
                  <UserRound size={11} />你
                </span>
                {message.content}
              </div>
            ) : (
              <div className="flex gap-3">
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <Sparkles size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-600">
                    观天助手
                    <span className="font-normal text-slate-400">
                      {message.duration != null
                        ? `· ${message.duration} 秒`
                        : ""}
                    </span>
                    <button
                      aria-label="复制回答"
                      title="复制 Markdown 原文"
                      onClick={() => void copy(message.id, message.content)}
                      className="ml-auto rounded p-1.5 text-slate-400 hover:bg-slate-100"
                    >
                      {copied === message.id ? (
                        <Check size={14} />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                  <div
                    className={
                      message.role === "error"
                        ? "rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
                        : "rounded-xl border border-slate-100 bg-slate-50/60 p-4 sm:p-5"
                    }
                  >
                    {message.role === "error" ? (
                      message.content
                    ) : (
                      <MarkdownContent content={message.content} />
                    )}
                  </div>
                  <div className="mt-3">
                    <AgentTrace events={message.trace} />
                  </div>
                </div>
              </div>
            )}
          </article>
        ))}
        {chat.busy && (
          <div className="space-y-3 pl-1">
            <div className="flex items-center gap-2 text-xs text-teal-700">
              <LoaderCircle size={15} className="animate-spin" />
              {chat.thinking ? "正在思考并查询天气" : "正在查询天气"}
              <span className="text-slate-400">· {chat.elapsed} 秒</span>
            </div>
            <AgentTrace events={chat.trace} running />
          </div>
        )}
        <div ref={bottom} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="border-t border-slate-100 bg-white p-4 sm:p-6"
      >
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 transition focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-50">
          <textarea
            aria-label="天气问题"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={chat.busy}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            maxLength={2000}
            className="w-full resize-none bg-transparent px-1 py-1 text-sm leading-6 outline-none placeholder:text-slate-400"
            placeholder="告诉我城市和时间，例如：江苏南京明天会下雨吗？"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-xs text-slate-600 ring-1 ring-slate-200">
              <input
                type="checkbox"
                checked={chat.thinking}
                disabled={chat.busy}
                onChange={(e) => chat.setThinking(e.target.checked)}
                className="accent-teal-700"
              />
              <BrainCircuit size={13} />
              深度思考
            </label>
            <span className="hidden text-[10px] text-slate-400 sm:block">
              {health?.model || "本地模型"} ·{" "}
              {health?.model_ready ? "已连接" : "连接中"}
            </span>
            {chat.busy ? (
              <button
                type="button"
                onClick={chat.cancel}
                className="btn-primary ml-auto"
              >
                <Square size={12} />
                停止等待
              </button>
            ) : (
              <button
                disabled={!input.trim()}
                className="btn-primary ml-auto"
                aria-label="发送问题"
              >
                <ArrowUp size={16} />
                发送
              </button>
            )}
          </div>
        </div>
        <p className="mt-3 text-center text-[10px] leading-5 text-slate-400">
          Enter 发送 · Shift + Enter 换行 ·
          回答由本地模型生成，请结合工具数据核对
        </p>
      </form>
    </section>
  );
}
