import React from 'react';
import { useWaitTimePrediction } from '@/hooks/useWaitTimePrediction';
import { Zap, Sparkles } from 'lucide-react';

interface Props {
  queueKey: string;
  ticketId: string;
}

export const AIWaitTimeDisplay: React.FC<Props> = ({ queueKey, ticketId }) => {
  const { prediction, loading } = useWaitTimePrediction(queueKey, ticketId);

  if (loading) {
    return (
      <div className="mt-6 flex min-h-[160px] flex-col items-center justify-center rounded-2xl bg-[#f8f9fc] border border-[#e5e8eb] p-6 text-center transition-all animate-pulse shadow-sm">
        <Sparkles className="mb-3 w-8 h-8 text-[#493ee5] animate-pulse" />
        <p className="text-sm font-bold text-[#49607e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>AI is calculating live velocity...</p>
      </div>
    );
  }

  if (!prediction) return null;

  const getConfidenceStyle = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
      case 'medium': return 'bg-amber-50 text-amber-600 border-amber-200';
      case 'low': return 'bg-rose-50 text-rose-600 border-rose-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="group relative mt-6 overflow-hidden rounded-2xl border border-[#e5e8eb] bg-gradient-to-b from-white to-[#f8f9fc] p-6 md:p-8 shadow-sm transition-all duration-300 hover:shadow-md">
      {/* Subtle purple glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 z-0 h-48 w-48 rounded-full bg-[#493ee5]/5 blur-3xl" />

      <div className="relative z-10 flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-[#49607e] text-xs font-bold uppercase tracking-widest" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
          <Sparkles className="w-3.5 h-3.5 text-[#493ee5]" />
          AI Wait Time
        </div>
        <span className="rounded-lg bg-[#493ee5]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#493ee5] border border-[#493ee5]/20">
          Lineo Predictor
        </span>
      </div>
      
      <div className="relative z-10 mb-6 flex items-baseline justify-center gap-1.5">
        <span className="text-6xl md:text-7xl font-black text-[#181c1e] tracking-tighter" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
          {prediction.estimated_wait_minutes}
        </span>
        <span className="text-xl font-bold text-[#49607e]">mins</span>
      </div>

      <div className="relative z-10 mb-6 rounded-xl bg-white/60 p-4 border border-[#e5e8eb] shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] backdrop-blur-sm">
        <p className="text-center text-sm font-medium leading-relaxed text-[#49607e] italic">
          &quot;{prediction.message}&quot;
        </p>
      </div>

      <div className="relative z-10 flex items-center justify-center gap-2 text-[11px] font-bold text-[#49607e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
        CONFIDENCE LEVEL: 
        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${getConfidenceStyle(prediction.confidence)}`}>
          {prediction.confidence}
        </span>
      </div>
    </div>
  );
};
