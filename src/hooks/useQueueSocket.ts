import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Queue } from "../types.js";

interface UseQueueSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  queue: Queue | null;
  error: string | null;
  clearError: () => void;
  addPatient: (name: string, phone?: string) => boolean;
  callNext: () => boolean;
  markNoShow: () => boolean;
  updateAvgTime: (minutes: number) => boolean;
  resetQueue: () => boolean;
  undoLastAction: () => boolean;
}

export function useQueueSocket(): UseQueueSocketReturn {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(true);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    // Connect to the originating host of the webpage
    // Works perfectly in Dev (localhost:3000) and Cloud Run containers
    const socket = io({
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      autoConnect: true
    });
    
    socketRef.current = socket;

    // Handle primary connection
    socket.on("connect", () => {
      console.log("Connected to QueueCure Realtime Engine");
      setIsConnected(true);
      setIsConnecting(false);
      // Request active state on connect (covers both initial join and reconnection recoveries)
      socket.emit("queue:request-state");
    });

    socket.on("disconnect", (reason) => {
      console.warn("Disconnected from QueueCure Realtime Engine:", reason);
      setIsConnected(false);
      if (reason === "io client disconnect") {
        setIsConnecting(false);
      } else {
        setIsConnecting(true); // Attempting to reconnect
      }
    });

    socket.on("connect_error", (err) => {
      console.error("QueueCure connection failure:", err);
      setIsConnected(false);
      setIsConnecting(true);
    });

    // Handle incoming state broadcasts
    socket.on("queue:update", (updatedQueue: Queue) => {
      console.log("Queue Update Received:", updatedQueue);
      setQueue(updatedQueue);
    });

    // Handle real-time validation dispatches from server
    socket.on("queue:error", (errData: { message: string }) => {
      console.error("Queue Server Error:", errData.message);
      setError(errData.message);
      // Auto-clear error after 4 seconds
      setTimeout(() => {
        setError(prev => prev === errData.message ? null : prev);
      }, 4000);
    });

    // Handle successful undo message
    socket.on("queue:undo-success", (data: { message: string }) => {
      console.log("Undo success:", data.message);
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const addPatient = useCallback((name: string, phone?: string): boolean => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit("queue:add-patient", { name, phone });
      return true;
    }
    setError("You're offline — reconnect to add patients.");
    return false;
  }, [isConnected]);

  const callNext = useCallback((): boolean => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit("queue:call-next");
      return true;
    }
    setError("You're offline — reconnect to call the next patient.");
    return false;
  }, [isConnected]);

  const markNoShow = useCallback((): boolean => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit("queue:mark-no-show");
      return true;
    }
    setError("You're offline — reconnect to skip patients.");
    return false;
  }, [isConnected]);

  const updateAvgTime = useCallback((minutes: number): boolean => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit("queue:update-avg-time", { avgTimeMinutes: minutes });
      return true;
    }
    setError("You're offline — reconnect to update settings.");
    return false;
  }, [isConnected]);

  const resetQueue = useCallback((): boolean => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit("queue:reset");
      return true;
    }
    setError("You're offline — reconnect to reset the queue.");
    return false;
  }, [isConnected]);

  const undoLastAction = useCallback((): boolean => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit("queue:undo");
      return true;
    }
    setError("You're offline — reconnect to undo.");
    return false;
  }, [isConnected]);

  return {
    isConnected,
    isConnecting,
    queue,
    error,
    clearError,
    addPatient,
    callNext,
    markNoShow,
    updateAvgTime,
    resetQueue,
    undoLastAction
  };
}
