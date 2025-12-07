"use client";

interface TaskHeaderProps {
  total: number;
  openCount: number;
  scheduledCount: number;
}

export function TaskHeader({ total, openCount, scheduledCount }: TaskHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="rounded-full bg-purple-300/80 px-4 py-1 text-xs font-medium text-slate-900 shadow-sm">
        <span className="mr-2">Total:</span>
        <span>{total}</span>
      </div>

      <h3 className="lifeboard-card-title">Tasks To-Do</h3>

      <div className="rounded-full bg-purple-300/80 px-4 py-1 text-xs font-medium text-slate-900 shadow-sm whitespace-nowrap">
        {openCount} open • {scheduledCount} scheduled
      </div>
    </div>
  );
}
