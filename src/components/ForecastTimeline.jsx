import { useEffect, useRef } from 'react';

import ForecastWeatherIcon from "./ForecastWeatherIcon";

export default function ForecastTimeline({ forecast }) {
  const selected = useRef(null);
  useEffect(() => {
    selected.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [forecast.day]);

  return <nav aria-label="Forecast date timeline" className="absolute inset-x-0 bottom-0 z-20 bg-black/35 text-white">
    <div className="overflow-x-auto">
      <div className="flex min-w-max" role="group" aria-label="Select forecast day">
        {forecast.dates.map((date, index) => {
          const active = forecast.day === index;
          return <button key={date.value} ref={active ? selected : null} type="button"
            aria-pressed={active} aria-label={`Forecast for ${date.label}, ${date.value}`}
            onClick={() => forecast.setDay(index)}
            className={`relative flex-1 min-w-28 border-r border-r-white/15 text-white px-3 py-3 text-xs whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white ${active ? 'bg-white/25 font-bold' : 'hover:bg-white/10'}`}>

            <span className="inline-flex items-center justify-center gap-2">
              <ForecastWeatherIcon code={forecast.weatherDays?.find((item) => item.date === date.value)?.weather_code} />
              <span>{date.label}</span>
            </span>
          </button>;
        })}
      </div>
    </div>
  </nav>;
}
