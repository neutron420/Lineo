"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  CheckCircle2,
  Loader2,
  Activity,
  Zap,
  ArrowRight,
  Clock,
  User as UserIcon,
  X,
  HeartPulse,
  Volume2,
  Pause,
  Play,
  Hash,
  Phone,
  AlertTriangle,
} from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useSocket } from "@/context/SocketContext";

interface QueueEntry {
  token_number: string;
  user_id: number;
  username: string;
  phone_number: string;
  is_kiosk: boolean;
  priority: boolean;
  status: string;
  joined_at: string;
  has_disability?: boolean;
}

interface QueueState {
  queue_key: string;
  is_paused: boolean;
  est_service_time: number;
  currently_serving: QueueEntry | null;
  waiting_list: QueueEntry[];
  holding_list: QueueEntry[];
}

interface QueueInfo {
  name: string;
  queue_key: string;
  is_paused: boolean;
}

export default function OrgQueuesPage() {
  const [queues, setQueues] = useState<QueueInfo[]>([]);
  const [orgId, setOrgId] = useState<number | null>(null);
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [loading, setLoading] = useState(true);
  const [stateLoading, setStateLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const { subscribe, unsubscribe } = useSocket();

  const fetchQueues = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await api.get("/org/my");
      const org = resp.data.data;
      setOrgId(org.id);
      setQueues(org.queues || []);
      if (org.queues && org.queues.length > 0 && !selectedQueue) {
        const firstKey = org.queues[0].queue_key;
        setSelectedQueue(firstKey);
        fetchQueueState(firstKey);
      }
    } catch (err) {
      toast.error("Failed to load queues");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchQueueState = async (key: string) => {
    try {
      setStateLoading(true);
      const resp = await api.get<{ data: QueueState }>(`/queue/${key}/state`);
      setQueueState(resp.data.data);
    } catch (err) {
      console.error("Failed to fetch queue state:", err);
      setQueueState(null);
    } finally {
      setStateLoading(false);
    }
  };

  useEffect(() => {
    fetchQueues();
  }, [fetchQueues]);

  // WebSocket real-time sync
  useEffect(() => {
    if (orgId) {
      subscribe(orgId, (data: any) => {
        if (data.state && data.state.queue_key === selectedQueue) {
          setQueueState(data.state);
        }
      });
      return () => unsubscribe(orgId);
    }
  }, [orgId, selectedQueue, subscribe, unsubscribe]);

  const handleSelectQueue = (key: string) => {
    setSelectedQueue(key);
    fetchQueueState(key);
  };

  const handleCallNext = async () => {
    if (!selectedQueue || !queueState || queueState.waiting_list.length === 0) return;
    
    // OPTIMISTIC: Move first into serving
    const nextInLine = queueState.waiting_list[0];
    const prevQueueState = { ...queueState };
    setQueueState({
      ...queueState,
      currently_serving: nextInLine,
      waiting_list: queueState.waiting_list.slice(1)
    });

    try {
      setActionLoading(true);
      await api.post(`/staff/queue/${selectedQueue}/next`);
      toast.success(`Active engagement: ${nextInLine.username}`);
    } catch (err: any) {
      setQueueState(prevQueueState); // Rollback
      toast.error(err.response?.data?.message || "Failed to call next");
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!selectedQueue || !queueState?.currently_serving) return;
    const prevQueueState = { ...queueState };
    // OPTIMISTIC: Clear serving
    setQueueState({ ...queueState, currently_serving: null });

    try {
      setActionLoading(true);
      await api.post(`/staff/queue/${selectedQueue}/complete`);
      toast.success("Vector execution complete");
    } catch (err: any) {
      setQueueState(prevQueueState); // Rollback
      toast.error(err.response?.data?.message || "Failed to complete");
    } finally {
      setActionLoading(false);
    }
  };

  const handleNoShow = async (token: string) => {
    if (!selectedQueue || !queueState) return;
    const prevQueueState = { ...queueState };
    
    // OPTIMISTIC: Remove from waitlist
    setQueueState({
      ...queueState,
      waiting_list: queueState.waiting_list.filter(e => e.token_number !== token)
    });

    try {
      await api.post(`/staff/queue/${selectedQueue}/noshow/${token}`);
      toast.info(`Ticket ${token} archived: No-Show`);
    } catch (err: any) {
      setQueueState(prevQueueState); // Rollback
      toast.error(err.response?.data?.message || "Failed to mark no-show");
    }
  };

  const handleInstantComplete = async (entry: QueueEntry) => {
    if (!selectedQueue || !queueState) return;
    const prevQueueState = { ...queueState };

    // OPTIMISTIC: Remove from waitlist
    setQueueState({
      ...queueState,
      waiting_list: queueState.waiting_list.filter(e => e.token_number !== entry.token_number)
    });

    try {
      setActionLoading(true);
      // Backend: Call next then complete (Sequential on server)
      await api.post(`/staff/queue/${selectedQueue}/next`);
      await api.post(`/staff/queue/${selectedQueue}/complete`);
      toast.success(`${entry.username}: Completed`);
    } catch (err: any) {
      setQueueState(prevQueueState); // Rollback
      toast.error("Process synchronization failed");
    } finally {
      setActionLoading(false);
    }
  };

  const togglePause = async () => {
    if (!selectedQueue || !queueState) return;
    const nextStatus = !queueState.is_paused;
    try {
      await api.post(`/staff/queue/${selectedQueue}/pause`, { is_paused: nextStatus });
      toast.info(nextStatus ? "Queue paused" : "Queue resumed");
      setQueueState({ ...queueState, is_paused: nextStatus });
    } catch (err) {
      toast.error("Failed to update queue status");
    }
  };

  const getTimeSince = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  };

  if (loading) {
    return (
      <div className="space-y-6 w-full animate-pulse">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3 space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
          <div className="col-span-9">
            <Skeleton className="h-[600px] rounded-[32px]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1
            className="text-4xl font-black text-[#181c1e] tracking-tight"
            style={{ fontFamily: "var(--font-manrope), sans-serif" }}
          >
            Queue Operations
          </h1>
          <p className="text-sm text-[#49607e] font-medium mt-1">
            Select a queue, manage the waiting list, verify arrivals, and complete sessions.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ─── Left: Queue Selector ─── */}
        <div className="lg:col-span-3 space-y-3">
          <p className="text-[10px] font-black text-[#49607e] uppercase tracking-[0.2em] px-1 mb-2">
            Active Queues
          </p>
          {queues.length === 0 ? (
            <div className="bg-white border border-[#e5e8eb] rounded-2xl p-8 text-center">
              <Hash className="w-8 h-8 text-slate-200 mx-auto mb-3" />
              <p className="text-xs font-bold text-slate-400">No queues created yet</p>
            </div>
          ) : (
            queues.map((q) => (
              <button
                key={q.queue_key}
                onClick={() => handleSelectQueue(q.queue_key)}
                className={cn(
                  "w-full text-left p-5 rounded-2xl border transition-all group",
                  selectedQueue === q.queue_key
                    ? "bg-[#493ee5] text-white border-[#493ee5] shadow-lg shadow-[#493ee5]/20"
                    : "bg-white text-[#181c1e] border-[#e5e8eb] hover:border-[#493ee5]/30 hover:shadow-md"
                )}
              >
                <div className="flex items-center gap-3">
                  <Activity
                    className={cn(
                      "w-5 h-5 shrink-0",
                      selectedQueue === q.queue_key ? "text-white/80" : "text-[#493ee5]"
                    )}
                  />
                  <div className="min-w-0">
                    <p className="font-black text-sm truncate">{q.name}</p>
                    <p
                      className={cn(
                        "text-[9px] font-bold uppercase tracking-widest mt-0.5",
                        selectedQueue === q.queue_key ? "text-white/60" : "text-[#49607e]"
                      )}
                    >
                      {q.queue_key}
                    </p>
                  </div>
                </div>
                {q.is_paused && (
                  <span className="mt-2 inline-block text-[8px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                    Paused
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {/* ─── Right: Queue Detail ─── */}
        <div className="lg:col-span-9 space-y-6">
          {!selectedQueue ? (
            <div className="bg-white border border-[#e5e8eb] rounded-[32px] p-20 text-center">
              <Zap className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <h3 className="text-xl font-black text-[#181c1e] mb-2">Select a Queue</h3>
              <p className="text-sm text-[#49607e]">
                Choose a queue from the left to start managing it.
              </p>
            </div>
          ) : stateLoading ? (
            <div className="bg-white border border-[#e5e8eb] rounded-[32px] p-20 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-[#493ee5] animate-spin" />
            </div>
          ) : (
            <>
              {/* ── Controls Bar ── */}
              <div className="bg-white border border-[#e5e8eb] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2.5 h-2.5 rounded-full", queueState?.is_paused ? "bg-amber-400" : "bg-emerald-500 animate-pulse")} />
                    <span className="text-xs font-black text-[#181c1e] uppercase tracking-widest">
                      {queueState?.is_paused ? "Paused" : "Live"}
                    </span>
                  </div>
                  <div className="h-5 w-px bg-[#e5e8eb]" />
                  <span className="text-xs text-[#49607e] font-bold">
                    <span className="text-[#181c1e] font-black">{queueState?.waiting_list?.length || 0}</span> waiting
                  </span>
                  <div className="h-5 w-px bg-[#e5e8eb]" />
                  <span className="text-xs text-[#49607e] font-bold">
                    Est. <span className="text-[#181c1e] font-black">{queueState?.est_service_time || 0}m</span> / person
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePause}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 border transition-all",
                      queueState?.is_paused
                        ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                        : "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
                    )}
                  >
                    {queueState?.is_paused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
                    {queueState?.is_paused ? "Resume" : "Pause"}
                  </button>
                  <button
                    onClick={handleCallNext}
                    disabled={actionLoading || (queueState?.waiting_list?.length || 0) === 0}
                    className="px-5 py-2.5 bg-[#493ee5] text-white rounded-xl text-xs font-black flex items-center gap-2 hover:opacity-90 disabled:opacity-30 transition-all shadow-md shadow-[#493ee5]/20"
                  >
                    {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
                    Call Next
                  </button>
                </div>
              </div>

              {/* ── Currently Serving ── */}
              <div className="bg-white border border-[#e5e8eb] rounded-[28px] p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#493ee5] opacity-[0.02] rounded-full blur-[80px] pointer-events-none" />
                <p className="text-[10px] font-black text-[#49607e] uppercase tracking-[0.2em] mb-4">
                  Currently Serving
                </p>
                {queueState?.currently_serving ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-[#493ee5]/10 rounded-2xl flex items-center justify-center">
                        <span className="text-xl font-black text-[#493ee5]">
                          {queueState.currently_serving.token_number}
                        </span>
                      </div>
                      <div>
                        <h3
                          className="text-xl font-black text-[#181c1e]"
                          style={{ fontFamily: "var(--font-manrope), sans-serif" }}
                        >
                          {queueState.currently_serving.username}
                        </h3>
                        <div className="flex items-center gap-4 mt-1">
                          {queueState.currently_serving.phone_number && (
                            <span className="flex items-center gap-1 text-xs text-[#49607e] font-medium">
                              <Phone className="w-3 h-3" /> {queueState.currently_serving.phone_number}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-[#49607e] font-medium">
                            <Clock className="w-3 h-3" /> Joined {getTimeSince(queueState.currently_serving.joined_at)}
                          </span>
                          {queueState.currently_serving.has_disability && (
                            <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold">
                              <HeartPulse className="w-3.5 h-3.5 animate-pulse" /> Care Required
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleComplete}
                      disabled={actionLoading}
                      className="px-8 py-4 bg-emerald-500 text-white rounded-2xl font-black text-sm flex items-center gap-3 hover:bg-emerald-600 active:scale-95 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-5 h-5" /> Complete Session
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 py-4 opacity-40">
                    <Zap className="w-8 h-8 text-slate-300" />
                    <div>
                      <p className="font-black text-[#181c1e]">No one being served</p>
                      <p className="text-xs text-[#49607e]">Click &quot;Call Next&quot; to bring the next person</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Waiting List ── */}
              <div className="bg-white border border-[#e5e8eb] rounded-[28px] p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3
                      className="text-lg font-black text-[#181c1e]"
                      style={{ fontFamily: "var(--font-manrope), sans-serif" }}
                    >
                      Waiting List
                    </h3>
                    <p className="text-[10px] text-[#49607e] font-bold uppercase tracking-widest mt-0.5">
                      People in queue — verify & manage
                    </p>
                  </div>
                  <span className="bg-[#181c1e] text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest">
                    {queueState?.waiting_list?.length || 0} waiting
                  </span>
                </div>

                {queueState?.waiting_list && queueState.waiting_list.length > 0 ? (
                  <div className="space-y-3">
                    <AnimatePresence initial={false}>
                      {queueState.waiting_list.map((entry, i) => (
                        <motion.div
                          key={entry.token_number}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.2 }}
                          className={cn(
                            "flex items-center justify-between p-5 rounded-2xl border transition-all group",
                            entry.priority
                              ? "bg-amber-50/50 border-amber-100"
                              : "bg-[#f7fafd] border-transparent hover:border-[#e5e8eb] hover:bg-white hover:shadow-md"
                          )}
                        >
                          <div className="flex items-center gap-5">
                            {/* Position */}
                            <div
                              className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0 border",
                                entry.priority
                                  ? "bg-amber-500 text-white border-amber-400"
                                  : "bg-white text-[#49607e] border-slate-100"
                              )}
                            >
                              {entry.priority ? "!" : i + 1}
                            </div>

                            {/* Info */}
                            <div>
                              <div className="flex items-center gap-3">
                                <span
                                  className="font-black text-[#181c1e] text-base"
                                  style={{ fontFamily: "var(--font-manrope), sans-serif" }}
                                >
                                  {entry.username}
                                </span>
                                <span className="text-[10px] font-bold text-[#493ee5] bg-[#493ee5]/5 px-2 py-0.5 rounded">
                                  {entry.token_number}
                                </span>
                                {entry.is_kiosk && (
                                  <span className="text-[8px] font-black bg-slate-900 text-white px-1.5 py-0.5 rounded uppercase">
                                    Kiosk
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-1.5">
                                {entry.phone_number && (
                                  <span className="flex items-center gap-1 text-[10px] text-[#49607e] font-medium">
                                    <Phone className="w-3 h-3" /> {entry.phone_number}
                                  </span>
                                )}
                                <span className="flex items-center gap-1 text-[10px] text-[#49607e] font-medium">
                                  <Clock className="w-3 h-3" /> {getTimeSince(entry.joined_at)}
                                </span>
                                {entry.has_disability && (
                                  <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
                                    <HeartPulse className="w-3.5 h-3.5 animate-pulse" /> Care Required
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions — Always Visible */}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleNoShow(entry.token_number)}
                              className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"
                              title="Mark as No Show — person didn't arrive"
                            >
                              <X className="w-3.5 h-3.5" /> No Show
                            </button>
                            <button
                              onClick={() => handleInstantComplete(entry)}
                              disabled={actionLoading}
                              className="px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-40"
                              title="Mark as Done — person has been served"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Done
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="py-16 text-center opacity-30">
                    <Users className="w-12 h-12 mx-auto mb-3" />
                    <p className="font-black text-xs uppercase tracking-[0.2em]">Queue is empty</p>
                    <p className="text-[10px] text-[#49607e] mt-1">
                      No one is currently waiting in this queue
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
