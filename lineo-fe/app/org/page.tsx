"use client";

import { 
  Users, 
  Volume2, 
  CheckCircle2, 
  X, 
  Clock, 
  Play, 
  Pause,
  AlertCircle,
  Hash,
  ArrowRight,
  User as UserIcon,
  Loader2,
  Plus,
  Zap,
  LayoutGrid
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { toast } from "sonner";
import { useSocket } from "@/context/SocketContext";
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface QueueEntry {
  token_number: string;
  user_id: number;
  username: string;
  phone_number: string;
  is_kiosk: boolean;
  priority: boolean;
  status: string;
  joined_at: string;
}

interface QueueState {
  queue_key: string;
  is_paused: boolean;
  est_service_time: number;
  currently_serving: QueueEntry | null;
  waiting_list: QueueEntry[];
  holding_list: QueueEntry[];
}

interface Organization {
  id: number;
  name: string;
  queues: { name: string; queue_key: string; is_paused: boolean }[];
}

export default function OrgDashboard() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [activeQueue, setActiveQueue] = useState<string | null>(null);
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newQueueName, setNewQueueName] = useState("");
  const [newQueueKey, setNewQueueKey] = useState("");
  
  const { subscribe, unsubscribe } = useSocket();
  const router = useRouter();

  const fetchInitialData = useCallback(async () => {
    const token = sessionStorage.getItem("staff_token");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setIsLoading(true);
      const orgResp = await api.get<{ data: Organization }>("/org/my");
      const organization = orgResp.data.data;
      setOrg(organization);

      if (organization.queues && organization.queues.length > 0) {
        const firstKey = organization.queues[0].queue_key;
        setActiveQueue(firstKey);
        await fetchQueueState(firstKey);
      } else {
        setActiveQueue(null);
        setQueueState(null);
      }
    } catch (err) {
      console.error("Failed to fetch initial data:", err);
      if ((err as any).response?.status === 401) {
        router.push("/login");
      } else {
        toast.error("Failed to load organization data");
      }
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const fetchQueueState = async (key: string) => {
    try {
      const stateResp = await api.get<{ data: QueueState }>(`/queue/${key}/state`);
      setQueueState(stateResp.data.data);
    } catch (err) {
      console.error("Failed to fetch queue state:", err);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (org?.id) {
      subscribe(org.id, (data: any) => {
        if (data.state && data.state.queue_key === activeQueue) {
          setQueueState(data.state);
        }
      });
      return () => unsubscribe(org.id);
    }
  }, [org?.id, activeQueue, subscribe, unsubscribe]);

  const handleCreateQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQueueName || !newQueueKey) return;

    try {
      setIsActionLoading(true);
      await api.post("/org/queue", {
        name: newQueueName,
        queue_key: newQueueKey.toUpperCase()
      });
      toast.success("Operational Unit Launched", { description: `${newQueueName} is now live.` });
      setShowCreateModal(false);
      setNewQueueName("");
      setNewQueueKey("");
      await fetchInitialData();
    } catch (err: any) {
      const status = err.response?.status;
      const data = err.response?.data;
      const msg = data?.detail || data?.message || "Failed to create unit";
      toast.error(`Process Halted ${status ? `[Err: ${status}]` : ""}`, { 
        description: msg,
        duration: 8000
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCallNext = async () => {
    if (!activeQueue) return;
    try {
      setIsActionLoading(true);
      const resp = await api.post(`/staff/queue/${activeQueue}/next`);
      toast.success("Called next ticket", { 
        description: `Now serving ${resp.data.data.token_number}` 
      });
      await fetchQueueState(activeQueue);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to call next ticket");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleNoShow = async (token: string) => {
    if (!activeQueue) return;
    try {
      await api.post(`/staff/queue/${activeQueue}/noshow/${token}`);
      toast.info(`Ticket ${token} marked as No-Show`);
      await fetchQueueState(activeQueue);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to mark no-show");
    }
  };

  const togglePause = async () => {
    if (!activeQueue || !queueState) return;
    try {
      const nextStatus = !queueState.is_paused;
      await api.post(`/staff/queue/${activeQueue}/pause`, { is_paused: nextStatus });
      toast.info(nextStatus ? "Unit Suspended" : "Unit Operational");
      setQueueState({ ...queueState, is_paused: nextStatus });
    } catch (err: any) {
      toast.error("Failed to update unit status");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-[#493ee5] animate-spin" />
          <p className="text-[#49607e] font-medium animate-pulse text-sm">Synchronizing Live Feed...</p>
        </div>
      </div>
    );
  }

  if (!org) return <div>Auth required. Redirecting...</div>;

  return (
    <div className="space-y-8 w-full">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
         <motion.div 
           initial={{ opacity: 0, x: -20 }}
           animate={{ opacity: 1, x: 0 }}
         >
            <div className="flex items-center gap-3 mb-2">
               <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-extrabold uppercase tracking-widest rounded-md border border-emerald-100 flex items-center gap-1.5 shadow-sm">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Terminal Online
               </span>
               <span className="text-[#49607e] text-xs font-bold uppercase tracking-widest opacity-60">{org.name}</span>
            </div>
            <h1 className="text-5xl font-black text-[#181c1e] tracking-tight mb-4" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
              Operations Feed
            </h1>
            <div className="flex items-center gap-4">
               <div className="relative group">
                  <LayoutGrid className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#493ee5] z-10" />
                  <select 
                    value={activeQueue || ""} 
                    onChange={(e) => {
                        setActiveQueue(e.target.value);
                        fetchQueueState(e.target.value);
                    }}
                    className="bg-white border border-[#e5e8eb] text-sm font-bold text-[#181c1e] pl-9 pr-10 py-3 rounded-2xl outline-none focus:ring-4 focus:ring-[#493ee5]/5 transition-all cursor-pointer shadow-sm hover:border-[#493ee5]/30 appearance-none min-w-[240px]"
                  >
                    {org?.queues?.map(q => (
                      <option key={q.queue_key} value={q.queue_key}>{q.name}</option>
                    )) || <option value="">No Active Units</option>}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#49607e]">
                    <ArrowRight className="w-4 h-4 rotate-90" />
                  </div>
               </div>
               <div className="h-6 w-px bg-slate-200 mx-2" />
               <p className="text-[#49607e] text-sm font-medium">Session ID: <span className="text-[#181c1e] font-black uppercase tracking-wider">ALPHA-2</span></p>
            </div>
         </motion.div>

         <motion.div 
           initial={{ opacity: 0, x: 20 }}
           animate={{ opacity: 1, x: 0 }}
           className="flex items-center gap-3"
         >
            <button 
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-4 bg-white text-[#493ee5] border border-[#493ee5]/10 rounded-[20px] font-black text-sm hover:bg-[#493ee5]/5 transition-all shadow-sm flex items-center gap-3 group"
            >
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
              Launch New Unit
            </button>
            <button 
              onClick={togglePause}
              disabled={isActionLoading || !activeQueue}
              className={cn(
                "px-6 py-4 rounded-[20px] font-black flex items-center gap-3 text-sm transition-all border shadow-sm disabled:opacity-30 disabled:grayscale",
                queueState?.is_paused 
                  ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100" 
                  : "bg-[#181c1e] text-white border-transparent hover:opacity-90"
              )}
            >
              {queueState?.is_paused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
              {queueState?.is_paused ? "Resume Operations" : "Suspend Unit"}
            </button>
         </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column - Active Service */}
        <div className="lg:col-span-8 space-y-8">
           <motion.div 
             layout
             className="bg-white border border-[#e5e8eb] rounded-[40px] p-12 relative overflow-hidden flex flex-col items-center justify-center min-h-[500px] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.03)]"
           >
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#493ee5] opacity-[0.02] rounded-full blur-[120px] pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-emerald-500 opacity-[0.02] rounded-full blur-[100px] pointer-events-none" />
              
              <AnimatePresence mode="wait">
                {queueState?.currently_serving ? (
                  <motion.div 
                    key={queueState.currently_serving.token_number}
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    className="flex flex-col items-center text-center w-full"
                  >
                    <div className="mb-10">
                       <span className="px-6 py-2 bg-[#493ee5]/5 text-[#493ee5] text-xs font-black uppercase tracking-[0.3em] rounded-full border border-[#493ee5]/10">
                          Active Vector Engagement
                       </span>
                    </div>

                    <div className="text-[160px] font-black text-[#181c1e] tracking-tighter leading-none mb-6 select-none" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                      {queueState.currently_serving.token_number}
                    </div>

                    <div className="flex items-center gap-8 mb-12">
                       <div className="flex items-center gap-3 text-[#49607e] font-bold text-lg bg-slate-50 px-5 py-2 rounded-2xl border border-slate-100">
                          <UserIcon className="w-5 h-5 text-[#493ee5]" />
                          {queueState.currently_serving.username || "Guest Agent"}
                       </div>
                       <div className="flex items-center gap-3 text-[#49607e] font-bold text-lg bg-slate-50 px-5 py-2 rounded-2xl border border-slate-100">
                          <Clock className="w-5 h-5 text-[#493ee5]" />
                          T+{Math.floor((Date.now() - new Date(queueState.currently_serving.joined_at).getTime()) / 60000)}m
                       </div>
                    </div>
                    
                    <button
                      onClick={handleCallNext}
                      disabled={isActionLoading}
                      className="w-full max-w-lg py-6 bg-[#493ee5] text-white rounded-[24px] font-black text-lg hover:opacity-90 active:scale-95 transition-all shadow-[0_32px_64px_-12px_rgba(73,62,229,0.3)] flex items-center justify-center gap-4 group"
                    >
                      {isActionLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><CheckCircle2 className="w-6 h-6 group-hover:scale-110 transition-transform" /> Mission Complete & Next</>}
                    </button>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center text-center"
                  >
                    <div className="w-32 h-32 bg-slate-50 rounded-[32px] flex items-center justify-center mb-8 border border-slate-100 shadow-inner group-hover:rotate-12 transition-transform duration-500">
                       <Zap className="w-14 h-14 text-slate-300" />
                    </div>
                    {org.queues?.length > 0 ? (
                      <>
                        <h3 className="text-3xl font-black text-slate-900 mb-4" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Terminal Idle</h3>
                        <p className="text-slate-500 font-medium max-w-[320px] leading-relaxed mb-10">
                          Secure line established. No operational vectors are currently assigned to this terminal. 
                        </p>
                        <button
                          onClick={handleCallNext}
                          disabled={isActionLoading || (queueState?.waiting_list?.length || 0) === 0}
                          className="px-12 py-5 bg-[#493ee5] text-white rounded-[20px] font-black text-md shadow-2xl disabled:opacity-30 disabled:grayscale flex items-center gap-4 hover:translate-y-[-2px] active:translate-y-[0px] transition-all"
                        >
                          {isActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Volume2 className="w-5 h-5" />}
                          Acquire Next Datapoint
                        </button>
                      </>
                    ) : (
                      <>
                        <h3 className="text-3xl font-black text-slate-900 mb-4" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Zero Operational Units</h3>
                        <p className="text-slate-500 font-medium max-w-[360px] leading-relaxed mb-10">
                          The system is currently dormant. You must initialize your first operational unit to begin processing vectors.
                        </p>
                        <button
                          onClick={() => setShowCreateModal(true)}
                          className="px-12 py-5 bg-[#181c1e] text-white rounded-[20px] font-black text-md shadow-2xl flex items-center gap-4 hover:scale-105 transition-all"
                        >
                          <Plus className="w-6 h-6" />
                          Launch Terminal Alpha
                        </button>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
           </motion.div>

           {/* Metrics Grid */}
           <div className="grid grid-cols-2 gap-8">
              <div className="bg-white border border-[#e5e8eb] rounded-[32px] p-10 hover:shadow-2xl transition-all duration-500 group cursor-default">
                 <div className="flex items-center justify-between mb-6">
                    <div className="p-4 bg-[#493ee5]/5 rounded-2xl text-[#493ee5] group-hover:bg-[#493ee5] group-hover:text-white transition-all duration-500"><Users className="w-8 h-8" /></div>
                    <ArrowRight className="w-6 h-6 text-slate-200 group-hover:text-[#493ee5] transition-colors translate-x-0 group-hover:translate-x-2 transition-transform" />
                 </div>
                 <div className="text-sm font-black uppercase tracking-[0.2em] text-[#49607e] mb-2">Primary Buffer</div>
                 <div className="text-6xl font-black text-[#181c1e] tracking-tighter" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                   {queueState?.waiting_list?.length || 0}
                 </div>
                 <p className="text-sm text-[#49607e] font-bold mt-4 opacity-60 uppercase tracking-widest">Entities in Pipeline</p>
              </div>
              <div className="bg-white border border-[#e5e8eb] rounded-[32px] p-10 hover:shadow-2xl transition-all duration-500 group cursor-default">
                 <div className="flex items-center justify-between mb-6">
                    <div className="p-4 bg-amber-50 rounded-2xl text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-all duration-500"><Zap className="w-8 h-8" /></div>
                    <ArrowRight className="w-6 h-6 text-slate-200 group-hover:text-amber-500 transition-colors translate-x-0 group-hover:translate-x-2 transition-transform" />
                 </div>
                 <div className="text-sm font-black uppercase tracking-[0.2em] text-[#49607e] mb-2">Total Latency</div>
                 <div className="text-6xl font-black text-[#181c1e] tracking-tighter" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                   {queueState?.est_service_time || 0}<span className="text-2xl ml-2 font-black text-slate-300">MS</span>
                 </div>
                 <p className="text-sm text-[#49607e] font-bold mt-4 opacity-60 uppercase tracking-widest">Sync Interval</p>
              </div>
           </div>
        </div>

        {/* Right Column - Waiting List */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white border border-[#e5e8eb] rounded-[40px] p-10 flex flex-col h-full shadow-sm sticky top-28">
            <div className="flex items-center justify-between mb-10">
               <div>
                  <h3 className="text-2xl font-black text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Protocol Pipeline</h3>
                  <p className="text-xs text-[#493ee5] font-black mt-2 uppercase tracking-[0.2em]">Secure Data Stream</p>
               </div>
               <span className="bg-[#181c1e] text-white text-[11px] font-black px-4 py-2 rounded-full uppercase tracking-widest shadow-lg">
                 {queueState?.waiting_list?.length || 0} Entities
               </span>
            </div>

            <div className="space-y-4 overflow-y-auto custom-scrollbar flex-1 pr-2 max-h-[700px]">
               <AnimatePresence initial={false}>
                 {(queueState?.waiting_list && queueState.waiting_list.length > 0) ? (
                   queueState.waiting_list.map((entry, i) => (
                      <motion.div 
                        key={entry.token_number}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className={cn(
                          "flex items-center justify-between p-6 rounded-[28px] border transition-all group relative overflow-hidden",
                          entry.priority ? "bg-amber-50/40 border-amber-100" : "bg-[#f7fafd]/50 border-transparent hover:border-[#e5e8eb] hover:bg-white hover:shadow-xl"
                        )}
                      >
                         <div className="flex items-center gap-6">
                            <div className={cn(
                              "w-12 h-12 rounded-[18px] flex items-center justify-center text-[10px] font-black shadow-sm shrink-0 transition-all",
                              entry.priority ? "bg-amber-500 text-white rotate-6" : "bg-white text-[#49607e] border border-slate-100 group-hover:bg-[#493ee5] group-hover:text-white group-hover:-rotate-6"
                            )}>
                              {entry.priority ? "PRIO" : `#${i + 1}`}
                            </div>
                            <div>
                              <div className="flex items-center gap-3">
                                <span className="font-black text-[#181c1e] text-xl tracking-tighter" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{entry.token_number}</span>
                                {entry.is_kiosk && <span className="px-2 py-0.5 bg-slate-900 text-white text-[8px] font-black rounded uppercase tracking-tighter">Kiosk</span>}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-[#49607e] font-bold mt-1.5 uppercase tracking-wide opacity-70">
                                <UserIcon className="w-3 h-3" /> {entry.username}
                              </div>
                            </div>
                         </div>
                         <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100 transform z-10">
                            <button 
                              onClick={() => handleNoShow(entry.token_number)}
                              className="p-4 bg-white border border-red-100 rounded-2xl hover:bg-red-600 hover:text-white text-red-600 transition-all shadow-lg active:scale-90"
                            >
                               <X className="w-5 h-5 font-bold" />
                            </button>
                         </div>
                      </motion.div>
                   ))
                 ) : (
                   <div className="flex flex-col items-center justify-center py-32 opacity-20">
                      <Hash className="w-16 h-16 mb-6" />
                      <p className="font-black text-xs uppercase tracking-[0.3em]">No Active Datasets</p>
                   </div>
                 )}
               </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* ━━━ Create Queue Modal ━━━ */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 sm:p-10">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-[#181c1e]/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-[500px] rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col border border-white/20 p-10"
            >
               <div className="absolute top-0 right-0 w-40 h-40 bg-[#493ee5] opacity-5 rounded-full blur-3xl pointer-events-none" />
               
               <div className="mb-10 text-center">
                  <div className="w-16 h-16 bg-[#493ee5]/10 rounded-[20px] flex items-center justify-center mx-auto mb-6">
                    <Plus className="w-8 h-8 text-[#493ee5]" />
                  </div>
                  <h2 className="text-3xl font-black text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                    Launch New Unit
                  </h2>
                  <p className="text-slate-500 font-medium text-sm mt-3">Initialize a new operational vector in the system.</p>
               </div>

               <form onSubmit={handleCreateQueue} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Unit Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Primary Registration"
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-[#493ee5]/5 focus:border-[#493ee5] focus:bg-white transition-all font-bold text-slate-800"
                      value={newQueueName}
                      onChange={(e) => setNewQueueName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Operational Key</label>
                    <input 
                      type="text" 
                      placeholder="e.g. REG-01"
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-[#493ee5]/5 focus:border-[#493ee5] focus:bg-white transition-all font-bold text-slate-800 uppercase"
                      value={newQueueKey}
                      onChange={(e) => setNewQueueKey(e.target.value)}
                      required
                    />
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
                    >
                      Abort
                    </button>
                    <button 
                      type="submit"
                      disabled={isActionLoading}
                      className="flex-1 py-4 bg-[#493ee5] text-white rounded-2xl font-black text-sm shadow-xl hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4 fill-current" /> Initialize Unit</>}
                    </button>
                  </div>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
