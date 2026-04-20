"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Settings, 
  Users, 
  Clock, 
  Pause, 
  Play, 
  Trash2, 
  CheckCircle2, 
  Loader2,
  Activity,
  Zap
} from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface Queue {
  id: number;
  name: string;
  queue_key: string;
  is_paused: boolean;
  est_service_time: number;
  total_users?: number;
}

export default function OrgQueuesPage() {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newQueue, setNewQueue] = useState({ name: "", est_service_time: 5 });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchQueues();
  }, []);

  const fetchQueues = async () => {
    try {
      setLoading(true);
      const resp = await api.get("/org/my");
      setQueues(resp.data.data.queues || []);
    } catch (err) {
      toast.error("Failed to load unit clusters");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQueue.name) return;
    setIsCreating(true);
    try {
      await api.post("/admin/queue", {
         name: newQueue.name,
         est_service_time: Number(newQueue.est_service_time)
      });
      toast.success(`Unit Vector Established: ${newQueue.name}`);
      setShowCreateModal(false);
      setNewQueue({ name: "", est_service_time: 5 });
      fetchQueues();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to establish unit vector.");
    } finally {
      setIsCreating(false);
    }
  };

  const togglePause = async (key: string, currentStatus: boolean) => {
    try {
      await api.post(`/staff/queue/${key}/pause`, { is_paused: !currentStatus });
      toast.success(currentStatus ? "Unit Online" : "Unit Suspended");
      setQueues(prev => prev.map(q => q.queue_key === key ? { ...q, is_paused: !currentStatus } : q));
    } catch (err) {
      toast.error("Protocol error: State transition failed");
    }
  };

	

  if (loading) {
    return (
      <div className="space-y-8 w-full animate-pulse">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="h-10 w-48 rounded-xl" />
            <Skeleton className="h-4 w-64 rounded-lg" />
          </div>
          <Skeleton className="h-14 w-40 rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white border border-slate-100 rounded-[32px] p-8 space-y-6">
              <div className="flex justify-between items-center">
                <Skeleton className="w-14 h-14 rounded-2xl" />
                <Skeleton className="w-10 h-8 rounded-xl" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-2/3" />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-6">
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="h-16 w-full rounded-2xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <h1 className="text-4xl font-black text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
             Unit Vectors
           </h1>
           <p className="text-[#49607e] text-sm font-medium mt-1">Configure and synchronize operational nodes.</p>
        </div>
        
        <button 
          onClick={() => setShowCreateModal(true)}
          className="bg-[#181c1e] text-white px-8 py-4 rounded-[20px] font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:translate-y-[-2px] transition-all flex items-center gap-3"
        >
          <Plus className="w-5 h-5" /> Establish Vector
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
         {queues.map((queue, i) => (
            <motion.div 
              key={queue.queue_key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                "bg-white border border-[#e5e8eb] rounded-[32px] p-8 shadow-sm group hover:shadow-2xl transition-all relative",
                queue.is_paused && "grayscale opacity-80"
              )}
            >
               <div className="flex items-start justify-between mb-8">
                  <div className="w-14 h-14 bg-[#f7fafd] group-hover:bg-[#493ee5] group-hover:text-white transition-colors rounded-2xl flex items-center justify-center text-[#493ee5] border border-[#e5e8eb]">
                     <Activity className="w-7 h-7" />
                  </div>
                  <button 
                    onClick={() => togglePause(queue.queue_key, queue.is_paused)}
                    className={cn(
                      "p-2.5 rounded-xl border transition-all shadow-sm",
                      queue.is_paused ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                    )}
                  >
                    {queue.is_paused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
                  </button>
               </div>

               <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-black text-[#493ee5] uppercase tracking-widest">v_{queue.queue_key}</span>
                    <h3 className="text-2xl font-black text-[#181c1e] tracking-tight group-hover:text-[#493ee5] transition-colors" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                       {queue.name}
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-[#f7fafd] p-4 rounded-2xl">
                        <p className="text-[9px] font-black text-[#49607e] uppercase tracking-widest mb-1">Proc Time</p>
                        <p className="text-sm font-black text-[#181c1e]">{queue.est_service_time}m</p>
                     </div>
                     <div className="bg-[#f7fafd] p-4 rounded-2xl">
                        <p className="text-[9px] font-black text-[#49607e] uppercase tracking-widest mb-1">Live Load</p>
                        <p className="text-sm font-black text-[#181c1e]">{queue.total_users || 0}</p>
                     </div>
                  </div>
               </div>
            </motion.div>
         ))}
      </div>

      {/* Modal - Simplified for this Page */}
      <AnimatePresence>
        {showCreateModal && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/5 backdrop-blur-xl">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-white border border-[#e5e8eb] rounded-[40px] shadow-2xl p-10">
                 <form onSubmit={handleCreateQueue} className="space-y-6">
                    <h2 className="text-2xl font-black text-[#181c1e]">New Vector</h2>
                    <input 
                      required
                      placeholder="Vector Name"
                      value={newQueue.name}
                      onChange={e => setNewQueue(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-6 py-4 bg-[#f7fafd] border border-[#e5e8eb] rounded-2xl outline-none focus:border-[#493ee5] font-bold text-[#181c1e]"
                    />
                    <div className="flex gap-3">
                       <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-4 border border-[#e5e8eb] rounded-2xl font-bold text-xs">Cancel</button>
                       <button disabled={isCreating} className="flex-1 bg-[#181c1e] text-white py-4 rounded-2xl font-bold text-xs uppercase tracking-widest">
                         {isCreating ? "Deploying..." : "Establish"}
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
