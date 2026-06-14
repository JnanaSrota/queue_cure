import { useState, useEffect } from "react";

function formatWaitingDuration(createdAtStr: string): string {
  const start = new Date(createdAtStr).getTime();
  if (Number.isNaN(start)) return "Unknown";
  const diffMins = Math.floor((Date.now() - start) / (1000 * 60));
  if (diffMins < 1) return "Just now";
  return `${diffMins} min${diffMins > 1 ? "s" : ""}`;
}

interface LiveElapsedProps {
  since: string;
  className?: string;
  suffix?: string;
}

/** Updates elapsed time locally without re-rendering the whole page. */
export default function LiveElapsed({ since, className, suffix }: LiveElapsedProps) {
  const [label, setLabel] = useState(() => formatWaitingDuration(since));

  useEffect(() => {
    setLabel(formatWaitingDuration(since));
    const id = setInterval(() => setLabel(formatWaitingDuration(since)), 60000);
    return () => clearInterval(id);
  }, [since]);

  return (
    <span className={className}>
      {label}
      {suffix && <span className="text-xs block text-slate-400 font-normal">{suffix}</span>}
    </span>
  );
}
