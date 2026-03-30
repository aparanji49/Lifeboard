"use client";
import { MoveDownIcon, MoveUpIcon } from "lucide-react";

import {
  Widget,
  WidgetContent,
  WidgetHeader,
  WidgetTitle,
} from "@/components/ui/widget";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import Image from "next/image";

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

  useEffect(() => {
    fetch("https://ipapi.co/json/")
      .then((res) => res.json())
      .then((data) => {
        const params = new URLSearchParams({
          city: String(data.city ?? ""),
          cc: String(data.country_code ?? ""),
          region: String(data.region ?? ""),
          country: String(data.country_name ?? ""),
        });
        return fetch(`/api/weather?${params.toString()}`);
      })
      .then((res) => {
        if (!res.ok) throw new Error("weather proxy");
        return res.json() as Promise<{
          location: LocationData;
          weather: WeatherData;
        }>;
      })
      .then((payload) => {
        setLocation(payload.location);
        setWeather(payload.weather);
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
    <Widget className="rounded-3xl">
      <WidgetHeader className="flex-col gap-3">
        <WidgetTitle>{location.city}</WidgetTitle>
        <div className="flex flex-col">
          <div className="flex items-center gap-x-2">
            <Image
              src={`https://openweathermap.org/img/wn/${weather.icon}.png`}
              height={100}
              width={100}
              alt={`${weather.description}`}
            />
            <Label className="text-4xl">{Math.round(weather.temp)}&deg;F</Label>
          </div>
          <Label className="text-muted-foreground">
            Feels Like {Math.round(weather.feels_like)}&deg;F
          </Label>
        </div>
      </WidgetHeader>
      <WidgetContent className="items-end">
        <div className="flex h-max w-full items-center justify-start">
          <MoveUpIcon
            fill="currentColor"
            className="mr-1 size-4"
            strokeWidth={4}
          />
          <Label>{Math.round(weather.temp_max)}&deg;F</Label>
        </div>
        <div className="flex w-full items-center justify-end">
          <MoveDownIcon
            fill="currentColor"
            className="mr-1 size-4"
            strokeWidth={4}
          />
          <Label>{Math.round(weather.temp_min)}&deg;F</Label>
        </div>
      </WidgetContent>
    </Widget>
  );
}
