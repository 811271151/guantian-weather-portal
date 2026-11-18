import type { AgentEvent } from "./types";
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) {
    let detail;
    try {
      detail = (await response.json()).detail;
    } catch {}
    throw new Error(
      typeof detail === "string" ? detail : `请求失败 (${response.status})`,
    );
  }
  return response.json();
}
export async function streamChat(
  body: unknown,
  signal: AbortSignal,
  onEvent: (event: AgentEvent) => void,
) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      typeof error.detail === "string" ? error.detail : "问询请求失败",
    );
  }
  if (!response.body) throw new Error("浏览器不支持流式响应");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    doneEvent = false;
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() || "";
      for (const frame of frames) {
        const data = frame
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (!data) continue;
        const event = JSON.parse(data) as AgentEvent;
        onEvent(event);
        if (event.type === "done") doneEvent = true;
      }
      if (done) break;
    }
    if (!doneEvent) throw new Error("连接中断，未收到完整回答，请重试");
  } finally {
    reader.releaseLock();
  }
}
export const display = (value: number | null | undefined, suffix = "") =>
  value == null ? "—" : `${Math.round(value * 10) / 10}${suffix}`;
