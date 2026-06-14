import { useState, useEffect } from "react";
import PortalView from "./components/PortalView.js";
import ReceptionView from "./components/ReceptionView.js";
import WaitingView from "./components/WaitingView.js";
import { useQueueSocket } from "./hooks/useQueueSocket.js";

function normalizePath(path: string): string {
  const trimmed = path.replace(/\/+$/, "") || "/";
  return trimmed.toLowerCase() === "/display" ? "/waiting" : trimmed;
}

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => normalizePath(window.location.pathname));

  // Bind the hook globally so it manages connections and shares consistent state
  const {
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
  } = useQueueSocket();

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(normalizePath(window.location.pathname));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (path: string) => {
    const normalized = normalizePath(path);
    window.history.pushState({}, "", normalized);
    setCurrentPath(normalized);
  };

  // Switch views accordingly
  if (currentPath === "/reception") {
    return (
      <ReceptionView
        isConnected={isConnected}
        isConnecting={isConnecting}
        queue={queue}
        error={error}
        clearError={clearError}
        addPatient={addPatient}
        callNext={callNext}
        markNoShow={markNoShow}
        updateAvgTime={updateAvgTime}
        resetQueue={resetQueue}
        undoLastAction={undoLastAction}
        onNavigate={navigate}
      />
    );
  }

  if (currentPath === "/waiting" || currentPath === "/display") {
    return (
      <WaitingView
        isConnected={isConnected}
        isConnecting={isConnecting}
        queue={queue}
        onNavigate={navigate}
      />
    );
  }

  // Fallback to the beautiful onboarding portal hub
  return <PortalView onNavigate={navigate} isConnected={isConnected} isConnecting={isConnecting} queue={queue} />;
}
