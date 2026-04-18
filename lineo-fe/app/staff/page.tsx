"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { 
  Users, 
  Volume2, 
  CheckCircle2, 
  X, 
  Clock, 
  Play, 
  Pause,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { toast } from "sonner";
import { useSocket } from "@/context/SocketContext";

interface TokenInfo {
  token_number: string;
  status: string;
}

interface AdminState {
  waiting_list: TokenInfo[];
  currently_serving: TokenInfo | null;
  org_id?: number;
  queue_key?: string;
}

export default function AdminDashboard() {
  const [queueState, setQueueState] = useState<AdminState>({ waiting_list: [], currently_serving: null });
  const [isActive, setIsActive] = useState(false); 
  const { subscribe, unsubscribe } = useSocket();

  const fetchAdminState = useCallback(async () => {
    try {
      setTimeout(() => {
        setIsActive(true);
      }, 500);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchAdminState();
  }, [fetchAdminState]);

  const handleCallNext = async () => {
     toast.success("Calling Next Token: A-103", { description: "Announcement broadcasted to waiting room." });
  };

  const handleResolve = async () => {
     toast.success("Token A-102 Resolved", { description: "Session duration: 12 minutes." });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
         <div>
            <h1 className="text-3xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Live Operations</h1>
            <p className="text-[#49607e] text-sm font-medium mt-1">Manage active queues and call tokens.</p>
         </div>
         <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsActive(!isActive)}
              className={cn(
                "px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 text-sm transition-all ghost-border shadow-sm",
                isActive ? "bg-white text-red-600 hover:bg-red-50" : "bg-white text-green-600 hover:bg-green-50"
              )}
            >
              {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isActive ? "Pause Queue" : "Open Queue"}
            </button>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column - Active Control */}
        <div className="lg:col-span-7 space-y-6">
           <div className="bg-white ghost-border rounded-3xl p-8 relative overflow-hidden flex flex-col items-center justify-center min-h-[350px] shadow-ambient">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#493ee5] opacity-5 rounded-full blur-3xl pointer-events-none" />
              
              <h2 className="text-[#49607e] font-extrabold uppercase tracking-widest text-xs mb-4" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Currently Serving</h2>
              <div className="text-8xl font-extrabold text-[#181c1e] tracking-tighter mb-8" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                A-102
              </div>
              
              <div className="flex items-center gap-4 w-full max-w-sm">
                <button
                  onClick={handleResolve}
                  className="flex-1 py-4 bg-green-50 text-green-600 rounded-2xl font-bold text-sm hover:bg-green-100 transition-colors ghost-border flex items-center justify-center gap-2 shadow-sm"
                  style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
                >
                  <CheckCircle2 className="w-5 h-5" /> Complete
                </button>
                <button
                  onClick={handleCallNext}
                  className="flex-1 py-4 bg-[#493ee5] text-white rounded-2xl font-bold text-sm hover:opacity-90 transition-colors shadow-neobrutal flex items-center justify-center gap-2"
                  style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
                >
                  <Volume2 className="w-5 h-5" /> Next
                </button>
              </div>
           </div>

           {/* Metrics */}
           <div className="grid grid-cols-2 gap-6">
              <div className="bg-white ghost-border rounded-2xl p-6 shadow-sm hover:shadow-ambient transition-all">
                 <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-[#493ee5]/5 rounded-lg text-[#493ee5]"><Users className="w-5 h-5" /></div>
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#49607e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Waiting</span>
                 </div>
                 <div className="text-3xl font-extrabold text-[#181c1e] tracking-tighter" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>14</div>
              </div>
              <div className="bg-white ghost-border rounded-2xl p-6 shadow-sm hover:shadow-ambient transition-all">
                 <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-amber-50 rounded-lg text-amber-600"><Clock className="w-5 h-5" /></div>
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#49607e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Est. Wait</span>
                 </div>
                 <div className="text-3xl font-extrabold text-[#181c1e] tracking-tighter" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>22m</div>
              </div>
           </div>
        </div>

        {/* Right Column - Waiting List */}
        <div className="lg:col-span-5 bg-white ghost-border rounded-3xl p-6 flex flex-col max-h-[550px] shadow-sm">
          <div className="flex items-center justify-between mb-6">
             <h3 className="text-lg font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Up Next</h3>
             <span className="bg-[#f1f4f7] text-[#49607e] text-xs font-bold px-2.5 py-1 rounded-md">14 People</span>
          </div>

          <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-2">
             {["A-103", "A-104", "A-105", "B-201", "A-106", "C-301"].map((token, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-[#f7fafd] rounded-2xl border border-transparent hover:border-[#e5e8eb] hover:bg-white hover:shadow-sm transition-all group">
                   <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                        i === 0 ? "bg-[#493ee5] text-white shadow-sm" : "bg-white text-[#49607e] ghost-border"
                      )} style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                        {i + 1}
                      </div>
                      <div>
                        <div className="font-bold text-[#181c1e] tracking-wide" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{token}</div>
                        <div className="text-xs text-[#49607e] font-medium mt-0.5">Wait: {8 + (i*4)}m</div>
                      </div>
                   </div>
                   <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 bg-white ghost-border rounded-lg hover:bg-red-50 text-red-500 transition-colors" title="Cancel/No Show">
                         <X className="w-4 h-4" />
                      </button>
                      {i === 0 && (
                        <button className="p-2 bg-[#493ee5]/10 rounded-lg hover:bg-[#493ee5] hover:text-white text-[#493ee5] transition-colors" title="Call Now">
                           <Volume2 className="w-4 h-4" />
                        </button>
                      )}
                   </div>
                </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
}
