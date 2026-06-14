import { useState, useEffect, useMemo } from "react";
import { Queue } from "../types.js";
import { withLiveWaitTimes } from "../lib/waitTimeCalculator.js";

/**
 * Recomputes wait-time estimates on the client so the server
 * does not need to broadcast every 30 seconds (which was causing
 * dev reloads when data.json changed and wiping form input).
 */
export function useLiveQueue(queue: Queue | null, intervalMs = 30000): Queue | null {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!queue) return;
    const id = setInterval(() => setTick(t => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [queue, intervalMs]);

  return useMemo(() => {
    if (!queue) return null;
    void tick;
    return withLiveWaitTimes(queue);
  }, [queue, tick]);
}
