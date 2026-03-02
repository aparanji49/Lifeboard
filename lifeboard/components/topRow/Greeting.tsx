"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface Quote {
  text: string;
  author: string;
}

export default function Greeting() {
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated";

  const username =
    (isAuthed && session?.user?.name) || (status === "loading" ? "…" : "Guest");
  const day = new Date().toLocaleDateString("en-US", { weekday: "long" });

  const [quote, setQuote] = useState<Quote | null>(null);
  const API_KEY = process.env.NEXT_PUBLIC_API_NINJAS_KEY!;

  useEffect(() => {
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    const intervalId = setInterval(() => {
      fetch(
        "https://api.api-ninjas.com/v2/randomquotes?categories=inspirational,courage",
        {
          method: "GET",
          headers: {
            "X-Api-Key": API_KEY,
          },
        }
      )
        .then((response) => response.json())
        .then((data) => {
          const nextQuote = { text: data[0].quote, author: data[0].author };
          setQuote(nextQuote);
        });
    }, TWENTY_FOUR_HOURS);

    return () => {
      clearInterval(intervalId);
    };
  }, [API_KEY]);

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