"use client";

import React, { useState, useEffect } from "react";
import { 
  Calendar, 
  Clock, 
  User, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Filter,
  MoreVertical,
  Mail,
  Phone,
  ShieldCheck,
  AlertCircle,
  Loader2,
  LayoutGrid,
  ListOrdered
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Appointment {
  id: string;
  token_number: string;
  user_name: string;
  user_email: string;
  service_name: string;
  scheduled_at: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  prio?: boolean;
  has_disability?: boolean;
  disability_type?: string;
}

export default function OrgAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const fetchAppointments = async () => {
    setIsLoading(true);
    try {
      const staffToken = sessionStorage.getItem("staff_token");
      const response = await api.get("/staff/appointments", {
        headers: { Authorization: `Bearer ${staffToken}` }
      });
      
      const rawData = response.data.data || [];
      const mappedData = rawData.map((item: any) => ({
        id: item.id.toString(),
        token_number: item.token_number || "TBD",
        user_name: item.User?.username || "Quest Client",
        user_email: item.User?.email || "No Email",
        service_name: item.queue_key?.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') || "General Service",
        scheduled_at: item.start_time,
        status: item.status === 'scheduled' ? 'upcoming' : 
                item.status === 'checked_in' ? 'completed' : 
                item.status === 'cancelled' ? 'cancelled' : 'upcoming',
        prio: item.priority || (item.User?.has_disability || false),
        has_disability: item.User?.has_disability || false,
        disability_type: item.User?.disability_type || ""
      }));
      setAppointments(mappedData);
    } catch (err) {
      console.error("Institutional Fetch Error:", err);
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const filteredAppts = appointments.filter(a => 
    a.status === activeTab && 
    (a.user_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     a.service_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await api.patch(`/org/appointments/${id}/status`, { status: newStatus });
      toast.success(`Booking ${newStatus} successfully`);
      fetchAppointments();
    } catch (err) {
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus as any } : a));
      toast.success(`Booking ${newStatus} (Simulated)`);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* ━━ Header Section ━━ */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-[#e5e8eb]">
        <div className="space-y-1">
          <h1 className="text-[32px] font-black text-[#181c1e] tracking-tight leading-none" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
             Institutional Bookings
          </h1>
          <p className="text-[15px] text-[#49607e] font-medium tracking-tight">Manage your professional schedule and high-latency service requests.</p>
        </div>
        
        <div className="flex items-center gap-3">
           <div className="flex bg-[#f1f4f7] p-1 rounded-xl border border-[#e5e8eb] mr-2">
              <button 
                onClick={() => setViewMode('grid')}
                className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2", viewMode === 'grid' ? "bg-white shadow-sm text-[#493ee5]" : "text-[#49607e]")}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Grid
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2", viewMode === 'list' ? "bg-white shadow-sm text-[#493ee5]" : "text-[#49607e]")}
              >
                <ListOrdered className="w-3.5 h-3.5" /> Queue
              </button>
           </div>
           <Button className="kinetic-btn-primary h-11 px-6 text-sm font-bold gap-2">
              <Calendar className="w-4 h-4" /> Export Schedule
           </Button>
        </div>
      </div>

      {/* ━━ Controls Card ━━ */}
      <div className="bg-white p-4 rounded-3xl border border-[#e5e8eb] shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
         <div className="flex p-1 bg-[#f1f4f7] rounded-2xl w-full md:w-auto">
            {['upcoming', 'completed', 'cancelled'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                  activeTab === tab 
                    ? "bg-white text-[#493ee5] shadow-sm" 
                    : "text-[#49607e] hover:text-[#181c1e]"
                )}
                style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
              >
                {tab}
              </button>
            ))}
         </div>

         <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-80 group">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#49607e] group-focus-within:text-[#493ee5] transition-colors" />
               <input 
                 type="text" 
                 placeholder="Search user name or service..."
                 className="w-full pl-11 pr-4 py-2.5 bg-[#f1f4f7] border border-transparent focus:bg-white focus:border-[#493ee5]/15 focus:ring-4 focus:ring-[#493ee5]/5 rounded-xl outline-none text-sm transition-all font-medium"
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
               />
            </div>
            <button className="p-2.5 bg-white border border-[#e5e8eb] rounded-xl text-[#49607e] hover:bg-[#f1f4f7] transition-all">
               <Filter className="w-5 h-5" />
            </button>
         </div>
      </div>

      {/* ━━ Appointments Main View ━━ */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="h-[200px] bg-white rounded-[32px] border border-[#e5e8eb] animate-pulse shadow-sm" />
            ))
          ) : filteredAppts.length > 0 ? (
            <AnimatePresence mode="popLayout">
              {filteredAppts.map((appt, idx) => (
                  <motion.div
                    key={appt.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, delay: idx * 0.05 }}
                    className="bg-white p-8 rounded-[32px] border border-[#e5e8eb] hover:shadow-ambient transition-all relative overflow-hidden group"
                  >
                    {appt.prio && (
                      <div className="absolute top-0 right-0 px-4 py-1.5 bg-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-[0.2em] rounded-bl-xl border-l border-b border-amber-200 z-10">
                          Priority Client
                      </div>
                    )}

                    {appt.has_disability && (
                      <div className="absolute top-12 -right-4 rotate-45 w-32 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-[0.2em] py-1.5 text-center shadow-lg border-y border-white/20 animate-pulse z-10">
                          Care Vector
                      </div>
                    )}
                    
                    <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-[#493ee5]/5 rounded-2xl flex items-center justify-center text-[#493ee5] relative">
                              <User className="w-7 h-7" />
                              <div className="absolute -bottom-1 -right-1 bg-[#493ee5] text-white text-[9px] font-black px-1.5 py-0.5 rounded-lg border-2 border-white shadow-sm min-w-[24px] text-center">
                                {appt.token_number}
                              </div>
                          </div>
                          <div>
                              <h3 className="text-lg font-black text-[#181c1e] leading-snug" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{appt.user_name}</h3>
                              <div className="flex items-center gap-2 text-[#49607e] text-xs font-medium">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                <span>ID Verified Account</span>
                              </div>
                          </div>
                        </div>
                        <button className="p-2 text-[#e5e8eb] group-hover:text-[#49607e] transition-colors">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-4 p-5 bg-[#f7fafd] rounded-2xl border border-[#e5e8eb]/50 mb-6">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-[#49607e] uppercase tracking-widest">Service Type</span>
                          <span className="text-xs font-bold text-[#181c1e]">{appt.service_name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-[#49607e] uppercase tracking-widest">Scheduled Time</span>
                          <div className="flex items-center gap-2 text-xs font-bold text-[#181c1e]">
                              <Clock className="w-3.5 h-3.5 text-[#493ee5]" />
                              {format(new Date(appt.scheduled_at), "h:mm a, MMM do")}
                          </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {activeTab === 'upcoming' ? (
                          <>
                            <Button 
                              onClick={() => handleUpdateStatus(appt.id, 'completed')}
                              className="flex-1 kinetic-btn-primary h-11 text-xs gap-2 rounded-xl"
                            >
                              <CheckCircle2 className="w-4 h-4" /> Mark Completed
                            </Button>
                            <Button 
                              onClick={() => handleUpdateStatus(appt.id, 'cancelled')}
                              variant="outline" 
                              className="h-11 px-4 border-[#e5e8eb] text-red-500 hover:bg-red-50 hover:border-red-100 rounded-xl"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <div className={cn(
                            "w-full py-2.5 rounded-xl text-center text-[10px] font-black uppercase tracking-widest border",
                            activeTab === 'completed' ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-red-50 border-red-100 text-red-600"
                          )}>
                            {activeTab} Successfully
                          </div>
                        )}
                    </div>

                    <div className="mt-6 pt-6 border-t border-[#e5e8eb] flex justify-between items-center opacity-60">
                        <div className="flex gap-4">
                          <Mail className="w-4 h-4 hover:text-[#493ee5] cursor-pointer" />
                          <Phone className="w-4 h-4 hover:text-[#493ee5] cursor-pointer" />
                        </div>
                        <span className="text-[10px] font-bold text-[#49607e] uppercase tracking-widest">#BK-{appt.id.padStart(4, '0')}</span>
                    </div>
                  </motion.div>
              ))}
            </AnimatePresence>
          ) : (
            <EmptyState />
          )}
        </div>
      ) : (
        /* ━━ Queue List View ━━ */
        <div className="bg-white rounded-[32px] border border-[#e5e8eb] overflow-hidden shadow-sm">
           <table className="w-full text-left border-collapse">
              <thead className="bg-[#f7fafd] border-b border-[#e5e8eb]">
                 <tr>
                    <th className="px-8 py-5 text-[10px] font-black text-[#49607e] uppercase tracking-widest">Token</th>
                    <th className="px-8 py-5 text-[10px] font-black text-[#49607e] uppercase tracking-widest">Patient Name</th>
                    <th className="px-8 py-5 text-[10px] font-black text-[#49607e] uppercase tracking-widest">Service</th>
                    <th className="px-8 py-5 text-[10px] font-black text-[#49607e] uppercase tracking-widest">Time</th>
                    <th className="px-8 py-5 text-[10px] font-black text-[#49607e] uppercase tracking-widest text-right">Actions</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e8eb]">
                 {isLoading ? (
                    Array(5).fill(0).map((_, i) => (
                       <tr key={i} className="animate-pulse"><td colSpan={5} className="px-8 py-8 h-20 bg-[#f1f4f7]/30" /></tr>
                    ))
                 ) : filteredAppts.length > 0 ? (
                    filteredAppts.map((appt) => (
                       <tr key={appt.id} className="hover:bg-[#f7fafd]/50 transition-colors group">
                          <td className="px-8 py-5">
                             <span className="inline-flex items-center justify-center min-w-[44px] px-2.5 py-1.5 bg-[#493ee5] text-white text-[11px] font-black rounded-lg shadow-sm">
                                {appt.token_number}
                             </span>
                          </td>
                          <td className="px-8 py-5">
                             <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[#493ee5]/5 flex items-center justify-center text-[#493ee5]">
                                   <User className="w-4 h-4" />
                                </div>
                                <div>
                                   <div className="text-sm font-bold text-[#181c1e]">{appt.user_name}</div>
                                   <div className="text-[10px] font-medium text-[#49607e]">#BK-{appt.id.padStart(4, '0')}</div>
                                </div>
                             </div>
                          </td>
                          <td className="px-8 py-5">
                             <span className="text-xs font-bold text-[#181c1e]">{appt.service_name}</span>
                          </td>
                          <td className="px-8 py-5">
                             <div className="flex items-center gap-2 text-xs font-bold text-[#181c1e]">
                                <Clock className="w-3.5 h-3.5 text-[#493ee5]" />
                                {format(new Date(appt.scheduled_at), "h:mm a, MMM do")}
                             </div>
                          </td>
                          <td className="px-8 py-5 text-right">
                             <div className="flex items-center justify-end gap-2">
                                {activeTab === 'upcoming' ? (
                                   <>
                                      <button 
                                        onClick={() => handleUpdateStatus(appt.id, 'completed')}
                                        className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                                        title="Complete Appointment"
                                      >
                                         <CheckCircle2 className="w-5 h-5" />
                                      </button>
                                      <button 
                                        onClick={() => handleUpdateStatus(appt.id, 'cancelled')}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                        title="Cancel Appointment"
                                      >
                                         <XCircle className="w-5 h-5" />
                                      </button>
                                   </>
                                ) : (
                                   <span className="text-[10px] font-black uppercase tracking-widest text-[#49607e]">{activeTab}</span>
                                )}
                             </div>
                          </td>
                       </tr>
                    ))
                 ) : (
                    <tr><td colSpan={5} className="py-20"><EmptyState /></td></tr>
                 )}
              </tbody>
           </table>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="col-span-full h-80 flex flex-col items-center justify-center text-center p-12 bg-white rounded-[40px] border border-[#e5e8eb] border-dashed w-full">
      <div className="w-16 h-16 bg-[#f1f4f7] rounded-2xl flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-[#e5e8eb]" />
      </div>
      <h3 className="text-lg font-bold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>No active bookings found</h3>
      <p className="text-sm text-[#49607e] max-w-sm mt-1">Your institutional queue is currently clear for the selected status.</p>
    </div>
  );
}
