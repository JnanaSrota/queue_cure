import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Clock, ArrowLeft, Users, Loader2 } from "lucide-react";
import { Queue } from "../types.js";
import { ConnectionBanner, ConnectionBadge, EmptyState } from "./ui/shared.js";
import { useLiveQueue } from "../hooks/useLiveQueue.js";

interface WaitingViewProps {
  isConnected: boolean;
  isConnecting: boolean;
  queue: Queue | null;
  onNavigate: (path: string) => void;
}

export default function WaitingView({ isConnected, isConnecting, queue, onNavigate }: WaitingViewProps) {
  const [localTime, setLocalTime] = useState<string>("");
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [showCallFlash, setShowCallFlash] = useState(false);
  const prevTokenNumRef = useRef<number | null>(null);
  const isFirstChimeRenderRef = useRef(true);

  const liveQueue = useLiveQueue(queue);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setLocalTime(now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const inProgressToken = liveQueue?.tokens.find(t => t.status === "in-progress") || null;
  const waitingTokens = (liveQueue?.tokens.filter(t => t.status === "waiting") || [])
    .sort((a, b) => a.tokenNumber - b.tokenNumber);
  const nextUpToken = waitingTokens[0]?.tokenNumber ?? null;
  const nextUpWaitMinutes = waitingTokens[0]?.estimatedWaitMinutes ?? 0;

  useEffect(() => {
    if (!inProgressToken || !inProgressToken.calledAt) {
      setElapsedSeconds(0);
      return;
    }
    const updateTimer = () => {
      const start = new Date(inProgressToken.calledAt!).getTime();
      const diffSecs = Math.max(0, Math.floor((Date.now() - start) / 1000));
      setElapsedSeconds(diffSecs);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [inProgressToken]);

  const formatElapsedTime = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const activeTokenNum = inProgressToken ? inProgressToken.tokenNumber : null;
  const activePatientName = inProgressToken ? inProgressToken.patientName : "No patient active";

  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Osc 1: D5 (587.33Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
      gain1.gain.setValueAtTime(0.08, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      // Osc 2: A5 (880.00Hz) playing 0.15s later
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880.00, ctx.currentTime + 0.15);
      gain2.gain.setValueAtTime(0.08, ctx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.95);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.8);

      osc2.start(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.95);
    } catch (e) {
      console.warn("AudioContext failed to play chime:", e);
    }
  };

  useEffect(() => {
    if (isFirstChimeRenderRef.current) {
      isFirstChimeRenderRef.current = false;
      prevTokenNumRef.current = activeTokenNum;
      return;
    }

    if (activeTokenNum !== null && activeTokenNum !== prevTokenNumRef.current) {
      playChime();
      setShowCallFlash(true);
      const timer = setTimeout(() => {
        setShowCallFlash(false);
      }, 3500);
      prevTokenNumRef.current = activeTokenNum;
      return () => clearTimeout(timer);
    }

    if (activeTokenNum === null) {
      prevTokenNumRef.current = null;
    }
  }, [activeTokenNum]);

  const getProgressMinutes = (createdAtStr: string): number => {
    const start = new Date(createdAtStr).getTime();
    const diffMs = Date.now() - start;
    return Math.floor(diffMs / (1000 * 60));
  };

  const getProgressPercentage = (createdAtStr: string, estimatedWait: number | undefined): number => {
    if (!estimatedWait || estimatedWait <= 0) return 0;
    const elapsed = getProgressMinutes(createdAtStr);
    return Math.min(100, Math.max(0, (elapsed / estimatedWait) * 100));
  };

  const renderProgressRing = (progressPercent: number) => {
    const radius = 9;
    const strokeWidth = 2.5;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

    return (
      <svg className="w-5 h-5 shrink-0 transform -rotate-90" viewBox="0 0 24 24">
        <circle
          cx="12"
          cy="12"
          r={radius}
          className="stroke-slate-100"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx="12"
          cy="12"
          r={radius}
          className="stroke-teal-500 transition-all duration-300"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
    );
  };

  const getCongestionBadge = () => {
    const count = waitingTokens.length;
    let label = "Flow: Calm";
    let bgClass = "bg-teal-50/50 text-teal-700 border-teal-100/50";
    let dotClass = "bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.6)]";

    if (count > 6) {
      label = "Flow: Busy";
      bgClass = "bg-rose-50/50 text-rose-700 border-rose-100/50";
      dotClass = "bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]";
    } else if (count > 3) {
      label = "Flow: Moderate";
      bgClass = "bg-amber-50/50 text-amber-700 border-amber-100/50";
      dotClass = "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]";
    }

    return (
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${bgClass} backdrop-blur-xs`}>
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass} animate-pulse`}></span>
        {label}
      </div>
    );
  };

  const getDoctorStatusBadge = () => {
    let label = "Offline";
    let dotClass = "bg-slate-300 shadow-none";

    if (isConnected) {
      if (inProgressToken) {
        label = "Doctor Active";
        dotClass = "bg-teal-500 animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.6)]";
      } else {
        label = "Chamber Ready";
        dotClass = "bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]";
      }
    }

    return (
      <div className="flex items-center gap-2 bg-slate-50 border border-slate-100/60 px-4.5 py-2 rounded-full backdrop-blur-xs">
        <span className={`h-2 w-2 rounded-full ${dotClass}`}></span>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
      </div>
    );
  };

  const getInitialsAvatar = (name: string, token: number) => {
    const initials = name.trim().charAt(0).toUpperCase() || "P";
    const colors = [
      "bg-teal-50 text-teal-700 border-teal-100/60",
      "bg-indigo-50 text-indigo-700 border-indigo-100/60",
      "bg-amber-50 text-amber-700 border-[#EFECE6]",
      "bg-rose-50 text-rose-700 border-rose-100/60",
      "bg-emerald-50 text-emerald-700 border-emerald-100/60",
      "bg-purple-50 text-purple-700 border-purple-100/60"
    ];
    const colorClass = colors[token % colors.length];
    return (
      <div className={`w-10 h-10 rounded-full border flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs ${colorClass}`}>
        {initials}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#3C3835] font-sans flex flex-col p-6 sm:p-8 lg:p-10 select-none antialiased selection:bg-teal-50 page-enter">
      <ConnectionBanner isConnected={isConnected} isConnecting={isConnecting} />

      {/* Full-screen call announcement */}
      <AnimatePresence>
        {showCallFlash && inProgressToken && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-teal-950/20 backdrop-blur-sm pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.05, opacity: 0 }}
              className="text-center px-8"
            >
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-700 mb-4">Now Serving</p>
              <p className="text-7xl sm:text-8xl font-serif italic text-teal-600 token-glow">
                Token {activeTokenNum}
              </p>
              <p className="text-2xl sm:text-3xl font-medium text-slate-800 mt-4">{activePatientName}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="bg-white/40 backdrop-blur-md rounded-3xl border border-[#EFECE6] px-6 sm:px-8 py-5 mb-8 shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-5 relative z-10">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-serif text-slate-900">QueueCure</h1>
            <span className="text-[10px] font-bold uppercase tracking-widest text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-100/40">Waiting Room</span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            {queue?.doctorName ?? (isConnecting ? "Connecting…" : "Waiting room display")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => onNavigate("/")}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-[#EFECE6] hover:bg-slate-50 transition px-4.5 py-2 rounded-full flex items-center gap-2 shadow-2xs cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Home
          </button>

          <ConnectionBadge isConnected={isConnected} isConnecting={isConnecting} />
          {getCongestionBadge()}
          {getDoctorStatusBadge()}

          <div className="flex items-center gap-2 bg-white border border-[#EFECE6] text-slate-700 px-4.5 py-2 rounded-full shadow-2xs">
            <Clock className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium tabular-nums">{localTime || "—"}</span>
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <main className="lg:col-span-8 flex flex-col bg-white border border-[#EFECE6] rounded-[2.5rem] p-8 sm:p-10 lg:p-12 shadow-[0_15px_45px_rgba(0,0,0,0.015)] relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pb-8 border-b border-[#EFECE6]">
            <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full uppercase tracking-wider block w-fit border border-teal-100/40">NOW SERVING</span>
            {inProgressToken && (
              <div className="text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-100/50 px-4 py-2 rounded-full flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-400 animate-pulse" />
                Duration {formatElapsedTime(elapsedSeconds)}
              </div>
            )}
          </div>

          <div className="flex-1 flex items-center justify-center relative">
            {!queue ? (
              <div className="text-center py-24 flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 text-teal-600 animate-spin" />
                <p className="text-slate-400 font-light">Loading live queue…</p>
              </div>
            ) : inProgressToken ? (
              <motion.div
                key={activeTokenNum}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
                className="text-center py-16"
                id="tv-now-serving-block"
              >
                <p className="text-sm font-medium text-slate-500 mb-6 tracking-wide">
                  Please proceed to the consultation room
                </p>
                <h2 className="text-8xl sm:text-9xl lg:text-[10rem] font-serif italic text-teal-600 leading-none token-glow">
                  Token {activeTokenNum}
                </h2>
                <h3 className="text-4xl sm:text-5xl lg:text-6xl font-medium text-slate-900 mt-8 tracking-tight max-w-3xl mx-auto leading-tight">
                  {activePatientName}
                </h3>
              </motion.div>
            ) : (
              <div className="text-center py-24" id="tv-idle-serving-block">
                <span className="inline-flex h-3 w-3 rounded-full bg-slate-300 mb-6 breathe"></span>
                <h3 className="text-4xl font-serif text-slate-900 font-light">Waiting for next call</h3>
                <p className="text-base text-slate-500 mt-3 max-w-md mx-auto leading-relaxed">
                  Your token will appear here when the doctor is ready for you.
                </p>
                {waitingTokens.length > 0 && nextUpToken !== null && (
                  <p className="text-sm text-teal-700 mt-6 bg-teal-50 inline-block px-4 py-2 rounded-full border border-teal-100/50">
                    Up next: Token {nextUpToken}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-8 border-t border-[#EFECE6]">
            <div className="bg-[#FAF8F5]/80 border border-[#EFECE6] p-6 rounded-2xl">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-2">In queue</span>
              <span className="text-3xl font-semibold text-slate-900 font-serif">{waitingTokens.length}</span>
            </div>
            <div className="bg-[#FAF8F5]/80 border border-[#EFECE6] p-6 rounded-2xl">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-2">Est. wait (next)</span>
              <span className="text-3xl font-semibold text-slate-900 font-serif">
                {nextUpToken !== null ? `~${nextUpWaitMinutes} min` : "—"}
              </span>
            </div>
            <div className="hidden sm:block bg-teal-50/20 border border-teal-100/20 p-6 rounded-2xl">
              <span className="text-[10px] font-semibold text-teal-700 uppercase tracking-wide block mb-2">Up next</span>
              <span className="text-3xl font-semibold text-teal-800 font-serif">
                {nextUpToken !== null ? nextUpToken : "—"}
              </span>
            </div>
          </div>

          {/* Siri-style animated soundwave gradient overlay */}
          <AnimatePresence>
            {showCallFlash && (
              <motion.div
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0 }}
                className="absolute bottom-0 inset-x-0 h-10 overflow-hidden rounded-b-[2rem] pointer-events-none"
              >
                <svg className="w-full h-full" viewBox="0 0 400 40" preserveAspectRatio="none">
                  <path
                    d="M0,20 Q100,5 200,20 T400,20"
                    fill="none"
                    stroke="url(#siri-gradient)"
                    strokeWidth="3"
                    style={{
                      strokeDasharray: "10 5",
                      animation: "wave1 2s ease-in-out infinite alternate"
                    }}
                  />
                  <path
                    d="M0,20 Q100,35 200,20 T400,20"
                    fill="none"
                    stroke="url(#siri-gradient-secondary)"
                    strokeWidth="2.5"
                    className="opacity-70"
                    style={{
                      strokeDasharray: "15 8",
                      animation: "wave2 1.5s ease-in-out infinite alternate"
                    }}
                  />
                  <defs>
                    <linearGradient id="siri-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.8" />
                      <stop offset="50%" stopColor="#6366F1" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#14B8A6" stopOpacity="0.8" />
                    </linearGradient>
                    <linearGradient id="siri-gradient-secondary" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#6366F1" stopOpacity="0.5" />
                      <stop offset="50%" stopColor="#14B8A6" stopOpacity="0.7" />
                      <stop offset="100%" stopColor="#6366F1" stopOpacity="0.5" />
                    </linearGradient>
                  </defs>
                </svg>
                <style>{`
                  @keyframes wave1 {
                    0% { transform: translateY(-4px) scaleY(0.8); }
                    100% { transform: translateY(4px) scaleY(1.2); }
                  }
                  @keyframes wave2 {
                    0% { transform: translateY(3px) scaleY(1.1); }
                    100% { transform: translateY(-3px) scaleY(0.7); }
                  }
                `}</style>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <aside className="lg:col-span-4 flex flex-col gap-6">
          <section className="bg-white border border-[#EFECE6] rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.015)] flex-1 flex flex-col">
            <div className="mb-6">
              <h2 className="text-xl font-serif text-slate-900 tracking-tight">Upcoming</h2>
              <p className="text-xs text-slate-500 mt-1">Wait times refresh automatically every 30 seconds.</p>
            </div>

            {waitingTokens.length > 0 ? (
              <div className="divide-y divide-[#EFECE6] flex-1">
                {waitingTokens.slice(0, 5).map((token, idx) => (
                  <motion.div
                    layout
                    key={token.tokenNumber}
                    initial={false}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    className={`py-5 px-4 -mx-4 rounded-2xl flex items-center justify-between gap-4 transition-colors duration-200 ${
                      idx === 0 ? "bg-teal-50/30" : "hover:bg-[#FAF8F5]/50"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className={`text-sm font-semibold w-6 ${idx === 0 ? "text-teal-600" : "text-slate-400"}`}>
                        #{idx + 1}
                      </span>
                      {getInitialsAvatar(token.patientName, token.tokenNumber)}
                      <div className="min-w-0">
                        <span className="text-base font-semibold text-slate-900 block truncate">Token {token.tokenNumber}</span>
                        <span className="text-xs text-slate-500 truncate block mt-0.5">{token.patientName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      {renderProgressRing(getProgressPercentage(token.createdAt, token.estimatedWaitMinutes))}
                      <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full whitespace-nowrap">
                        ~{token.estimatedWaitMinutes || 0} min
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Users}
                title="No patients waiting"
                description="The queue is empty. New tokens will appear here automatically."
              />
            )}

            {waitingTokens.length > 5 && (
              <div className="text-sm text-center text-slate-400 pt-5 border-t border-[#EFECE6] font-medium">
                + {waitingTokens.length - 5} more waiting
              </div>
            )}
          </section>

          <section className="bg-white border border-[#EFECE6] rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-2 w-2 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isConnected ? "bg-teal-400" : "bg-rose-400"} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? "bg-teal-500" : "bg-rose-500"}`}></span>
              </span>
              <div>
                <span className="text-sm font-medium text-[#3C3835] block">Live Updates</span>
                <span className="text-xs text-slate-400 mt-0.5 block">Queue updates automatically</span>
              </div>
            </div>
            <span className="text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-100/50 px-3 py-1 rounded-full">
              {isConnected ? "Connected" : "Offline"}
            </span>
          </section>
        </aside>
      </div>

      <footer className="mt-8 text-center text-xs text-slate-400 select-none">
        Chamber 1 display · {window.location.hostname}
      </footer>
    </div>
  );
}
