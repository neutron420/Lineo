"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  ChevronRight, 
  Plus, 
  CalendarDays,
  MoreVertical,
  Bell,
  Navigation,
  Loader2,
  X,
  Search,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ queue_key: "", time: "" });

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    setIsLoading(true);
    try {
      const resp = await api.get("/appointments");
      setAppointments(resp.data.data || []);
    } catch (err) {
      console.error("Failed to fetch appointments", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Format date as YYYY-MM-DD HH:MM for the backend
    const dateObj = new Date(formData.time);
    const formattedDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

    try {
      await api.post("/appointments/book", {
        queue_key: formData.queue_key,
        start_time: formattedDate
      });
      setIsModalOpen(false);
      setFormData({ queue_key: "", time: "" });
      await fetchAppointments();
      alert("Appointment scheduled successfully!");
    } catch (err) {
      alert("Booking failed. Please check the queue code and time slot.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-10 text-left">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-light text-stripe-navy tracking-tight">My Appointments</h1>
          <p className="text-stripe-slate text-lg font-light">Manage your upcoming sessions and commute alerts.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="stripe-btn-primary py-2.5 px-6 flex items-center gap-2 text-sm font-bold shadow-lg shadow-stripe-purple/20"
        >
          <Plus className="w-4 h-4" /> Schedule New
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main List */}
        <div className="xl:col-span-2 space-y-6">
          {isLoading ? (
            <div className="flex flex-col gap-6">
              {[1,2,3].map(i => <div key={i} className="h-40 bg-white rounded-3xl animate-pulse border border-stripe-border"></div>)}
            </div>
          ) : appointments.length > 0 ? (
            appointments.map((appt, i) => {
              const date = new Date(appt.start_time);
              return (
                <motion.div
                  key={appt.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -4 }}
                  className="stripe-card p-6 bg-white border-stripe-border hover:border-stripe-purple/20 hover:shadow-ambient transition-all flex flex-col md:flex-row gap-6 md:items-center group rounded-[32px]"
                >
                  <div className="w-20 h-20 bg-stripe-purple/5 rounded-3xl flex flex-col items-center justify-center text-stripe-purple shrink-0 group-hover:bg-stripe-purple group-hover:text-white transition-all duration-500">
                     <span className="text-[12px] uppercase font-bold tracking-tighter opacity-70">
                       {date.toLocaleString('default', { month: 'short' })}
                     </span>
                     <span className="text-2xl font-bold leading-none">{date.getDate()}</span>
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                       <StatusBadge status={appt.status} />
                       <span className="text-stripe-slate text-[11px] font-bold uppercase tracking-widest opacity-40">Token: {appt.token_number}</span>
                    </div>
                    <h3 className="text-2xl font-light text-stripe-navy group-hover:text-stripe-purple transition-colors">{appt.queue_key}</h3>
                    <div className="flex items-center gap-6 text-sm text-stripe-slate">
                       <span className="flex items-center gap-2 font-medium"><Clock className="w-4 h-4 text-stripe-purple/50" /> {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                       <span className="flex items-center gap-2 font-medium"><MapPin className="w-4 h-4 text-stripe-purple/50" /> 2.4 KM Away</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                     <button className="px-5 py-2.5 border border-stripe-border rounded-xl text-[13px] font-bold text-stripe-navy hover:bg-[#f6f9fc] transition-colors">
                       Reschedule
                     </button>
                     <button className="w-12 h-12 flex items-center justify-center rounded-2xl hover:bg-[#f6f9fc] transition-all">
                       <MoreVertical className="w-5 h-5 text-stripe-slate" />
                     </button>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="stripe-card p-24 bg-white flex flex-col items-center justify-center text-center space-y-6 border-dashed border-2 border-stripe-border rounded-[40px] shadow-sm">
               <div className="w-24 h-24 bg-stripe-purple/[0.03] rounded-full flex items-center justify-center">
                  <CalendarDays className="w-12 h-12 text-stripe-purple/20" />
               </div>
               <div className="space-y-2">
                 <h3 className="text-2xl font-light text-stripe-navy tracking-tight">Your calendar is clear</h3>
                 <p className="text-stripe-slate max-w-[320px] mx-auto leading-relaxed font-light">Schedule a remote appointment at one of our partnered institutions to minimize your wait time.</p>
               </div>
               <button onClick={() => setIsModalOpen(true)} className="stripe-btn-primary px-12 py-4 font-bold shadow-xl shadow-stripe-purple/20">
                 Book Now
               </button>
            </div>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
           <div className="stripe-card p-10 bg-white border-stripe-border shadow-ambient overflow-hidden relative group rounded-[40px] text-left">
              <div className="absolute top-0 right-0 w-32 h-32 bg-stripe-purple/[0.03] blur-3xl -z-0"></div>
              
              <h3 className="text-[11px] font-bold text-stripe-navy tracking-widest uppercase mb-8 opacity-50 flex items-center gap-2 relative z-10">
                <Bell className="w-4 h-4 text-stripe-purple" /> Smart Commute
              </h3>
              
              <p className="text-[15px] text-stripe-slate mb-10 relative z-10 leading-relaxed font-light">
                Based on your real-time GPS and current traffic data, we'll alert you exactly when it's time to head out.
              </p>
              
              <div className="space-y-4 relative z-10">
                 <div className="p-6 bg-[#f6f9fc] rounded-[24px] border border-stripe-border/50 flex items-center justify-between group-hover:bg-white group-hover:border-stripe-purple/20 transition-all duration-500">
                    <span className="text-sm text-stripe-slate font-medium">Avg. Commute</span>
                    <span className="text-stripe-purple font-bold text-[16px]">~18 mins</span>
                 </div>
                 <div className="p-6 bg-[#f6f9fc] rounded-[24px] border border-stripe-border/50 flex items-center justify-between group-hover:bg-white group-hover:border-stripe-purple/20 transition-all duration-500">
                    <span className="text-sm text-stripe-slate font-medium">Traffic Status</span>
                    <span className="text-green-600 font-bold uppercase text-[10px] tracking-widest bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">Optimal</span>
                 </div>
              </div>
              
              <button className="w-full mt-10 py-5 bg-stripe-purple text-white rounded-[20px] font-bold text-sm hover:bg-stripe-purpleHover hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-stripe-purple/20 flex items-center justify-center gap-3">
                 <Navigation className="w-4 h-4" /> Enable Live Alerts
              </button>
           </div>
        </div>
      </div>

      {/* Book Appointment Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-stripe-navy/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[32px] p-10 w-full max-w-md relative z-10 shadow-2xl border border-stripe-border"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="w-14 h-14 bg-stripe-purple/10 rounded-[20px] flex items-center justify-center text-stripe-purple">
                   <Calendar className="w-7 h-7" />
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-stripe-slate hover:text-stripe-navy p-3 hover:bg-[#f6f9fc] rounded-full transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-8">
                <h3 className="text-[26px] font-bold text-stripe-navy tracking-tight">Schedule New</h3>
                <p className="text-stripe-slate mt-1 font-light">Plan your next visit with precision.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-7">
                <div className="space-y-3">
                   <label className="text-[11px] font-bold text-stripe-slate uppercase tracking-wider pl-1 font-display">Queue Identifier</label>
                   <div className="relative group">
                      <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-stripe-slate group-focus-within:text-stripe-purple transition-colors" />
                      <input 
                        type="text" 
                        required
                        value={formData.queue_key}
                        onChange={(e) => setFormData({...formData, queue_key: e.target.value.toUpperCase()})}
                        placeholder="e.g. SBI-MAIN-01" 
                        className="w-full pl-14 pr-4 py-4.5 bg-[#f6f9fc] border border-transparent rounded-2xl text-[16px] font-bold focus:bg-white focus:border-stripe-purple/20 focus:ring-4 focus:ring-stripe-purple/5 transition-all outline-none tracking-wide"
                      />
                   </div>
                </div>

                <div className="space-y-3">
                   <label className="text-[11px] font-bold text-stripe-slate uppercase tracking-wider pl-1 font-display">Time Allocation</label>
                   <div className="relative group">
                      <Clock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-stripe-slate group-focus-within:text-stripe-purple transition-colors" />
                      <input 
                        type="datetime-local" 
                        required
                        value={formData.time}
                        onChange={(e) => setFormData({...formData, time: e.target.value})}
                        className="w-full pl-14 pr-5 py-4.5 bg-[#f6f9fc] border border-transparent rounded-2xl text-[16px] font-bold focus:bg-white focus:border-stripe-purple/20 transition-all outline-none"
                      />
                   </div>
                </div>

                <div className="pt-4">
                   <button 
                     type="submit" 
                     disabled={isSubmitting}
                     className="stripe-btn-primary py-5 w-full text-[16px] font-bold shadow-xl shadow-stripe-purple/20 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all"
                   >
                     {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /> Confirm Schedule</>}
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

function StatusBadge({ status }: { status: string }) {
  if (status === "scheduled") {
    return (
      <span className="px-3 py-1 bg-green-50 text-green-700 text-[10px] font-bold uppercase rounded-lg border border-green-100 flex items-center gap-1.5 shadow-sm">
        <CheckCircle2 className="w-3.5 h-3.5" /> {status}
      </span>
    );
  }
  return (
    <span className="px-3 py-1 bg-[#f6f9fc] text-stripe-slate text-[10px] font-bold uppercase rounded-lg border border-stripe-border flex items-center gap-1.5">
      {status}
    </span>
  );
}
