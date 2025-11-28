import Header from "@/components/header/Header";
import WidgetClock from "@/components/topRow/clock-05";
import Greeting from "@/components/topRow/Greeting";
import WidgetWeather from "@/components/topRow/weather-05";

export default function Home() {
  return (
    <div className="min-h-screen font-sans">
      <Header />
      <section className="flex flex-row mx-auto px-4 py-8 justify-between gap-5 items-center w-full max-w-5xl">
        {/* top content goes here */}
        <WidgetClock />
        <Greeting />
        <WidgetWeather />
      </section>
    </div>
  );
}
