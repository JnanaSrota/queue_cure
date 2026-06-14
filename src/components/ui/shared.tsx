import type { ReactNode } from "react";
import { motion } from "motion/react";
import { LucideIcon, Wifi, WifiOff, Loader2 } from "lucide-react";

interface ConnectionBannerProps {
  isConnected: boolean;
  isConnecting: boolean;
}

export function ConnectionBanner({ isConnected, isConnecting }: ConnectionBannerProps) {
  if (isConnected) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`sticky top-0 z-40 px-4 py-2.5 text-center text-sm font-medium flex items-center justify-center gap-2 ${
        isConnecting
          ? "bg-amber-50 text-amber-900 border-b border-amber-100"
          : "bg-rose-50 text-rose-900 border-b border-rose-100"
      }`}
    >
      {isConnecting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Reconnecting to live queue…
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          You're offline — changes won't sync until you're back online.
        </>
      )}
    </motion.div>
  );
}

interface ConnectionBadgeProps {
  isConnected: boolean;
  isConnecting: boolean;
  compact?: boolean;
}

export function ConnectionBadge({ isConnected, isConnecting, compact }: ConnectionBadgeProps) {
  const label = isConnected ? "Live" : isConnecting ? "Connecting" : "Offline";
  const styles = isConnected
    ? "bg-teal-50/80 border-teal-100/60 text-teal-800"
    : isConnecting
      ? "bg-amber-50/80 border-amber-100/60 text-amber-800"
      : "bg-rose-50/80 border-rose-100/60 text-rose-800";
  const dot = isConnected
    ? "bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.6)]"
    : isConnecting
      ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
      : "bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]";

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-2xs transition-colors ${styles}`}>
      <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${dot}`} />
      <span className={`font-bold tracking-widest uppercase ${compact ? "text-[9px]" : "text-[10px]"}`}>
        {label}
      </span>
      {isConnected && !compact && <Wifi className="h-3 w-3 opacity-60" />}
    </div>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-20 px-6 flex flex-col items-center justify-center">
      <div className="w-14 h-14 rounded-2xl bg-[#FAF8F5] border border-[#EFECE6] flex items-center justify-center mb-5">
        <Icon className="h-6 w-6 text-slate-400" />
      </div>
      <p className="text-lg font-medium text-slate-600">{title}</p>
      <p className="text-sm text-slate-400 mt-2 max-w-xs leading-relaxed">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function QueueLoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-8 lg:col-span-7">
      <div className="bg-white border border-[#EFECE6] rounded-[2.5rem] p-10 h-52" />
      <div className="bg-white border border-[#EFECE6] rounded-3xl p-10 space-y-4">
        <div className="h-4 bg-slate-100 rounded-full w-1/3" />
        <div className="h-16 bg-slate-50 rounded-2xl" />
        <div className="h-16 bg-slate-50 rounded-2xl" />
        <div className="h-16 bg-slate-50 rounded-2xl" />
      </div>
    </div>
  );
}

interface FixedToastProps {
  message: string;
  variant?: "success" | "error";
  onDismiss?: () => void;
}

export function FixedToast({ message, variant = "success", onDismiss }: FixedToastProps) {
  const isSuccess = variant === "success";
  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.96 }}
      className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)] px-5 py-3.5 rounded-2xl shadow-lg border flex items-center gap-3 backdrop-blur-md ${
        isSuccess
          ? "bg-teal-50/95 border-teal-100 text-teal-900"
          : "bg-amber-50/95 border-amber-100 text-amber-900"
      }`}
      role="status"
    >
      <span className="text-sm font-medium flex-1">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-xs font-semibold opacity-70 hover:opacity-100 transition shrink-0"
        >
          Dismiss
        </button>
      )}
    </motion.div>
  );
}
