"use client";
import { MoveDownIcon, MoveUpIcon, SunIcon } from "lucide-react";

import {
  Widget,
  WidgetContent,
  WidgetHeader,
  WidgetTitle,
} from "@/components/ui/widget";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";

interface LocationData {
  city: string;
  region: string;
  country_name: string;
}

interface WeatherData {
  temp: number;
  description: string;
  icon: string;
  feels_like: number;
  temp_min: number;
  temp_max: number;
}

export default function WidgetWeather() {
     const [location, setLocation] = useState<LocationData | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  
    const API_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_KEY!;
 
  useEffect(() => {
    // STEP 1: Get user city/region/country
    fetch("https://ipapi.co/json/")
      .then((res) => res.json())
      .then((data) => {
        const loc = {
          city: data.city,
          region: data.region,
          country_name: data.country_name,
        };
        setLocation(loc);

        // STEP 2: Fetch weather using detected city
        return fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${loc.city}&appid=${API_KEY}&units=metric`
        );
      })
      .then((res) => res.json())
      .then((weatherData) => {
        setWeather({
          temp: weatherData.main.temp,
          description: weatherData.weather[0].description,
          icon: weatherData.weather[0].icon,
          feels_like: weatherData.main.feels_like,
          temp_min: weatherData.main.temp_min,
          temp_max: weatherData.main.temp_max,
        });
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-md text-center">
        Loading weather...
      </div>
    );
  }

  if (!location || !weather) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-md text-center">
        Weather unavailable
      </div>
    );
  }
  return (
    <Widget>
      <WidgetHeader className="flex-col gap-3">
        <WidgetTitle>{location.city}</WidgetTitle>
        <div className="flex flex-col">
          <div className="flex items-center gap-x-2">
            <SunIcon className="size-8 fill-current" />
            <Label className="text-4xl">{Math.round(weather.temp)}&deg;C</Label>
          </div>
          <Label className="text-muted-foreground">Feels Like {Math.round(weather.feels_like)}&deg;C</Label>
        </div>
      </WidgetHeader>
      <WidgetContent className="items-end">
        <div className="flex h-max w-full items-center justify-start">
          <MoveUpIcon
            fill="currentColor"
            className="mr-1 size-4"
            strokeWidth={4}
          />
          <Label>{Math.round(weather.temp_max)}&deg;C</Label>
        </div>
        <div className="flex w-full items-center justify-end">
          <MoveDownIcon
            fill="currentColor"
            className="mr-1 size-4"
            strokeWidth={4}
          />
          <Label>{Math.round(weather.temp_min)}&deg;C</Label>
        </div>
      </WidgetContent>
    </Widget>
  );
}
