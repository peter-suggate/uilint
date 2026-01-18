import React, { useState } from 'react';

interface WeatherData {
  temperature: number;
  condition: string;
  humidity: number;
}

interface WeatherWidgetProps {
  location: string;
  data: WeatherData;
}

export function WeatherWidget({ location, data }: WeatherWidgetProps) {
  const [unit, setUnit] = useState<'C' | 'F'>('C');

  const displayTemp = unit === 'C'
    ? data.temperature
    : (data.temperature * 9/5) + 32;

  return (
    <div className="weather-widget p-6 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl text-white">
      <h3 className="text-xl font-bold">{location}</h3>
      <div className="flex items-center justify-between mt-4">
        <span className="text-4xl font-light">{displayTemp.toFixed(1)}°{unit}</span>
        <span className="text-lg capitalize">{data.condition}</span>
      </div>
      <div className="mt-4 flex justify-between text-sm opacity-80">
        <span>Humidity: {data.humidity}%</span>
        <button
          onClick={() => setUnit(u => u === 'C' ? 'F' : 'C')}
          className="underline"
        >
          Switch to °{unit === 'C' ? 'F' : 'C'}
        </button>
      </div>
    </div>
  );
}
