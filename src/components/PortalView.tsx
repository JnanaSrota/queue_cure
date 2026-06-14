import { UserCheck, Tv, ArrowRight, Activity, Clock, Users } from "lucide-react";
import { Queue } from "../types.js";
import { ConnectionBadge } from "./ui/shared.js";

interface PortalViewProps {
  onNavigate: (path: string) => void;
  isConnected: boolean;
  isConnecting: boolean;
  queue: Queue | null;
}

export default function PortalView({ onNavigate, isConnected, isConnecting, queue }: PortalViewProps) {
  const currentServing = queue?.tokens.find(t => t.status === "in-progress") || null;
  const waitingCount = queue?.tokens.filter(t => t.status === "waiting").length ?? 0;
  const doneCount = queue?.tokens.filter(t => t.status === "done").length ?? 0;

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col justify-between text-[#3C3835] font-sans relative overflow-hidden selection:bg-teal-100/80 page-enter">
      {/* Background ambient warm glows and soft grain pattern */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-teal-500/3 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-amber-500/2 rounded-full blur-[100px]"></div>
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(#14b8a6 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
      </div>

      {/* Header */}
      <header className="bg-white/40 backdrop-blur-md border-b border-[#EFECE6] py-6 px-6 sm:px-10 relative z-10">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-teal-600/90 text-white p-2 rounded-2xl shadow-xs">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <span className="font-semibold text-lg tracking-tight text-[#2D2A26]">QueueCure</span>
              <span className="text-[9px] block text-teal-700 font-bold tracking-widest uppercase mt-0.5">EST. 2026</span>
            </div>
          </div>
          
          <ConnectionBadge isConnected={isConnected} isConnecting={isConnecting} compact />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center py-16 px-6 sm:px-10 relative z-10">
        <div className="max-w-6xl mx-auto w-full">
          {/* Hero section */}
          <div className="grid md:grid-cols-12 gap-12 lg:gap-20 items-center mb-20">
            {/* Left text column */}
            <div className="md:col-span-7 text-left space-y-6">
              <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-teal-700 bg-teal-50/60 border border-teal-100/40 px-3 py-1 rounded-full">
                OUTPATIENT FLOW ENGINE
              </div>
              
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-light text-[#2D2A26] tracking-tight leading-[1.08]">
                A beautifully simple <span className="font-serif italic font-normal text-teal-600">outpatient flow</span> system.
              </h1>
              
              <p className="text-lg text-slate-500 max-w-xl leading-relaxed font-light">
                Empower your medical clinic with instant live waiting board displays, rapid receptionist controls, and dynamic wait-time analytics. Made to feel calm, organic, and distraction-free.
              </p>

              {isConnected && queue && (
                <div className="flex flex-wrap gap-3 pt-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-white border border-[#EFECE6] px-4 py-2 rounded-full shadow-2xs">
                    <Users className="h-3.5 w-3.5 text-teal-600" />
                    {waitingCount} waiting
                  </div>
                  {currentServing && (
                    <div className="flex items-center gap-2 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-100/50 px-4 py-2 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
                      Serving Token {currentServing.tokenNumber}
                    </div>
                  )}
                  {doneCount > 0 && (
                    <div className="text-xs font-medium text-slate-500 bg-slate-50 border border-slate-100 px-4 py-2 rounded-full">
                      {doneCount} completed today
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right illustration column - Styled like a premium Pinterest "Pin" card */}
            <div className="md:col-span-5 flex justify-center md:justify-end">
              <div className="relative p-8 w-full max-w-[340px] aspect-[4/5] flex flex-col justify-between bg-white border border-[#EFECE6] rounded-[2.5rem] shadow-[0_15px_40px_rgba(0,0,0,0.02)] transition-all hover:scale-[1.02] hover:shadow-[0_20px_50px_rgba(0,0,0,0.04)] duration-500 group">
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-[#FAF8F5]/60 to-transparent rounded-t-[2.5rem] -z-10"></div>
                
                {/* Pin upper tag */}
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Flow</span>
                  <span className="text-[10px] font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">Chamber 1</span>
                </div>

                {/* Queue Graphic */}
                <div className="my-6 flex justify-center items-center h-40">
                  <svg className="w-full h-full relative z-10" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 30 80 H 170" stroke="#EFECE6" strokeWidth="4" strokeLinecap="round" strokeDasharray="6 6" />
                    <path d="M 30 80 H 100" stroke="#0D9488" strokeWidth="4" strokeLinecap="round" />
                    
                    {/* Circle 1: Waiting */}
                    <circle cx="40" cy="80" r="15" fill="white" stroke="#E2E8F0" strokeWidth="1.5" />
                    <text x="40" y="83.5" fill="#64748B" fontSize="10" fontWeight="bold" textAnchor="middle">
                      {String(waitingCount).padStart(2, "0")}
                    </text>
                    <text x="40" y="112" fill="#94A3B8" fontSize="8" fontWeight="bold" textAnchor="middle" letterSpacing="0.05em">WAITING</text>
                    
                    {/* Circle 2: Serving */}
                    <circle cx="100" cy="80" r="20" fill="#0D9488" className="shadow-xs" />
                    <circle cx="100" cy="80" r="26" stroke="#0D9488" strokeWidth="1.5" strokeDasharray="4 4" className="animate-spin" style={{ transformOrigin: '100px 80px', animationDuration: '25s' }} />
                    <text x="100" y="84" fill="white" fontSize="12" fontWeight="bold" textAnchor="middle">
                      {currentServing ? String(currentServing.tokenNumber).padStart(2, "0") : "--"}
                    </text>
                    <text x="100" y="122" fill="#0D9488" fontSize="9" fontWeight="bold" textAnchor="middle" letterSpacing="0.05em">SERVING</text>

                    {/* Circle 3: Done */}
                    <circle cx="160" cy="80" r="15" fill="#FAF8F5" stroke="#EFECE6" strokeWidth="1.5" />
                    {doneCount > 0 ? (
                      <text x="160" y="83.5" fill="#94A3B8" fontSize="10" fontWeight="bold" textAnchor="middle">
                        {String(doneCount).padStart(2, "0")}
                      </text>
                    ) : (
                      <path d="M 156 80 L 159 83 L 164 77" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    )}
                    <text x="160" y="112" fill="#94A3B8" fontSize="8" fontWeight="bold" textAnchor="middle" letterSpacing="0.05em">DONE</text>
                  </svg>
                </div>

                {/* Pin details */}
                <div className="border-t border-[#FAF8F5] pt-4 flex justify-between items-center">
                  <div>
                    <span className="text-xs text-slate-400 block font-light">Average Service</span>
                    <span className="text-sm font-semibold text-[#2D2A26]">{queue?.avgConsultationTimeMinutes || 10} minutes / patient</span>
                  </div>
                  <div className="bg-teal-50 text-teal-600 p-2.5 rounded-full">
                    <Activity className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pinterest Pins Grid - Features */}
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Reception Card */}
            <button
              type="button"
              onClick={() => onNavigate("/reception")}
              className="group cursor-pointer bg-white border border-[#EFECE6] hover:border-teal-600/30 hover:scale-[1.015] hover:shadow-[0_20px_50px_rgba(0,0,0,0.03)] transition-all duration-500 p-8 sm:p-10 rounded-[2rem] flex flex-col justify-between relative overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.01)] text-left w-full"
              id="btn-portal-reception"
            >
              <div className="absolute top-0 right-0 w-36 h-36 bg-teal-500/[0.02] rounded-full -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-500 -z-0"></div>
              
              <div className="relative z-10 space-y-6">
                <div className="bg-[#FAF8F5] text-teal-600 border border-[#EFECE6] p-4.5 rounded-2xl w-fit shadow-2xs group-hover:bg-teal-600 group-hover:text-white group-hover:border-teal-600 transition-all duration-500">
                  <UserCheck className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-serif text-[#2D2A26] tracking-tight group-hover:text-teal-600 transition-colors">
                    Reception Console
                  </h2>
                  <p className="text-slate-500 text-sm leading-relaxed mt-2.5 font-light">
                    Add patients with rapid-fire inputs, call the next token, skip no-shows, and customize consultation duration parameters with responsive single-click controls.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-teal-600 font-semibold text-xs tracking-wider uppercase mt-8 group-hover:gap-3 transition-all relative z-10">
                Launch Console <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate("/waiting")}
              className="group cursor-pointer bg-white border border-[#EFECE6] hover:border-teal-600/30 hover:scale-[1.015] hover:shadow-[0_20px_50px_rgba(0,0,0,0.03)] transition-all duration-500 p-8 sm:p-10 rounded-[2rem] flex flex-col justify-between relative overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.01)] text-left w-full"
              id="btn-portal-waiting"
            >
              <div className="absolute top-0 right-0 w-36 h-36 bg-teal-500/[0.02] rounded-full -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-500 -z-0"></div>

              <div className="relative z-10 space-y-6">
                <div className="bg-[#FAF8F5] text-teal-600 border border-[#EFECE6] p-4.5 rounded-2xl w-fit shadow-2xs group-hover:bg-teal-600 group-hover:text-white group-hover:border-teal-600 transition-all duration-500">
                  <Tv className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-serif text-[#2D2A26] tracking-tight group-hover:text-teal-600 transition-colors">
                    Waiting Room Board
                  </h2>
                  <p className="text-slate-500 text-sm leading-relaxed mt-2.5 font-light">
                    A gorgeous, distraction-free display for patients inside the waiting hall. Features soft chime indicators, live waiting progress rings, and real-time active status pulses.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-teal-600 font-semibold text-xs tracking-wider uppercase mt-8 group-hover:gap-3 transition-all relative z-10">
                Launch Board Display <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          </div>
        </div>
      </main>

      {/* Stats and Footer section with editorial Pinterest styling */}
      <section className="bg-white/40 border-t border-[#EFECE6] py-16 px-6 sm:px-10 relative z-10">
        <div className="max-w-4xl mx-auto w-full">
          {/* Editorial Stats Board */}
          <div className="grid grid-cols-3 gap-8 text-center mb-16">
            <div className="space-y-1">
              <span className="block text-4xl sm:text-5xl font-serif italic text-teal-600">100%</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">REALTIME SYNC</span>
            </div>
            <div className="border-x border-[#EFECE6] px-4 space-y-1">
              <span className="block text-4xl sm:text-5xl font-serif italic text-teal-600">Live</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">WAIT ESTIMATION</span>
            </div>
            <div className="space-y-1">
              <span className="block text-4xl sm:text-5xl font-serif italic text-teal-600">Secure</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">LOCAL-FIRST INSTANCE</span>
            </div>
          </div>

          {/* Footer */}
          <footer className="border-t border-[#EFECE6] pt-8 text-center text-xs text-slate-400">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="font-light">© 2026 QueueCure Flow System. Created for high-end outpatient spaces.</p>
              <div className="flex gap-4">
                <span className="flex items-center gap-1.5 font-bold text-[9px] tracking-wider uppercase text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-100/40">
                  <Clock className="h-3 w-3 text-teal-600" /> Live Synchronized
                </span>
              </div>
            </div>
          </footer>
        </div>
      </section>
    </div>
  );
}
