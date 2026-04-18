"use client";

import React, { useState, useEffect } from "react";
import { Radio, Send, Info, AlertTriangle, ShieldAlert, CheckCircle2, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster, toast } from "sonner";
import api from "@/lib/api";

type BroadcastLevel = "INFO" | "WARNING" | "EMERGENCY";

export default function SystemBroadcaster() {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState<BroadcastLevel>("INFO");

  useEffect(() => {
    const t = setTimeout(() => setInitialLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  const handleBroadcast = async () => {
    if (!title || !message) {
      toast.error("Protocol Error: Title and Message required for transmission.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/admin/broadcast", { title, message, level });
      toast.success("Broadcast successfully transmitted to all active nodes.");
      setTitle("");
      setMessage("");
    } catch (err) {
      toast.error("Transmission Failed: Cluster uplink disconnected.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getLevelStyle = (l: BroadcastLevel) => {
    switch (l) {
      case "INFO": return "bg-[#493ee5]/10 text-[#493ee5] border-[#493ee5]/20";
      case "WARNING": return "bg-amber-50 text-amber-700 border-amber-500/20";
      case "EMERGENCY": return "bg-red-50 text-red-700 border-red-500/20";
    }
  };

  if (initialLoading) {
    return (
      <div className="space-y-6 w-full animate-pulse">
        <div className="flex justify-between items-center border-b border-[#e5e8eb] pb-6 mb-6">
          <div>
            <Skeleton className="h-8 w-64 mb-2 rounded-lg" />
            <Skeleton className="h-4 w-48 rounded-md" />
          </div>
        </div>
        <div className="max-w-3xl space-y-8">
           <Skeleton className="h-[400px] rounded-3xl w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <Toaster position="top-right" expand={true} richColors />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e5e8eb] pb-6 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>System Announcements</h1>
          <p className="text-sm text-[#49607e] font-medium mt-1">Transmit real-time global announcements to all connected cluster nodes.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-500/20">
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
           <span className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-700">Uplink Active</span>
        </div>
      </div>

      <div className="space-y-8">
        <div className="bg-white rounded-3xl border border-transparent shadow-ambient p-8 space-y-8">
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
               {(["INFO", "WARNING", "EMERGENCY"] as BroadcastLevel[]).map((l) => (
                 <button
                   key={l}
                   onClick={() => setLevel(l)}
                   className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all font-bold text-xs uppercase tracking-widest ${
                     level === l 
                        ? (l === "INFO" ? "bg-[#493ee5] text-white border-[#493ee5] shadow-lg" : l === "WARNING" ? "bg-amber-500 text-white border-amber-500 shadow-lg" : "bg-red-600 text-white border-red-600 shadow-lg")
                        : "bg-white text-[#49607e] border-[#e5e8eb] hover:bg-[#f1f4f7]"
                   }`}
                 >
                   {l === "INFO" && <Info className="h-4 w-4" />}
                   {l === "WARNING" && <AlertTriangle className="h-4 w-4" />}
                   {l === "EMERGENCY" && <ShieldAlert className="h-4 w-4" />}
                   {l}
                 </button>
               ))}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#49607e] uppercase tracking-widest mb-2">Transmission Title</label>
                <input
                  type="text"
                  placeholder="e.g. Scheduled Maintenance, System Upgrade..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-[#f1f4f7] border border-transparent rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:border-[#493ee5] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#49607e] uppercase tracking-widest mb-2">Broadcast Message</label>
                <textarea
                  placeholder="Detail the announcement..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-[#f1f4f7] border border-transparent rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:border-[#493ee5] transition-colors resize-none"
                />
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-[#e5e8eb] flex justify-center">
            <button
              onClick={handleBroadcast}
              disabled={loading}
              className="w-full max-w-xs flex items-center justify-center gap-3 py-4 bg-[#181c1e] text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-black transition-all shadow-ambient disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <Radio className="h-5 w-5" />
              )}
              {loading ? "Transmitting..." : "Initiate Blast"}
            </button>
          </div>
        </div>

        <div className="bg-[#f7fafd] rounded-3xl p-6 border border-[#e5e8eb] flex gap-5">
           <div className="p-3 bg-[#493ee5]/10 rounded-2xl h-fit">
              <CheckCircle2 className="h-6 w-6 text-[#493ee5]" />
           </div>
           <div className="space-y-1">
              <h3 className="font-extrabold text-[#181c1e] text-sm" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Propagation Logic</h3>
              <p className="text-xs font-medium text-[#49607e] leading-relaxed">
                Broadcasts are transmitted via the Red-Level WebSocket bus. Active sessions will receive a real-time toast notification, and the alert will be pinned to the Global Audit Ledger.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}
