import { useState } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { api, display } from "../lib/api";
import type { Alert, Rules } from "../lib/types";
export function AlertList({ alerts }: { alerts: Alert[] }) {
  return alerts.length ? (
    <div className="divide-y divide-slate-100">
      {alerts.map((a, i) => (
        <div key={i} className="flex gap-3 py-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <TriangleAlert size={16} />
          </div>
          <div>
            <p className="text-sm text-slate-700">
              {a.city} · {a.title}提醒
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              今日预报 {display(a.value)} {a.unit} · 阈值 {display(a.limit)}{" "}
              {a.unit}
            </p>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="py-8 text-center">
      <CircleCheck className="mx-auto mb-3 text-teal-500" size={27} />
      <p className="text-sm text-slate-600">暂无阈值提醒</p>
      <p className="mt-2 text-xs text-slate-400">有效天气数据未触发当前规则</p>
    </div>
  );
}
export function AlertsPanel({
  alerts,
  rules,
  onSaved,
}: {
  alerts: Alert[];
  rules: Rules;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(rules),
    [saving, setSaving] = useState(false),
    [notice, setNotice] = useState("");
  async function save() {
    setSaving(true);
    try {
      await api("/api/rules", { method: "PUT", body: JSON.stringify(draft) });
      onSaved();
      setNotice("提醒规则已保存");
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="panel p-6">
      <h2 className="section-title">监控提醒</h2>
      <p className="mt-2 text-xs text-slate-400">
        每 5 分钟更新，提醒在本平台展示，不代表官方气象预警。
      </p>
      <div className="my-4">
        <AlertList alerts={alerts} />
      </div>
      <div className="border-t border-slate-100 pt-6">
        <h3 className="text-sm font-semibold">自定义提醒阈值</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="mt-5 flex flex-wrap items-end gap-4"
        >
          {(
            [
              { key: "temperature", label: "最高温 ≥（℃）", min: -50, max: 60 },
              { key: "rain", label: "降水概率 ≥（%）", min: 0, max: 100 },
              { key: "wind", label: "最大风速 ≥（km/h）", min: 0, max: 300 },
            ] as const
          ).map((f) => (
            <label key={f.key} className="text-xs text-slate-500">
              {f.label}
              <input
                required
                type="number"
                min={f.min}
                max={f.max}
                step="any"
                value={draft[f.key]}
                onChange={(e) =>
                  setDraft({ ...draft, [f.key]: Number(e.target.value) })
                }
                className="form-input mt-2 block w-36"
              />
            </label>
          ))}
          <button disabled={saving} className="btn-primary">
            {saving ? "保存中…" : "保存规则"}
          </button>
        </form>
        <p role="status" className="mt-4 text-xs text-teal-700">
          {notice}
        </p>
      </div>
    </section>
  );
}
