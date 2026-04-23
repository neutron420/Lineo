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
  LayoutGrid,
  HeartPulse
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { toast } from "sonner";
import { useSocket } from "@/context/SocketContext";
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [appointments, setAppointments] = useState<any[]>([]);
  
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
    const fetchAppts = async () => {
      try {
        const resp = await api.get("/staff/appointments");
        setAppointments(resp.data.data || []);
      } catch (err) {
        console.error("Failed to fetch appointments:", err);
      }
    };
    fetchAppts();
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
    if (!activeQueue || !queueState || queueState.waiting_list.length === 0) return;
    
    // OPTIMISTIC UPDATE: Move first person in waiting to currently serving
    const nextInLine = queueState.waiting_list[0];
    const originalState = { ...queueState };
    
    setQueueState({
      ...queueState,
      currently_serving: nextInLine,
      waiting_list: queueState.waiting_list.slice(1)
    });

    try {
      setIsActionLoading(true);
      const resp = await api.post(`/staff/queue/${activeQueue}/next`);
      toast.success("Called next ticket", { 
        description: `Now serving ${resp.data.data.token_number}` 
      });
      // Final sync with server to ensure consistency
      await fetchQueueState(activeQueue);
    } catch (err: any) {
      setQueueState(originalState); // Rollback on error
      toast.error(err.response?.data?.message || "Failed to call next ticket");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCompleteCurrent = async () => {
    if (!activeQueue || !queueState?.currently_serving) return;
    
    const originalState = { ...queueState };
    // OPTIMISTIC: Clear currently serving
    setQueueState({ ...queueState, currently_serving: null });

    try {
      setIsActionLoading(true);
      await api.post(`/staff/queue/${activeQueue}/complete`);
      toast.success("Session Completed", { 
        description: "User archived. Terminal is now IDLE." 
      });
      await fetchQueueState(activeQueue);
    } catch (err: any) {
      setQueueState(originalState);
      toast.error(err.response?.data?.message || "Failed to complete session");
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
    
    const nextStatus = !queueState.is_paused;
    const originalStatus = queueState.is_paused;
    
    // OPTIMISTIC UPDATE
    setQueueState({ ...queueState, is_paused: nextStatus });

    try {
      await api.post(`/staff/queue/${activeQueue}/pause`, { is_paused: nextStatus });
      toast.info(nextStatus ? "Unit Suspended" : "Unit Operational");
    } catch (err: any) {
      setQueueState({ ...queueState, is_paused: originalStatus }); // Rollback
      toast.error("Failed to update unit status");
    }
  };

	

  if (isLoading) {
    return (
      <div className="space-y-8 w-full animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row justify-between gap-6">
          <div className="space-y-3">
            <Skeleton className="h-6 w-32 rounded-md" />
            <Skeleton className="h-12 w-64 rounded-xl" />
            <Skeleton className="h-4 w-48 rounded-lg" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-14 w-40 rounded-2xl" />
            <Skeleton className="h-14 w-40 rounded-2xl" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Content Area Skeleton */}
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white/50 border border-slate-100 rounded-[40px] p-12 min-h-[500px] flex flex-col items-center justify-center space-y-6">
              <Skeleton className="h-8 w-48 rounded-full" />
              <Skeleton className="h-40 w-64 rounded-3xl" />
              <Skeleton className="h-16 w-96 rounded-2xl" />
            </div>
            <div className="grid grid-cols-2 gap-8">
              <Skeleton className="h-48 w-full rounded-[32px]" />
              <Skeleton className="h-48 w-full rounded-[32px]" />
            </div>
          </div>

          {/* Sidebar Area Skeleton */}
          <div className="lg:col-span-4">
            <div className="bg-white/50 border border-slate-100 rounded-[40px] p-10 h-[600px] space-y-6">
              <div className="flex justify-between items-center">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-8 w-20 rounded-full" />
              </div>
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-[28px]" />
              ))}
            </div>
          </div>
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
            <h1 className="text-3xl md:text-5xl font-black text-[#181c1e] tracking-tight mb-4" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
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
                    className="bg-white border border-[#e5e8eb] text-sm font-bold text-[#181c1e] pl-9 pr-10 py-3 rounded-2xl outline-none focus:ring-4 focus:ring-[#493ee5]/5 transition-all cursor-pointer shadow-sm hover:border-[#493ee5]/30 appearance-none w-full sm:min-w-[240px]"
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
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
          >
             <button 
               onClick={() => setShowCreateModal(true)}
               className="px-6 py-4 bg-white text-[#493ee5] border border-[#493ee5]/10 rounded-[20px] font-black text-sm hover:bg-[#493ee5]/5 transition-all shadow-sm flex items-center justify-center gap-3 group"
             >
               <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
               Launch Unit
             </button>
             <button 
               onClick={togglePause}
               disabled={isActionLoading || !activeQueue}
               className={cn(
                 "px-6 py-4 rounded-[20px] font-black flex items-center justify-center gap-3 text-sm transition-all border shadow-sm disabled:opacity-30 disabled:grayscale",
                 queueState?.is_paused 
                   ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100" 
                   : "bg-[#181c1e] text-white border-transparent hover:opacity-90"
               )}
             >
               {queueState?.is_paused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
               {queueState?.is_paused ? "Resume" : "Suspend"}
             </button>
          </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column - Active Service */}
        <div className="lg:col-span-8 space-y-8">
            <motion.div 
              layout
              className="bg-white border border-[#e5e8eb] rounded-[32px] md:rounded-[40px] p-6 md:p-12 relative overflow-hidden flex flex-col items-center justify-center min-h-[400px] md:min-h-[500px] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.03)]"
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

                    <div className="text-[80px] sm:text-[120px] md:text-[160px] font-black text-[#181c1e] tracking-tighter leading-none mb-6 select-none" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                      {queueState.currently_serving.token_number}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-8 mb-10 md:mb-12">
                       <div className="flex items-center gap-3 text-[#49607e] font-bold text-base md:text-lg bg-slate-50 px-5 py-2 rounded-2xl border border-slate-100">
                          <UserIcon className="w-5 h-5 text-[#493ee5]" />
                          {queueState.currently_serving.username}
                       </div>
                       <div className="flex items-center gap-3 text-[#49607e] font-bold text-base md:text-lg bg-slate-50 px-5 py-2 rounded-2xl border border-slate-100">
                          <Clock className="w-5 h-5 text-[#493ee5]" />
                          T+{Math.floor((Date.now() - new Date(queueState.currently_serving.joined_at).getTime()) / 60000)}m
                       </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-lg">
                      <button
                        onClick={handleCompleteCurrent}
                        disabled={isActionLoading}
                        className="w-full sm:flex-1 py-6 bg-white text-[#181c1e] border border-[#181c1e]/10 rounded-[28px] font-black text-lg hover:bg-slate-50 active:scale-95 transition-all shadow-sm flex items-center justify-center gap-3"
                      >
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" /> Complete
                      </button>
                      <button
                        onClick={handleCallNext}
                        disabled={isActionLoading || (queueState?.waiting_list?.length || 0) === 0}
                        className="w-full sm:flex-1 py-6 bg-[#493ee5] text-white rounded-[28px] font-black text-lg hover:opacity-90 active:scale-95 transition-all shadow-[0_32px_64px_-12px_rgba(73,62,229,0.3)] flex items-center justify-center gap-3 group"
                      >
                        {isActionLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" /> Next</>}
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center text-center"
                  >
                    <div className="w-32 h-32 bg-slate-50 rounded-[32px] flex items-center justify-center mb-8 border border-slate-100 shadow-inner">
                       <Zap className="w-14 h-14 text-slate-300" />
                    </div>
                    <h3 className="text-3xl font-black text-slate-100 mb-4">Terminal Idle</h3>
                    <button
                      onClick={handleCallNext}
                      disabled={isActionLoading || (queueState?.waiting_list?.length || 0) === 0}
                      className="px-12 py-5 bg-[#493ee5] text-white rounded-[20px] font-black text-md shadow-2xl disabled:opacity-30 flex items-center gap-4"
                    >
                      Acquire Next Datapoint
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

           {/* Metrics Grid */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <div className="bg-white border border-[#e5e8eb] rounded-[32px] p-6 md:p-10 hover:shadow-2xl transition-all duration-500 group cursor-default">
                 <div className="flex items-center justify-between mb-6">
                    <div className="p-4 bg-[#493ee5]/5 rounded-2xl text-[#493ee5] group-hover:bg-[#493ee5] group-hover:text-white transition-all duration-500"><Users className="w-8 h-8" /></div>
                    <ArrowRight className="w-6 h-6 text-slate-200 group-hover:text-[#493ee5] transition-colors translate-x-0 group-hover:translate-x-2 transition-transform" />
                 </div>
                 <div className="text-sm font-black uppercase tracking-[0.2em] text-[#49607e] mb-2">Primary Buffer</div>
                 <div className="text-5xl md:text-6xl font-black text-[#181c1e] tracking-tighter" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                   {queueState?.waiting_list?.length || 0}
                 </div>
                 <p className="text-sm text-[#49607e] font-bold mt-4 opacity-60 uppercase tracking-widest">Entities in Pipeline</p>
              </div>
              <div className="bg-white border border-[#e5e8eb] rounded-[32px] p-6 md:p-10 hover:shadow-2xl transition-all duration-500 group cursor-default">
                 <div className="flex items-center justify-between mb-6">
                    <div className="p-4 bg-amber-50 rounded-2xl text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-all duration-500"><Zap className="w-8 h-8" /></div>
                    <ArrowRight className="w-6 h-6 text-slate-200 group-hover:text-amber-500 transition-colors translate-x-0 group-hover:translate-x-2 transition-transform" />
                 </div>
                 <div className="text-sm font-black uppercase tracking-[0.2em] text-[#49607e] mb-2">Total Latency</div>
                 <div className="text-5xl md:text-6xl font-black text-[#181c1e] tracking-tighter" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                   {queueState?.est_service_time || 0}<span className="text-xl md:text-2xl ml-2 font-black text-slate-300">MS</span>
                 </div>
                 <p className="text-sm text-[#49607e] font-bold mt-4 opacity-60 uppercase tracking-widest">Sync Interval</p>
              </div>
           </div>
        </div>

        {/* Right Column - Waiting List */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white border border-[#e5e8eb] rounded-[40px] p-8 flex flex-col shadow-sm">
             <div className="flex items-center justify-between mb-6">
                <div>
                   <h3 className="text-xl font-black text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Protocol Pipeline</h3>
                   <p className="text-[9px] text-[#493ee5] font-black mt-1 uppercase tracking-[0.2em]">Live Queue Stream</p>
                </div>
                <span className="bg-[#181c1e] text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest">
                  {queueState?.waiting_list?.length || 0} Entities
                </span>
             </div>

             <div className="space-y-3 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                <AnimatePresence initial={false}>
                  {queueState?.waiting_list?.map((entry, i) => (
                      <motion.div 
                        key={entry.token_number}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between p-4 rounded-2xl bg-[#f7fafd] border border-transparent hover:border-[#e5e8eb] hover:bg-white transition-all group"
                      >
                         <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[10px] font-black shadow-sm">{i + 1}</div>
                            <div>
                               <p className="font-black text-[#181c1e] text-sm">{entry.token_number}</p>
                               <p className="text-[10px] text-[#49607e] font-bold">{entry.username}</p>
                            </div>
                         </div>
                         {entry.has_disability && <HeartPulse className="w-4 h-4 text-emerald-500 animate-pulse" />}
                      </motion.div>
                  ))}
                </AnimatePresence>
             </div>
          </div>

          <div className="bg-white border border-[#e5e8eb] rounded-[40px] p-8 flex flex-col shadow-sm">
             <div className="flex items-center justify-between mb-6">
                <div>
                   <h3 className="text-xl font-black text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Engagement Schedule</h3>
                   <p className="text-[9px] text-[#493ee5] font-black mt-1 uppercase tracking-[0.2em]">Strategic Bookings</p>
                </div>
                <span className="bg-[#493ee5] text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest">
                  {appointments.length} Slots
                </span>
             </div>

             <div className="space-y-3 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                {appointments.length > 0 ? appointments.map((appt) => (
                  <div key={appt.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-[#493ee5]/10 hover:bg-white transition-all">
                      <div className="flex items-center justify-between mb-2">
                         <span className="text-[8px] font-black text-[#493ee5] uppercase">{appt.start_time}</span>
                         <Badge className="h-4 text-[7px] font-black px-1 uppercase bg-white border-slate-100">{appt.status}</Badge>
                      </div>
                      <p className="text-xs font-black text-[#181c1e]">{appt.username}</p>
                  </div>
                )) : (
                  <p className="text-[10px] text-slate-300 font-bold text-center py-10 italic">No scheduled engagements.</p>
                )}
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
