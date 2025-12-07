// lifeboard/components/tasks/TaskInput.tsx
"use client";

import { FormEvent, useState } from "react";

interface TaskInputProps {
  onSubmit: (title: string) => void;
}

export function TaskInput({ onSubmit }: TaskInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 flex items-center gap-4"
    >
      <input
        className="flex-1 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400"
        placeholder="What do you want to do…."
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        type="submit"
        className="rounded-full bg-black px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-slate-900"
      >
        Send
      </button>
    </form>
  );
}
