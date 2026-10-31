// WMO weather codes supplied by Open-Meteo's daily forecast.
export function weatherCondition(code) {
  if (code === 0) return ["☀️", "Sunny"];
  if (code === 1) return ["🌤️", "Mostly sunny"];
  if (code === 2) return ["⛅", "Partly cloudy"];
  if (code === 3) return ["☁️", "Cloudy"];
  if ([45, 48].includes(code)) return ["🌫️", "Foggy"];
  if ([51, 53, 55, 56, 57].includes(code)) return ["🌦️", "Drizzle"];
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return ["🌧️", "Rainy"];
  if ([71, 73, 75, 77, 85, 86].includes(code)) return ["🌨️", "Snowy"];
  if ([95, 96, 99].includes(code)) return ["⛈️", "Thunderstorms"];
  return ["❔", "Weather unavailable"];
}

export default function ForecastWeatherIcon({ code }) {
  const [icon, label] = weatherCondition(code);
  return <span role="img" aria-label={label} title={`${label} · Maasin City · Open-Meteo`}
    className="inline-block shrink-0 text-xl leading-none align-middle">{icon}</span>;
}
