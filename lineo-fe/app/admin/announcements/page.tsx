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
  const [duration, setDuration] = useState<number>(0);
  const [history, setHistory] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);

  const fetchHistory = async () => {
    try {
      const res = await api.get("/admin/announcements");
      setHistory(res.data?.data || []);
    } catch (err) {
      console.error("Failed to fetch protocol history", err);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => setInitialLoading(false), 800);
    fetchHistory();
    return () => clearTimeout(t);
  }, []);

  const handleBroadcast = async () => {
    if (!title || !message) {
      toast.error("Protocol Error: Title and Message required for transmission.");
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        await api.put(`/admin/announcements/${editingId}`, { title, message, level, duration_minutes: duration });
        toast.success("Protocol updated successfully.");
      } else {
        await api.post("/admin/broadcast", { title, message, level, duration_minutes: duration });
        toast.success("Broadcast successfully transmitted to all active nodes.");
      }
      resetForm();
      fetchHistory();
    } catch (err) {
      toast.error("Transmission Failed: Cluster uplink disconnected.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Abort this broadcast protocol? It will be removed from all user nodes.")) return;
    try {
      await api.delete(`/admin/announcements/${id}`);
      toast.success("Protocol aborted.");
      fetchHistory();
    } catch (err) {
      toast.error("Failed to abort protocol.");
    }
  };

  const handleCompleteEarly = async (id: number) => {
    try {
      await api.put(`/admin/announcements/${id}`, { duration_minutes: -1 });
      toast.success("Protocol transitioned to COMPLETED state.");
      fetchHistory();
    } catch (err) {
      toast.error("Failed to complete protocol.");
    }
  };

  const startEdit = (ann: any) => {
    setEditingId(ann.id);
    setTitle(ann.title);
    setMessage(ann.message);
    setLevel(ann.level as BroadcastLevel);
    setDuration(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setMessage("");
    setLevel("INFO");
    setDuration(0);
  };

  const getLevelStyle = (l: BroadcastLevel) => {
    switch (l) {
      case "INFO": return "bg-[#493ee5] text-white";
      case "WARNING": return "bg-amber-500 text-white";
      case "EMERGENCY": return "bg-red-600 text-white";
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
    <div className="space-y-8 w-full pb-20">
      <Toaster position="top-right" expand={true} richColors />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e5e8eb] pb-6 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
            {editingId ? "Update Protocol" : "System Broadcaster"}
          </h1>
          <p className="text-sm text-[#49607e] font-medium mt-1">
            {editingId ? `Modifying Alpha-ID: ${editingId}` : "Transmit real-time global announcements to all connected cluster nodes."}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-500/20">
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
           <span className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-700">Uplink Active</span>
        </div>
      </div>

      <div className="space-y-12">
        {/* Broadcaster Form */}
        <div className="bg-white rounded-3xl border border-transparent shadow-ambient p-8 space-y-8 relative overflow-hidden">
          {editingId && (
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#493ee5]" />
          )}
          
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <label className="block text-xs font-bold text-[#49607e] uppercase tracking-widest mb-2">
                  {editingId ? "Extension (Minutes)" : "Duration (Minutes)"}
                </label>
                <input
                  type="number"
                  placeholder="Leave 0 for indefinite..."
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-[#f1f4f7] border border-transparent rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:border-[#493ee5] transition-colors"
                />
              </div>
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

          <div className="pt-6 border-t border-[#e5e8eb] flex items-center gap-3">
            <button
              onClick={handleBroadcast}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-3 py-4 bg-[#181c1e] text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-black transition-all shadow-ambient disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <Radio className="h-5 w-5" />
              )}
              {loading ? "Transmitting..." : (editingId ? "Update Protocol" : "Initiate Blast")}
            </button>
            {editingId && (
              <button
                onClick={resetForm}
                className="px-6 py-4 bg-[#f1f4f7] text-[#49607e] rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-[#e5e8eb] transition-all"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* History / Ledger List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-[#181c1e] uppercase tracking-widest flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-[#493ee5]" />
              Platform Protocol Ledger
            </h2>
            <button onClick={fetchHistory} className="text-[#493ee5] hover:underline text-xs font-bold uppercase tracking-widest">Refresh History</button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {history.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-[#e5e8eb]">
                <p className="text-[#49607e] font-medium italic">No active or past protocols found in the cluster ledger.</p>
              </div>
            ) : (
              history.map((ann) => (
                <div key={ann.id} className="bg-white rounded-3xl border border-[#e5e8eb] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:shadow-lg transition-all group">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-2xl shrink-0 ${getLevelStyle(ann.level)}`}>
                       {ann.level === "INFO" && <Info className="h-5 w-5" />}
                       {ann.level === "WARNING" && <AlertTriangle className="h-5 w-5" />}
                       {ann.level === "EMERGENCY" && <ShieldAlert className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-extrabold text-[#181c1e] leading-none">{ann.title}</h3>
                        <span className="text-[10px] font-bold text-[#49607e]">ID: {ann.id}</span>
                      </div>
                      <p className="text-sm text-[#49607e] font-medium">{ann.message}</p>
                      <div className="flex items-center gap-4 mt-2 text-[10px] font-bold uppercase tracking-widest">
                         <span className="text-[#493ee5]">Sent: {new Date(ann.created_at).toLocaleString()}</span>
                         {ann.expires_at && (
                           <span className="text-amber-600">Expires: {new Date(ann.expires_at).toLocaleString()}</span>
                         )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <button 
                      onClick={() => startEdit(ann)}
                      className="flex-1 md:flex-none px-4 py-2.5 bg-[#f1f4f7] text-[#181c1e] rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-[#493ee5] hover:text-white transition-all"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleCompleteEarly(ann.id)}
                      className="flex-1 md:flex-none px-4 py-2.5 bg-[#f1f4f7] text-[#181c1e] rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all"
                    >
                      Complete
                    </button>
                    <button 
                       onClick={() => handleDelete(ann.id)}
                       className="flex-1 md:flex-none px-4 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all underline-offset-4 decoration-red-500/30"
                    >
                      Abort
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
