"use client";

import React, { useEffect, useState } from "react";
import { Cpu, Search, RefreshCw, Activity, AlertCircle, CheckCircle2, MoreVertical, Settings, Signal, SignalLow, SignalZero } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster, toast } from "sonner";
import api from "@/lib/api";

interface Terminal {
  id: string;
  name: string;
  org: string;
  status: "ONLINE" | "OFFLINE" | "LOW_PAPER" | "MAINTENANCE";
  health: number;
  lastSeen: string;
}

export default function InfrastructureDeck() {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchTerminals = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/terminals");
      setTerminals((res.data?.data || []) as Terminal[]);
    } catch (err) {
      toast.error("Infrastructure Deck unreachable. Check cluster uplink.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTerminals();
  }, []);

  const filtered = terminals.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.org.toLowerCase().includes(search.toLowerCase()) ||
    t.id.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "ONLINE": return "bg-emerald-50 text-emerald-700 border-emerald-500/20";
      case "LOW_PAPER": return "bg-amber-50 text-amber-700 border-amber-500/20";
      case "MAINTENANCE": return "bg-[#493ee5]/10 text-[#493ee5] border-[#493ee5]/20";
      default: return "bg-red-50 text-red-700 border-red-500/20";
    }
  };

  const getHealthColor = (health: number) => {
    if (health > 90) return "bg-emerald-500";
    if (health > 50) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-6 w-full">
      <Toaster position="top-right" expand={true} richColors />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e5e8eb] pb-6 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Infrastructure Deck</h1>
          <p className="text-sm text-[#49607e] font-medium mt-1">Real-time health telemetry for all decentralized terminal nodes.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#49607e]" />
            <input
              type="text"
              placeholder="Filter nodes or orgs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-[#e5e8eb] rounded-xl text-sm font-medium focus:outline-none focus:border-[#493ee5] transition-all shadow-sm"
            />
          </div>
          <button onClick={fetchTerminals} className="p-2.5 bg-white border border-[#e5e8eb] rounded-xl text-[#181c1e] hover:bg-[#f1f4f7] transition-all">
            <RefreshCw className={`h-4 w-4 ${loading && "animate-spin"}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-3xl w-full" />
          ))
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-20 text-center">
             <Cpu className="h-12 w-12 text-[#49607e]/30 mx-auto mb-4" />
             <p className="text-[#49607e] font-bold">No terminal nodes detected in selected vector.</p>
          </div>
        ) : filtered.map((node) => (
          <div key={node.id} className="bg-white rounded-3xl border border-[#e5e8eb] p-6 shadow-ambient hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)] transition-all flex flex-col group h-[280px]">
            <div className="flex items-start justify-between mb-4">
               <div className="p-3 bg-[#493ee5]/10 rounded-2xl group-hover:scale-110 transition-transform">
                  <Cpu className="h-6 w-6 text-[#493ee5]" />
               </div>
               <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusStyle(node.status)}`}>
                  {node.status.replace("_", " ")}
               </div>
            </div>

            <div className="flex-1">
               <h3 className="text-base font-extrabold text-[#181c1e] tracking-tight truncate">{node.name}</h3>
               <p className="text-xs font-bold text-[#49607e] uppercase tracking-widest mt-0.5">{node.org}</p>
               <p className="text-[10px] font-mono text-[#49607e] mt-2 bg-[#f1f4f7] w-fit px-2 py-0.5 rounded">{node.id}</p>
            </div>

            <div className="mt-6 space-y-4">
               <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-[#49607e]">
                     <span>Network Health</span>
                     <span className={node.health > 50 ? "text-emerald-600" : "text-red-500"}>{node.health}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#f1f4f7] rounded-full overflow-hidden">
                     <div className={`h-full transition-all duration-1000 ${getHealthColor(node.health)}`} style={{ width: `${node.health}%` }} />
                  </div>
               </div>

               <div className="flex items-center justify-between pt-4 border-t border-[#e5e8eb]">
                  <div className="flex items-center gap-1.5">
                     {node.status === "ONLINE" ? <Signal className="h-4 w-4 text-emerald-500" /> : node.status === "OFFLINE" ? <SignalZero className="h-4 w-4 text-red-400" /> : <SignalLow className="h-4 w-4 text-amber-500" />}
                     <span className="text-[10px] font-bold text-[#49607e] uppercase">Last seen {new Date(node.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <button className="p-2 hover:bg-[#f1f4f7] rounded-lg transition-colors text-[#49607e]">
                     <Settings className="h-4 w-4" />
                  </button>
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
