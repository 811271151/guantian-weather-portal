import { useEffect, useRef, useState } from "react";
import { streamChat } from "../lib/api";
import type { AgentEvent, ChatMessage } from "../lib/types";
const historyKey = "guantian-chat-v2";
function loadHistory(): ChatMessage[] {
  try {
    return JSON.parse(sessionStorage.getItem(historyKey) || "[]");
  } catch {
    return [];
  }
}
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory),
    [busy, setBusy] = useState(false),
    [trace, setTrace] = useState<AgentEvent[]>([]),
    [thinking, setThinking] = useState(true),
    [elapsed, setElapsed] = useState(0);
  const session = useRef<string | null>(
      sessionStorage.getItem("weatherSession"),
    ),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    try {
      sessionStorage.setItem(historyKey, JSON.stringify(messages.slice(-30)));
    } catch {
      /* Storage quota must not break chat. */
    }
  }, [messages]);
  useEffect(() => () => controller.current?.abort(), []);
  async function send(question: string) {
    if (busy || !question.trim()) return;
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: question, trace: [] },
    ]);
    setBusy(true);
    setTrace([]);
    setElapsed(0);
    const started = Date.now(),
      steps: AgentEvent[] = [];
    let answered = false;
    const abort = new AbortController();
    controller.current = abort;
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    try {
      await streamChat(
        { question, session_id: session.current, thinking },
        abort.signal,
        (event) => {
          if (event.type === "session" && event.session_id) {
            session.current = event.session_id;
            sessionStorage.setItem("weatherSession", event.session_id);
          } else if (["model", "tool_start", "tool_end"].includes(event.type)) {
            steps.push(event);
            setTrace([...steps]);
          } else if (event.type === "answer" || event.type === "error") {
            answered = true;
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: event.type === "answer" ? "assistant" : "error",
                content: event.text || event.message || "未返回内容",
                trace: [...steps],
                duration: Math.round((Date.now() - started) / 1000),
              },
            ]);
          }
        },
      );
      if (!answered) throw new Error("没有收到回答，请稍后重试");
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "error",
          content:
            (error as Error).name === "AbortError"
              ? "已停止等待。当前模型调用可能仍在收尾，请稍后重试。"
              : (error as Error).message,
          trace: [...steps],
        },
      ]);
    } finally {
      clearInterval(timer);
      setBusy(false);
      controller.current = null;
    }
  }
  function reset() {
    if (busy) return;
    session.current = null;
    sessionStorage.removeItem("weatherSession");
    setMessages([]);
    setTrace([]);
  }
  return {
    messages,
    busy,
    trace,
    thinking,
    setThinking,
    elapsed,
    send,
    reset,
    cancel: () => controller.current?.abort(),
  };
}
