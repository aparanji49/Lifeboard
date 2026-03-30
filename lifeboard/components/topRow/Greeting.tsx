"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface Quote {
  text: string;
  author: string;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export default function Greeting() {
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated";

  const username =
    (isAuthed && session?.user?.name) || (status === "loading" ? "…" : "Guest");
  const day = new Date().toLocaleDateString("en-US", { weekday: "long" });

  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => {
    const load = () => {
      fetch("/api/quote")
        .then((response) => (response.ok ? response.json() : Promise.reject()))
        .then((data: { text?: string; author?: string }) => {
          if (data.text && data.author) {
            setQuote({ text: data.text, author: data.author });
          }
        })
        .catch(() => {});
    };

    load();
    const intervalId = setInterval(load, TWENTY_FOUR_HOURS_MS);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-4">
      <div className="text-2xl font-semibold font-italiana">
        Hey {username}
      </div>
      <div className="text-2xl font-semibold font-italiana">Happy {day}!</div>
      {quote && (
        <div className="text-gray-500 italic flex flex-col items-center justify-center align-center">
          {quote.text} - {quote.author}
        </div>
      )}
    </div>
  );
}
