export interface Forecast {
  time: string;
  description: string;
  weather_code: number;
  temperature_2m_max: number | null;
  temperature_2m_min: number | null;
  precipitation_probability_max: number | null;
  wind_speed_10m_max: number | null;
}
export interface Weather {
  timezone: string;
  current: {
    time: string;
    description: string;
    temperature_2m: number | null;
    apparent_temperature: number | null;
    relative_humidity_2m: number | null;
    wind_speed_10m: number | null;
    weather_code: number;
  };
  daily: Forecast[];
}
export interface City {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  weather: Weather | null;
  updated: number;
  stale: boolean;
  error: string | null;
}
export interface Rules {
  temperature: number;
  rain: number;
  wind: number;
}
export interface Alert {
  city: string;
  title: string;
  value: number;
  unit: string;
  limit: number;
}
export interface Dashboard {
  cities: City[];
  alerts: Alert[];
  rules: Rules;
  refreshing: boolean;
}
export interface Health {
  model: string;
  ollama: boolean;
  model_ready: boolean;
  busy: boolean;
}
export interface Location {
  name: string;
  admin1?: string;
  admin2?: string;
  country?: string;
  latitude: number;
  longitude: number;
}
export interface AgentEvent {
  type: string;
  session_id?: string;
  round?: number;
  message?: string;
  name?: string;
  args?: unknown;
  result?: unknown;
  text?: string;
}
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  trace: AgentEvent[];
  duration?: number;
}
