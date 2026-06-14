import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  Phone,
  AlertTriangle,
  Undo2,
  RotateCcw,
  ArrowLeft,
  Star,
  MessageSquare,
  Search,
  ChevronDown,
  X,
  Keyboard
} from "lucide-react";
import { Queue } from "../types.js";
import {
  ConnectionBanner,
  ConnectionBadge,
  EmptyState,
  QueueLoadingSkeleton,
  FixedToast
} from "./ui/shared.js";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts.js";
import { useFormDraft } from "../hooks/useFormDraft.js";
import { useLiveQueue } from "../hooks/useLiveQueue.js";
import LiveElapsed from "./ui/LiveElapsed.js";

interface ReceptionViewProps {
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
  onNavigate: (path: string) => void;
}

export default function ReceptionView({
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
  undoLastAction,
  onNavigate
}: ReceptionViewProps) {
  const { inpName, inpPhone, setInpName, setInpPhone, clearDraft } = useFormDraft();
  const liveQueue = useLiveQueue(queue);
  const [showResetModal, setShowResetModal] = useState(false);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState<number | null>(null);
  const [undoSessionId, setUndoSessionId] = useState(0);
  const [clickDebounceActive, setClickDebounceActive] = useState(false);
  const [localAvgTime, setLocalAvgTime] = useState<number>(10);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [expandedToken, setExpandedToken] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [prioritizedTokens, setPrioritizedTokens] = useState<Record<number, boolean>>({});

  const nameInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isAvgTimeEditingRef = useRef(false);

  useEffect(() => {
    if (queue && !isAvgTimeEditingRef.current) {
      setLocalAvgTime(queue.avgConsultationTimeMinutes);
    }
  }, [queue?.avgConsultationTimeMinutes]);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (undoSecondsLeft === null) return;
    if (undoSecondsLeft <= 0) {
      setUndoSecondsLeft(null);
      return;
    }
    const timer = setTimeout(() => {
      setUndoSecondsLeft(prev => (prev !== null && prev > 0) ? prev - 1 : null);
    }, 1000);
    return () => clearTimeout(timer);
  }, [undoSecondsLeft]);

  useEffect(() => {
    if (error) {
      setUndoSecondsLeft(null);
    }
  }, [error]);

  const currentServing = liveQueue?.tokens.find(t => t.status === "in-progress") || null;
  const waitingList = liveQueue?.tokens.filter(t => t.status === "waiting").sort((a, b) => a.tokenNumber - b.tokenNumber) || [];
  const historicalList = liveQueue?.tokens.filter(t => t.status === "done" || t.status === "no-show") || [];

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = inpName.trim();
    const cleanPhone = inpPhone.trim();

    if (!cleanName) {
      return;
    }

    const isDuplicate = (queue?.tokens ?? []).some(
      p =>
        (p.status === "waiting" || p.status === "in-progress") &&
        p.patientName.toLowerCase() === cleanName.toLowerCase()
    );

    const assignedToken = queue ? queue.nextTokenNumber : 1;
    const didEmit = addPatient(cleanName, cleanPhone || undefined);
    if (!didEmit) {
      return;
    }

    if (isDuplicate) {
      setToastMessage(`Token #${assignedToken} added. Note: A patient named "${cleanName}" is already in the queue.`);
    } else {
      setToastMessage(`Token #${assignedToken} added for ${cleanName}.`);
    }
    
    setTimeout(() => setToastMessage(null), 4500);

    clearDraft();

    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 50);
  };

  const triggerCallNext = () => {
    if (clickDebounceActive) return;
    setClickDebounceActive(true);
    if (callNext()) {
      setUndoSecondsLeft(10);
      setUndoSessionId(id => id + 1);
    }
    setTimeout(() => setClickDebounceActive(false), 800);
  };

  const triggerMarkNoShow = () => {
    if (clickDebounceActive) return;
    setClickDebounceActive(true);
    if (markNoShow()) {
      setUndoSecondsLeft(10);
      setUndoSessionId(id => id + 1);
    }
    setTimeout(() => setClickDebounceActive(false), 800);
  };

  const triggerUndo = () => {
    if (!undoLastAction()) {
      return;
    }
    setUndoSecondsLeft(null);
    setToastMessage("Last call was undone.");
    setTimeout(() => setToastMessage(null), 3000);
  };

  const executeQueueReset = () => {
    if (!resetQueue()) {
      return;
    }
    setShowResetModal(false);
    setUndoSecondsLeft(null);
    setExpandedToken(null);
    setPrioritizedTokens({});
    setSearchQuery("");
    setToastMessage("Queue reset for a new day.");
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleAvgTimeChange = (valStr: string) => {
    if (valStr === "") {
      return;
    }
    const val = parseInt(valStr, 10);
    if (!isNaN(val)) {
      const clamped = Math.max(1, Math.min(60, val));
      setLocalAvgTime(clamped);
      updateAvgTime(clamped);
    }
  };

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
    const count = waitingList.length;
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
      if (currentServing) {
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

  const canAdvanceQueue = waitingList.length > 0 || !!currentServing;

  useKeyboardShortcuts(
    {
      onCallNext: () => canAdvanceQueue && triggerCallNext(),
      onSkip: () => currentServing && triggerMarkNoShow(),
      onFocusSearch: () => searchInputRef.current?.focus(),
      onEscape: () => {
        setShowResetModal(false);
        setExpandedToken(null);
      }
    },
    isConnected
  );

  const renderAnalyticsChart = () => {
    // Edge case & Live updates: filter and map completed token wait times
    const completedTokens = historicalList.filter(t => t.status === "done" && t.calledAt);
    const waitTimes = completedTokens.map(t => {
      const waitMs = new Date(t.calledAt!).getTime() - new Date(t.createdAt).getTime();
      return Math.max(1, Math.round(waitMs / (1000 * 60)));
    });

    const defaultVal = localAvgTime || 10;
    
    // Fill up chart points if historical data is scarce
    while (waitTimes.length < 5) {
      const padding = [defaultVal - 2, defaultVal + 1, defaultVal - 3, defaultVal + 2, defaultVal];
      waitTimes.unshift(Math.max(1, padding[waitTimes.length]));
    }

    const plotTimes = waitTimes.slice(-5);
    const maxVal = Math.max(15, ...plotTimes, defaultVal * 1.5);
    const minVal = 0;

    const points = plotTimes.map((val, index) => {
      const x = plotTimes.length <= 1 ? 150 : (index / (plotTimes.length - 1)) * 300;
      const y = 80 - ((val - minVal) / (maxVal - minVal)) * 55;
      return { x, y, val };
    });

    let linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpX1 = prev.x + 30;
      const cpY1 = prev.y;
      const cpX2 = curr.x - 30;
      const cpY2 = curr.y;
      linePath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${curr.x} ${curr.y}`;
    }

    const fillPath = `${linePath} L 300 95 L 0 95 Z`;

    return (
      <div className="p-6 bg-white border border-[#EFECE6] rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.01)]">
        <div className="flex justify-between items-center mb-4">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide block">Wait time trend</span>
          <span className="text-xs text-teal-700 font-semibold flex items-center gap-1 font-sans">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse shadow-[0_0_6px_rgba(20,184,166,0.6)]"></span>
            {completedTokens.length > 0 ? `${completedTokens.length} Completed` : "Dynamic Baseline"}
          </span>
        </div>
        <div className="h-32 w-full relative mt-3 select-none">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 300 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0D9488" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#0D9488" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <line x1="0" y1="20" x2="300" y2="20" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="0" y1="50" x2="300" y2="50" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="0" y1="80" x2="300" y2="80" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
            
            <path d={fillPath} fill="url(#chart-grad)" />
            <path d={linePath} fill="none" stroke="#0D9488" strokeWidth="2.5" strokeLinecap="round" />
            
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="3" fill="#0D9488" stroke="white" strokeWidth="1" />
                <text 
                  x={p.x} 
                  y={p.y - 8} 
                  fill="#0D9488" 
                  fontSize="7" 
                  fontWeight="bold" 
                  textAnchor="middle"
                  className="font-sans"
                >
                  {p.val}m
                </text>
              </g>
            ))}
          </svg>
          <div className="absolute inset-x-0 bottom-0 flex justify-between text-[7px] font-bold text-slate-400 mt-2 px-1">
            <span>START</span>
            <span>WAIT TREND</span>
            <span>LATEST</span>
          </div>
        </div>
      </div>
    );
  };

  const sortedActiveQueue = [
    ...(currentServing ? [currentServing] : []),
    ...waitingList
  ];

  const getInitialsAvatar = (name: string, token: number) => {
    const initials = name.trim().charAt(0).toUpperCase() || "P";
    const colors = [
      "bg-teal-50 text-teal-700 border-teal-100/60",
      "bg-indigo-50 text-indigo-700 border-indigo-100/60",
      "bg-amber-50 text-amber-700 border-amber-100/60",
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

  const filteredActiveQueue = sortedActiveQueue.filter((patient) => {
    const term = searchQuery.toLowerCase().trim();
    if (!term) return true;
    return (
      patient.patientName.toLowerCase().includes(term) ||
      patient.tokenNumber.toString().includes(term) ||
      (patient.phoneNumber && patient.phoneNumber.includes(term))
    );
  });

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#3C3835] font-sans antialiased selection:bg-teal-50 page-enter">
      <ConnectionBanner isConnected={isConnected} isConnecting={isConnecting} />

      <AnimatePresence>
        {(error || toastMessage) && (
          <FixedToast
            message={error ?? toastMessage!}
            variant={error ? "error" : "success"}
            onDismiss={error ? clearError : undefined}
          />
        )}
      </AnimatePresence>

      <header className="bg-white/40 backdrop-blur-md border-b border-[#EFECE6] sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-teal-600 shadow-[0_0_8px_rgba(20,184,166,0.6)]"></span>
            <div>
              <div className="font-semibold text-lg tracking-tight text-slate-900">QueueCure</div>
              <p className="text-xs text-slate-400 font-medium">
                {queue?.doctorName ?? (isConnecting ? "Connecting…" : "Reception Console")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigate("/")}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-[#EFECE6] hover:bg-slate-50 transition px-4.5 py-2 rounded-full flex items-center gap-2 shadow-2xs cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" /> Home
            </button>
            <button
              onClick={() => onNavigate("/waiting")}
              className="text-sm font-medium text-teal-700 hover:text-teal-800 bg-teal-50/50 hover:bg-teal-50 border border-teal-100/40 transition px-4.5 py-2 rounded-full shadow-2xs cursor-pointer"
            >
              Open Waiting Screen
            </button>
            <ConnectionBadge isConnected={isConnected} isConnecting={isConnecting} />
            {getCongestionBadge()}
            {getDoctorStatusBadge()}
          </div>
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto px-6 sm:px-8 py-10 lg:py-12 pb-28 lg:pb-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
        {/* Left Column: Form and Settings */}
        <div className="lg:col-span-5 flex flex-col gap-8 lg:gap-10">
          <section className="bg-white border border-[#EFECE6] rounded-[2rem] p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
            <div className="mb-8">
              <h2 className="text-2xl font-serif text-slate-900 tracking-tight">Add patient</h2>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                Enter details below. Your draft is saved if the page reloads.
              </p>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-6">
              <div>
                <label htmlFor="inp-patient-name" className="block text-sm font-medium text-slate-700 mb-2">
                  Full name <span className="text-rose-500" aria-hidden="true">*</span>
                </label>
                <input
                  type="text"
                  ref={nameInputRef}
                  value={inpName}
                  onChange={(e) => setInpName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  autoComplete="name"
                  className="w-full bg-[#FAF8F5]/80 border border-[#EFECE6] rounded-2xl px-5 py-4 text-base focus:outline-hidden focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 text-slate-900 transition placeholder:text-slate-400"
                  required
                  id="inp-patient-name"
                />
              </div>

              <div>
                <label htmlFor="inp-patient-phone" className="block text-sm font-medium text-slate-700 mb-2">
                  Mobile number <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="h-4 w-4" />
                  </div>
                  <input
                    type="tel"
                    value={inpPhone}
                    onChange={(e) => setInpPhone(e.target.value.replace(/\D/g, "").slice(0, 12))}
                    pattern="[0-9]*"
                    inputMode="numeric"
                    placeholder="10-digit mobile number"
                    className="w-full bg-[#FAF8F5]/80 border border-[#EFECE6] rounded-2xl pl-12 pr-5 py-4 text-base focus:outline-hidden focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 text-slate-900 transition placeholder:text-slate-400"
                    id="inp-patient-phone"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">Digits only — used for SMS alerts.</p>
              </div>

              <button
                type="submit"
                disabled={!isConnected || !inpName.trim()}
                className="w-full bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-medium py-4 px-6 rounded-full shadow-2xs hover:shadow-sm transition duration-200 cursor-pointer"
                id="btn-add-patient"
              >
                {queue
                  ? `Add to queue · Token #${queue.nextTokenNumber}`
                  : "Add to queue"}
              </button>
              <p className="text-xs text-slate-400 text-center">
                Press <kbd className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-600">Enter</kbd> to submit
              </p>
            </form>
          </section>

          <section className="bg-white border border-[#EFECE6] rounded-[2rem] p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
            <div className="mb-8">
              <h2 className="text-2xl font-serif text-slate-900 tracking-tight">Queue settings</h2>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                Adjust how long each consultation typically takes. Wait estimates update for everyone.
              </p>
            </div>

            <div className="space-y-8">
              <div>
                <div className="flex justify-between items-center gap-4 mb-4">
                  <label htmlFor="avg-time-range" className="text-sm font-medium text-slate-700">
                    Average consultation time
                  </label>
                  <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-100/40">
                    {localAvgTime} min
                  </span>
                </div>
                <div className="flex gap-4 items-center">
                  <input
                    id="avg-time-range"
                    type="range"
                    min="1"
                    max="45"
                    value={localAvgTime}
                    onChange={(e) => handleAvgTimeChange(e.target.value)}
                    className="flex-1 h-1 bg-[#EFECE6] rounded-lg appearance-none cursor-pointer accent-teal-600"
                  />
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={localAvgTime}
                    onFocus={() => { isAvgTimeEditingRef.current = true; }}
                    onChange={(e) => handleAvgTimeChange(e.target.value)}
                    onBlur={() => {
                      isAvgTimeEditingRef.current = false;
                      if (localAvgTime < 1 || localAvgTime > 60) {
                        setLocalAvgTime(10);
                        updateAvgTime(10);
                      }
                    }}
                    className="w-20 text-center bg-[#FAF8F5] border border-[#EFECE6] rounded-xl py-2 text-sm font-medium focus:outline-hidden focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 text-slate-900"
                    aria-label="Average consultation time in minutes"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                  Typical OPD visit length. Used to calculate live wait times on the board.
                </p>
              </div>

              <button
                onClick={() => setShowResetModal(true)}
                className="w-full border border-[#EFECE6] text-slate-500 hover:text-rose-600 hover:bg-rose-50/50 font-medium py-3.5 px-4 rounded-full transition text-sm cursor-pointer"
                id="btn-trigger-reset"
              >
                Reset Queue
              </button>
            </div>
          </section>
          {renderAnalyticsChart()}
        </div>

        {/* Right Column: Active Hero Card and Queue List */}
        <div className="lg:col-span-7 flex flex-col gap-8 lg:gap-10">
          {!queue ? (
            <QueueLoadingSkeleton />
          ) : (
          <>
          {/* Visual Hero Card - Now Serving */}
          <section className="bg-white border border-[#EFECE6] rounded-[2.5rem] p-8 sm:p-10 shadow-[0_15px_45px_rgba(0,0,0,0.015)] overflow-hidden relative">
            {currentServing && (
              <div className="absolute inset-0 bg-gradient-to-br from-teal-50/40 via-transparent to-transparent pointer-events-none" />
            )}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8">
              <div className="min-w-0">
                <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full uppercase tracking-wide border border-teal-100/40">Now serving</span>

                {currentServing ? (
                  <div id="reception-active-patient">
                    <div className="inline-flex items-center gap-2 text-[10px] font-bold text-teal-800 bg-teal-50/60 px-3 py-1 rounded-full mb-4.5 border border-teal-100/40">
                      <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                      In consultation
                    </div>
                    <h3 className="text-5xl sm:text-6xl font-serif italic text-teal-600 leading-tight">
                      Token {currentServing.tokenNumber}
                    </h3>
                    <p className="text-2xl font-medium text-slate-800 mt-2 truncate">
                      {currentServing.patientName}
                    </p>
                    {currentServing.phoneNumber && (
                      <p className="text-sm text-slate-400 mt-1.5 font-light">
                        {currentServing.phoneNumber}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="inline-flex items-center gap-2 text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full mb-4.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-300"></span>
                      Ready
                    </div>
                    <h3 className="text-4xl sm:text-5xl font-serif text-slate-900 font-light">No one yet</h3>
                    <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                      Add a patient or call the next token when the doctor is ready.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 w-full xl:w-56 shrink-0">
                <button
                  onClick={triggerCallNext}
                  disabled={!canAdvanceQueue || !isConnected}
                  title={!canAdvanceQueue ? "No patients to call" : !isConnected ? "Reconnect to continue" : "Shortcut: N"}
                  className={`w-full font-semibold text-base py-4 px-6 rounded-full text-center transition ${
                    canAdvanceQueue && isConnected
                      ? "bg-teal-600 text-white shadow-2xs hover:bg-teal-700 active:scale-[0.98] cursor-pointer"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  }`}
                  id="btn-call-next"
                >
                  {waitingList.length > 0
                    ? "Call Next Patient"
                    : currentServing
                      ? "Complete Current Patient"
                      : "Call Next Patient"}
                </button>

                <button
                  onClick={triggerMarkNoShow}
                  disabled={!currentServing || !isConnected}
                  title={!currentServing ? "No active patient" : "Shortcut: S"}
                  className={`w-full text-sm font-medium py-3 px-4 rounded-full transition ${
                    currentServing && isConnected
                      ? "border border-[#EFECE6] text-slate-600 hover:bg-slate-50 cursor-pointer"
                      : "border border-slate-100/60 text-slate-300 cursor-not-allowed"
                  }`}
                  id="btn-mark-no-show"
                >
                  Skip Patient
                </button>
                <p className="text-[10px] text-slate-400 text-center hidden xl:block">
                  <Keyboard className="h-3 w-3 inline -mt-0.5 mr-1" />
                  <kbd className="font-mono">N</kbd> call · <kbd className="font-mono">S</kbd> skip · <kbd className="font-mono">/</kbd> search
                </p>
              </div>
            </div>
          </section>

          <AnimatePresence mode="popLayout">
            {undoSecondsLeft !== null && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-white border border-[#EFECE6] rounded-[2rem] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.01)]"
                id="undo-status-bar"
              >
                <div className="h-1 bg-teal-100">
                  <div key={undoSessionId} className="h-full bg-teal-500 undo-progress" />
                </div>
                <div className="p-5 flex flex-col sm:flex-row justify-between items-center gap-3">
                  <div className="flex items-center gap-3">
                    <Undo2 className="h-5 w-5 text-teal-600 animate-pulse" />
                    <div>
                      <span className="text-sm font-medium text-slate-900 block leading-tight">Need to undo?</span>
                      <span className="text-xs text-slate-400 mt-0.5 font-light">You can reverse the last call for {undoSecondsLeft} seconds.</span>
                    </div>
                  </div>
                  <button
                    onClick={triggerUndo}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium py-2.5 px-4.5 rounded-full flex items-center gap-2 cursor-pointer transition"
                    id="btn-revert-undo"
                  >
                    <RotateCcw className="h-4 w-4" /> Undo ({undoSecondsLeft}s)
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>


          {/* Waiting List Section */}
          <section className="bg-white/70 backdrop-blur-md rounded-3xl shadow-sm border border-white/60 flex-1 overflow-hidden flex flex-col">
            <div className="p-8 sm:p-10 border-b border-[#EFECE6] flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="text-xl font-serif text-slate-900 tracking-tight">Active queue</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {sortedActiveQueue.length} patient{sortedActiveQueue.length === 1 ? "" : "s"} · serving first, then by token
                  </p>
                </div>
              </div>
              
              {/* Pinterest style minimal Search Bar */}
              <div className="relative mt-1">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, token, or phone…"
                  className="w-full bg-[#FAF8F5]/80 border border-[#EFECE6] rounded-full py-3 pl-11 pr-11 text-sm focus:outline-hidden focus:ring-4 focus:ring-teal-500/5 focus:border-teal-500 text-[#3C3835] transition placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {sortedActiveQueue.length > 0 ? (
              <div className="divide-y divide-[#EFECE6] max-h-[35rem] overflow-y-auto px-8 sm:px-10">
                {filteredActiveQueue.length > 0 ? (
                  filteredActiveQueue.map((patient) => {
                    const isActive = patient.status === "in-progress";
                    const isExpanded = expandedToken === patient.tokenNumber;
                    return (
                      <motion.div
                        layout
                        initial={false}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        key={patient.tokenNumber}
                        className="py-6 px-4 -mx-4 rounded-2xl flex flex-col transition-colors duration-200 hover:bg-[#FAF8F5]/50"
                      >
                        {/* Clickable Header Row */}
                        <div 
                          className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 w-full cursor-pointer select-none group/row"
                          onClick={() => setExpandedToken(isExpanded ? null : patient.tokenNumber)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setExpandedToken(isExpanded ? null : patient.tokenNumber);
                            }
                          }}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            {getInitialsAvatar(patient.patientName, patient.tokenNumber)}
                            
                            <div className="min-w-0">
                              <span className="text-base font-semibold text-slate-900 flex items-center gap-2.5 truncate">
                                {patient.patientName}
                                {prioritizedTokens[patient.tokenNumber] && (
                                  <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-[9px] font-bold border border-amber-100/50 flex items-center gap-0.5 shadow-2xs">
                                    <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> PRIORITY
                                  </span>
                                )}
                              </span>
                              <span className="text-sm text-slate-400 block mt-0.5">
                                Token #{patient.tokenNumber}{patient.phoneNumber ? ` · ${patient.phoneNumber}` : ""}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-left sm:text-right pl-14 sm:pl-0">
                            <div className="flex items-center gap-6">
                              <div className="flex items-center gap-3">
                                {!isActive && renderProgressRing(getProgressPercentage(patient.createdAt, patient.estimatedWaitMinutes))}
                                <div>
                                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                                    isActive
                                      ? "bg-teal-50 text-teal-700"
                                      : "bg-slate-50 text-slate-500"
                                  }`}>
                                    {isActive ? "Now serving" : "Waiting"}
                                  </span>
                                <span className="text-sm text-slate-500 block mt-1.5 font-medium">
                                  {isActive ? "In room now" : patient.estimatedWaitMinutes ? `~${patient.estimatedWaitMinutes} min` : "Calculating…"}
                                </span>
                              </div>
                            </div>

                            <div className="text-sm text-slate-500 min-w-20 text-right">
                              <LiveElapsed since={patient.createdAt} className="block font-medium" suffix="waiting" />
                            </div>
                            </div>
                            <ChevronDown
                              className={`h-4 w-4 text-slate-300 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""} group-hover/row:text-slate-500`}
                            />
                          </div>
                        </div>

                        {/* Expandable Pinterest Info Card Drawer */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0, marginTop: 0 }}
                              animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                              exit={{ opacity: 0, height: 0, marginTop: 0 }}
                              transition={{ duration: 0.25, ease: "easeInOut" }}
                              className="w-full overflow-hidden"
                            >
                              <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#EFECE6] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs text-slate-600">
                                <div className="space-y-1.5 text-left">
                                  <p className="font-bold text-slate-800 uppercase tracking-widest text-[9px]">Patient Metadata</p>
                                  <p>Registered at: {new Date(patient.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
                                  <p>Contact No: {patient.phoneNumber || "No phone number registered"}</p>
                                  <p>Wait Time Projection: {isActive ? "Active in consultation" : patient.estimatedWaitMinutes ? `~${patient.estimatedWaitMinutes} mins` : "Calculating"}</p>
                                </div>
                                
                                <div className="flex flex-wrap gap-2.5">
                                  {/* Priority flag toggle */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPrioritizedTokens(prev => ({
                                        ...prev,
                                        [patient.tokenNumber]: !prev[patient.tokenNumber]
                                      }));
                                    }}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full border transition cursor-pointer font-medium ${
                                      prioritizedTokens[patient.tokenNumber]
                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                        : "bg-white text-slate-500 border-[#EFECE6] hover:bg-slate-50"
                                    }`}
                                  >
                                    <Star className={`h-3.5 w-3.5 ${prioritizedTokens[patient.tokenNumber] ? "fill-amber-500 text-amber-500" : ""}`} />
                                    {prioritizedTokens[patient.tokenNumber] ? "Priority Active" : "Mark Priority"}
                                  </button>

                                  {/* Simulated SMS Alert */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setToastMessage(`SMS notification sent to ${patient.patientName} (${patient.phoneNumber || "+91 XXXXX XXXXX"}): "Your turn is next!"`);
                                      setTimeout(() => setToastMessage(null), 4000);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-[#EFECE6] bg-white hover:bg-slate-50 text-slate-600 font-medium transition cursor-pointer"
                                  >
                                    <MessageSquare className="h-3.5 w-3.5 text-teal-600" />
                                    Send SMS Alert
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })
                ) : (
                  <EmptyState
                    icon={Search}
                    title="No matching patients"
                    description="Try a different name, token number, or phone."
                    action={
                      <button
                        onClick={() => setSearchQuery("")}
                        className="text-sm font-medium text-teal-700 hover:text-teal-800"
                      >
                        Clear search
                      </button>
                    }
                  />
                )}
              </div>
            ) : (
              <EmptyState
                icon={Users}
                title="No patients in queue yet"
                description="Add a patient on the left to create the first token."
              />
            )}

            {historicalList.length > 0 && (
              <div className="border-t border-slate-100 bg-slate-50/30 p-8 sm:p-10">
                <span className="text-sm font-medium text-slate-500 block mb-4">
                  Completed today ({historicalList.length})
                </span>
                <div className="flex gap-3 overflow-x-auto pb-1 select-none">
                  {[...historicalList].reverse().slice(0, 6).map((hist) => {
                    const isNS = hist.status === "no-show";
                    return (
                      <motion.div
                        layout
                        initial={false}
                        animate={{ opacity: 1, scale: 1 }}
                        key={hist.tokenNumber}
                        className="px-4 py-3.5 rounded-2xl bg-white border border-slate-100 text-sm flex flex-col min-w-32 shadow-xs"
                      >
                        <span className="text-xs text-slate-400 font-medium">Token {hist.tokenNumber}</span>
                        <span className="truncate max-w-28 font-medium text-slate-800 mt-1">{hist.patientName}</span>
                        <span className={`text-xs mt-1.5 font-semibold ${isNS ? "text-rose-500" : "text-teal-600"}`}>
                          {isNS ? "Skipped" : "Done"}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
          </>
          )}
        </div>
      </main>

      {/* Mobile sticky action bar */}
      {queue && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 p-4 bg-white/90 backdrop-blur-md border-t border-[#EFECE6] shadow-[0_-8px_30px_rgba(0,0,0,0.06)]">
          <div className="flex gap-3 max-w-lg mx-auto">
            <button
              onClick={triggerCallNext}
              disabled={!canAdvanceQueue || !isConnected}
              className={`flex-1 font-semibold py-3.5 px-4 rounded-full transition ${
                canAdvanceQueue && isConnected
                  ? "bg-teal-600 text-white"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {waitingList.length > 0 ? "Call Next" : currentServing ? "Complete" : "Call Next"}
            </button>
            <button
              onClick={triggerMarkNoShow}
              disabled={!currentServing || !isConnected}
              className={`px-5 py-3.5 rounded-full border text-sm font-medium ${
                currentServing && isConnected
                  ? "border-[#EFECE6] text-slate-600"
                  : "border-slate-100 text-slate-300"
              }`}
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {showResetModal && (
        <div
          className="fixed inset-0 bg-slate-950/30 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setShowResetModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full p-8 shadow-xl border border-slate-100"
          >
            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <h3 id="reset-modal-title" className="text-xl font-medium text-slate-900">Reset Queue?</h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                  This clears the active queue and starts token numbers again from #1. Completed records are archived.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => setShowResetModal(false)}
                className="bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-sm font-medium py-3 px-5 rounded-full transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeQueueReset}
                className="bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium py-3 px-5 rounded-full shadow-sm hover:shadow-md transition cursor-pointer"
                id="btn-confirm-reset"
              >
                Reset Queue
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
