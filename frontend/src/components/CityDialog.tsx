import { useEffect, useRef, useState } from "react";
import { LoaderCircle, MapPin, Search, X } from "lucide-react";
import { api } from "../lib/api";
import type { Location } from "../lib/types";
export function CityDialog({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<Location[]>([]),
    [busy, setBusy] = useState(false),
    [searched, setSearched] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  async function search() {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ locations: Location[] }>(
        "/api/locations?q=" + encodeURIComponent(query),
      );
      setResults(data.locations);
      setSearched(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function add(city: Location) {
    setBusy(true);
    setError("");
    try {
      await api("/api/cities", {
        method: "POST",
        body: JSON.stringify({
          name: city.name,
          region: [city.admin1, city.country].filter(Boolean).join(" · "),
          latitude: city.latitude,
          longitude: city.longitude,
        }),
      });
      onAdded();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      className="m-auto w-[520px] max-w-[92vw] rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl backdrop:bg-slate-900/35 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">添加监控城市</h2>
        <button
          aria-label="关闭"
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:bg-slate-100"
        >
          <X size={20} />
        </button>
      </div>
      <p className="mt-2 text-xs leading-6 text-slate-400">
        搜索城市并选择所在地区，最多监控 12 个城市。
      </p>
      <form
        className="my-5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <input
          autoFocus
          required
          maxLength={80}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="form-input min-w-0 flex-1"
          placeholder="城市名 / 拼音，例如：杭州"
        />
        <button disabled={busy} className="btn-primary">
          {busy ? (
            <LoaderCircle className="animate-spin" size={15} />
          ) : (
            <Search size={15} />
          )}
          搜索
        </button>
      </form>
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="max-h-80 overflow-auto">
        {results.map((city, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 border-t border-slate-100 py-4"
          >
            <div>
              <p className="flex items-center gap-2 text-sm">
                <MapPin size={14} className="text-teal-600" />
                {city.name}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {[city.admin1, city.admin2, city.country]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <button
              disabled={busy}
              onClick={() => void add(city)}
              className="btn-ghost"
            >
              添加
            </button>
          </div>
        ))}
        {searched && !results.length && (
          <p className="py-5 text-sm text-slate-400">
            未找到城市，请尝试英文或拼音名称。
          </p>
        )}
      </div>
    </dialog>
  );
}
