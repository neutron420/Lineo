"use client";

import React, { useEffect, useState } from "react";
import { Search, ShieldAlert, CheckCircle2, AlertTriangle, Info, BellRing, Lock, Clock, UserCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster, toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import api from "@/lib/api";

interface AuditLog {
  id: string;
  level: "CRITICAL" | "WARNING" | "INFO";
  title: string;
  message: string;
  timestamp: string;
  actor: string;
}

export default function NotificationsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeLog, setActiveLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/notifications");
      setLogs((res.data?.data || []) as AuditLog[]);
    } catch (err) {
      toast.error("Global Audit Ledger unreachable. Database connection failed.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = (logs || []).filter(l => 
    l.title.toLowerCase().includes(search.toLowerCase()) || 
    l.message.toLowerCase().includes(search.toLowerCase()) ||
    l.actor.toLowerCase().includes(search.toLowerCase())
  );

  const getIcon = (level: string) => {
    switch (level) {
      case "CRITICAL": return <ShieldAlert className="h-5 w-5 text-red-600" />;
      case "WARNING": return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      case "INFO": return <Info className="h-5 w-5 text-[#493ee5]" />;
      default: return <BellRing className="h-5 w-5 text-[#49607e]" />;
    }
  };

  const getBg = (level: string) => {
    switch (level) {
      case "CRITICAL": return "bg-red-50 border-red-500/20 text-red-700";
      case "WARNING": return "bg-amber-50 border-amber-500/20 text-amber-700";
      case "INFO": return "bg-[#493ee5]/5 border-[#493ee5]/20 text-[#493ee5]";
      default: return "bg-[#f1f4f7] border-transparent text-[#49607e]";
    }
  };

  return (
    <div className="space-y-6 w-full">
      <Toaster position="top-right" expand={true} richColors />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e5e8eb] pb-6 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Global Audit Ledger</h1>
          <p className="text-sm text-[#49607e] font-medium mt-1">Real-time system notifications and organizational event tracking.</p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#49607e]" />
          <input
            type="text"
            placeholder="Search events, protocols, or agents..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#e5e8eb] rounded-xl text-sm font-medium focus:outline-none focus:border-[#493ee5] focus:ring-1 focus:ring-[#493ee5] transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#e5e8eb] p-5 rounded-2xl flex gap-4 w-full shell items-start">
               <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
               <div className="flex-1 space-y-2">
                 <Skeleton className="h-5 w-48" />
                 <Skeleton className="h-4 w-full max-w-xl" />
               </div>
               <Skeleton className="h-4 w-20" />
            </div>
          ))
        ) : filteredLogs.length === 0 ? (
          <div className="bg-white border border-dashed border-[#e5e8eb] rounded-3xl p-16 text-center shadow-sm">
             <CheckCircle2 className="h-10 w-10 text-emerald-500/50 mx-auto mb-4" />
             <p className="text-[#181c1e] font-extrabold text-lg">System Operating Nominally</p>
             <p className="text-[#49607e] font-medium text-sm mt-1">No critical events or protocols have been intercepted.</p>
          </div>
        ) : filteredLogs.map((log) => (
          <div 
             key={log.id} 
             onClick={() => setActiveLog(log)}
             className="bg-white border border-[#e5e8eb] p-5 rounded-2xl flex flex-col sm:flex-row gap-5 shadow-ambient hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all group cursor-pointer"
          >
             <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${getBg(log.level)}`}>
                {getIcon(log.level)}
             </div>
             <div className="flex-1">
                <div className="flex items-start justify-between gap-4">
                   <div>
                     <h3 className="font-extrabold text-[#181c1e] text-[15px] group-hover:text-[#493ee5] transition-colors" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                       {log.title}
                     </h3>
                     <p className="text-sm font-medium text-[#49607e] mt-1 pr-6 line-clamp-1">{log.message}</p>
                   </div>
                   <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-[#181c1e] uppercase tracking-widest">{new Date(log.timestamp).toLocaleTimeString()}</p>
                      <p className="text-[10px] text-[#49607e] font-bold mt-1 uppercase tracking-widest">{new Date(log.timestamp).toLocaleDateString()}</p>
                   </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[#e5e8eb] flex items-center justify-between">
                   <span className="flex items-center gap-1.5 text-xs font-bold text-[#49607e]">
                     Intercepted by <span className="text-[#181c1e] bg-[#f1f4f7] px-2 py-0.5 rounded ml-1">{log.actor}</span>
                   </span>
                   <span className={`text-[9px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest border ${getBg(log.level)}`}>
                     {log.level}
                   </span>
                </div>
             </div>
          </div>
        ))}
      </div>

      <Sheet open={!!activeLog} onOpenChange={(open) => !open && setActiveLog(null)}>
        <SheetContent className="sm:max-w-[450px] bg-white border-l border-[#e5e8eb] z-[100] custom-scrollbar overflow-y-auto w-full">
          {activeLog && (
            <div className="py-6 space-y-6 h-full flex flex-col">
              <SheetHeader>
                <div className="flex items-center gap-4 mb-2">
                   <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${getBg(activeLog.level)}`}>
                      {getIcon(activeLog.level)}
                   </div>
                   <div>
                     <SheetTitle className="text-xl font-extrabold text-[#181c1e] tracking-tight text-left" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                       Intercepted Protocol
                     </SheetTitle>
                     <p className="text-[10px] font-bold text-[#49607e] uppercase tracking-widest mt-1 text-left">{activeLog.id}</p>
                   </div>
                </div>
              </SheetHeader>

              <div className="space-y-6 flex-1 pt-4 border-t border-[#e5e8eb]">
                <div>
                   <h2 className="text-lg font-extrabold text-[#181c1e] mb-2" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{activeLog.title}</h2>
                   <p className="text-sm font-medium text-[#49607e] leading-relaxed">{activeLog.message}</p>
                </div>

                <div className="space-y-4 bg-[#f7fafd] p-5 rounded-2xl border border-[#e5e8eb]">
                   <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-bold text-[#49607e] uppercase tracking-widest"><Lock className="h-4 w-4" /> Clearance Level</span>
                      <span className={`text-[9px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest border ${getBg(activeLog.level)}`}>{activeLog.level}</span>
                   </div>
                   <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-bold text-[#49607e] uppercase tracking-widest"><Clock className="h-4 w-4" /> Timestamp</span>
                      <span className="text-xs font-extrabold text-[#181c1e]">{new Date(activeLog.timestamp).toLocaleString()}</span>
                   </div>
                   <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-bold text-[#49607e] uppercase tracking-widest"><UserCheck className="h-4 w-4" /> System Agent</span>
                      <span className="text-xs font-extrabold text-[#181c1e]">{activeLog.actor}</span>
                   </div>
                </div>

                <div className="space-y-3 pt-6 border-t border-[#e5e8eb]">
                   <button className="w-full py-3 bg-[#181c1e] text-white rounded-xl font-extrabold text-sm uppercase tracking-widest hover:bg-black transition-colors shadow-ambient">
                      Acknowledge Alert
                   </button>
                   <button 
                      onClick={() => toast.success("Ledger exported to root directory.")}
                      className="w-full py-3 bg-white text-[#181c1e] border border-[#e5e8eb] rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-[#f1f4f7] transition-colors"
                   >
                      Download Trace
                   </button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
