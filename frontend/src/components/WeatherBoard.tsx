import {
  Cloud,
  CloudRain,
  Sun,
  Snowflake,
  Wind,
  Droplets,
  MapPin,
  Trash2,
} from "lucide-react";
import type { City, Forecast } from "../lib/types";
import { display } from "../lib/api";
export function WeatherIcon({
  code,
  size = 42,
}: {
  code: number;
  size?: number;
}) {
  const Icon =
    code === 0
      ? Sun
      : code >= 71 && code <= 86
        ? Snowflake
        : code >= 51
          ? CloudRain
          : Cloud;
  return (
    <Icon
      size={size}
      strokeWidth={1.4}
      className={code === 0 ? "text-amber-400" : "text-sky-400"}
    />
  );
}
export function WeatherBoard({
  cities,
  selected,
  onSelect,
  onRemove,
}: {
  cities: City[];
  selected: string;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {!cities.length && (
        <div className="panel p-10 text-sm text-slate-400 sm:col-span-2">
          还没有监控城市，添加一个城市开始吧。
        </div>
      )}
      {cities.map((city) => (
        <article
          key={city.id}
          className={`relative rounded-2xl border bg-white p-5 transition ${selected === city.id ? "border-teal-500 shadow-sm ring-1 ring-teal-100" : "border-slate-200 hover:border-teal-300"}`}
        >
          <div className="flex items-start justify-between">
            <button onClick={() => onSelect(city.id)} className="text-left">
              <h3 className="text-base font-semibold">{city.name}</h3>
              <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                <MapPin size={10} />
                {city.region}
              </p>
            </button>
            <button
              aria-label={`移除${city.name}`}
              onClick={() => onRemove(city.id)}
              className="rounded-md p-1 text-slate-300 hover:bg-red-50 hover:text-red-400"
            >
              <Trash2 size={14} />
            </button>
          </div>
          {city.weather ? (
            <>
              <button
                onClick={() => onSelect(city.id)}
                aria-label={`查看${city.name}七天预报`}
                className="my-5 flex w-full items-center justify-between text-left"
              >
                <div>
                  <div className="text-4xl font-medium tracking-tight tabular-nums">
                    {display(city.weather.current.temperature_2m)}
                    <span className="align-top text-xl">°</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {city.weather.current.description} · 体感{" "}
                    {display(city.weather.current.apparent_temperature, "°")}
                  </p>
                </div>
                <WeatherIcon code={city.weather.current.weather_code} />
              </button>
              <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-xs">
                <div>
                  <span className="metric-label">
                    <Droplets size={10} />
                    湿度
                  </span>
                  {display(city.weather.current.relative_humidity_2m, "%")}
                </div>
                <div>
                  <span className="metric-label">
                    <Wind size={10} />
                    风速
                  </span>
                  {display(city.weather.current.wind_speed_10m, " km/h")}
                </div>
                <div>
                  <span className="metric-label">
                    <CloudRain size={10} />
                    降水概率
                  </span>
                  {display(
                    city.weather.daily[0]?.precipitation_probability_max,
                    "%",
                  )}
                </div>
              </div>
              <p className="mt-4 text-[9px] text-slate-400">
                数据时间 {city.weather.current.time.replace("T", " ")} ·{" "}
                {city.weather.timezone}
              </p>
            </>
          ) : (
            <p className="py-10 text-center text-sm text-slate-400">
              {city.error || "天气数据加载中…"}
            </p>
          )}
          {city.stale && city.weather && (
            <p className="mt-2 text-xs text-amber-600">
              数据更新延迟，仅供参考
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
export function ForecastPanel({ city }: { city: City | undefined }) {
  const days = city?.weather?.daily || [];
  const values = days
    .flatMap((d) => [d.temperature_2m_max, d.temperature_2m_min])
    .filter((v): v is number => v != null);
  const min = Math.min(...values) - 2,
    max = Math.max(...values) + 2;
  function points(key: "temperature_2m_max" | "temperature_2m_min") {
    return days
      .map((d, i) =>
        d[key] == null
          ? null
          : `${35 + i * 80},${95 - ((d[key]! - min) / (max - min)) * 70}`,
      )
      .filter(Boolean)
      .join(" ");
  }
  return (
    <section className="panel min-w-0 p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="section-title">
          未来七天{" "}
          <span className="ml-2 text-xs font-normal text-teal-700">
            {city?.name}
          </span>
        </h2>
        <span className="text-[10px] text-slate-400">最高温 / 最低温</span>
      </div>
      <p className="mt-2 text-xs text-slate-400">提前看见变化，做好出行计划</p>
      {days.length ? (
        <>
          <svg
            viewBox="0 0 550 115"
            className="mt-4 h-28 w-full"
            role="img"
            aria-label="未来七天气温趋势"
          >
            <line x1="20" y1="100" x2="530" y2="100" stroke="#edf1f3" />
            <polyline
              points={points("temperature_2m_min")}
              fill="none"
              stroke="#a4c8c2"
              strokeDasharray="4 5"
              strokeWidth="2"
            />
            <polyline
              points={points("temperature_2m_max")}
              fill="none"
              stroke="#218b7f"
              strokeWidth="2.5"
            />
            {days.map((d, i) =>
              d.temperature_2m_max == null ? null : (
                <circle
                  key={d.time}
                  cx={35 + i * 80}
                  cy={95 - ((d.temperature_2m_max - min) / (max - min)) * 70}
                  r="3"
                  fill="white"
                  stroke="#218b7f"
                  strokeWidth="2"
                />
              ),
            )}
          </svg>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d: Forecast, i) => (
              <div
                key={d.time}
                className={`flex flex-col items-center gap-2 rounded-lg py-3 text-center text-[10px] ${i === 0 ? "bg-teal-50" : "bg-white"}`}
              >
                <span className="text-slate-500">
                  {i === 0 ? "今天" : d.time.slice(5)}
                </span>
                <WeatherIcon code={d.weather_code} size={23} />
                <span className="whitespace-nowrap text-[9px] sm:text-[10px]">
                  {display(d.temperature_2m_max)}° /{" "}
                  {display(d.temperature_2m_min)}°
                </span>
                <span className="text-[9px] text-slate-400">
                  {display(d.precipitation_probability_max, "%")}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="py-12 text-center text-sm text-slate-400">暂无预报数据</p>
      )}
    </section>
  );
}
