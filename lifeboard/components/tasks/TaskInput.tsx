"use client";

import { FormEvent, useState, useEffect } from "react";
import { Loader2, WifiOff } from "lucide-react";

interface TaskInputProps {
  onSubmit: (title: string) => void | Promise<void>;
}

type TaskStatus = 
  | "idle" 
  | "parsing"            // Parsing natural language
  | "checking"           // Reading Google Calendar API
  | "resolving"          // Found conflict, searching for new slot
  | "awaiting_approval"  // HITL: Waiting for user to click 'Confirm'
  | "scheduling"         // Writing to Google Calendar API
  | "offline"            // Saved to IndexedDB, waiting for connection
  | "error";

export function TaskInput({ onSubmit }: TaskInputProps) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<TaskStatus>("idle");

  // Map all TaskStatus types to agentic, descriptive labels
  const statusLabels: Record<TaskStatus, string> = {
    idle: "Schedule",
    parsing: "Thinking...",
    checking: "Checking calendar...",
    resolving: "Resolving conflict...",
    awaiting_approval: "Awaiting approval",
    scheduling: "Adding to calendar...",
    offline: "Saved to local sync",
    error: "Try again"
  };

  // Handle Offline Edge Case: Update status if connection is lost
  useEffect(() => {
    const handleOffline = () => setStatus("offline");
    const handleOnline = () => {
        if (status === "offline") setStatus("idle");
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [status]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    
    // Guard: Don't submit if empty, offline, or already working
    if (!trimmed || status !== 'idle' && status !== 'error') return;

    if (!navigator.onLine) {
      setStatus("offline");
      void onSubmit(trimmed); // Still submit to trigger IndexedDB logic
      setValue("");
      return;
    }

    setStatus("parsing");
    try {
      const maybePromise = onSubmit(trimmed);
      setValue("");
      if (maybePromise && typeof (maybePromise as any).then === "function") {
        (maybePromise as Promise<void>)
          .then(() => setStatus("idle"))
          .catch(() => setStatus("error"));
      } else {
        setStatus("idle");
      }
    } catch {
      setStatus("error");
    }
  };

  const isProcessing = status !== "idle" && status !== "error" && status !== "offline";

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col items-center gap-4">
      <input
        className="flex-1 w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-black/10 disabled:bg-slate-50"
        placeholder="What do you want to do…."
        value={value}
        disabled={isProcessing}
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        type="submit"
        disabled={isProcessing || status === "offline" || !value.trim()}
        className="min-w-[160px] flex items-center justify-center gap-2 rounded-full bg-black px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-slate-900 disabled:bg-slate-400 transition-all active:scale-95"
      >
        {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
        {status === "offline" && <WifiOff className="h-4 w-4" />}
        <span>{statusLabels[status]}</span>
      </button>
    </form>
  );
}