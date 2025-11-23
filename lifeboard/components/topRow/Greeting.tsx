"use client";
import { useEffect, useState } from "react";


interface Quote {
    text: string;
    author: string;
}

export default function Greeting()  {
const username = "Aparanji"; // Placeholder for dynamic username retrieval
const [quote, setQuote] = useState<Quote| null>(null);
const API_KEY = process.env.NEXT_PUBLIC_API_NINJAS_KEY!;
useEffect(() => {
    fetch("https://api.api-ninjas.com/v2/quoteoftheday", {
        method: "GET",
        headers: {
              'X-Api-Key': API_KEY, 
        }
    })
        .then((response) => response.json())
        .then((data) => {
            console.log(data);
            // const d = data[0]; 
            const quote = { text: data[0].quote, author: data[0].author };  
            setQuote(quote);
            // console.log(quote.text); // Log the entire response for inspection
        }
        );
}, []);


return (
        <div className="flex flex-col items-center justify-center py-4">
        <div className="text-2xl font-semibold">
            Hello, {username}!
        </div>
      {quote &&  <div className="text-gray-500 flex flex-col items-center justify-center">
            {quote.text}
            <br />
            - {quote.author}
        </div> }
        </div>
    );
}