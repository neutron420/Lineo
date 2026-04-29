"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Plus, 
  CalendarDays,
  MoreVertical,
  Bell,
  Navigation,
  Loader2,
  X,
  CheckCircle2,
  HeartPulse,
  Landmark,
  Info,
  Search,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { useLocation } from "@/context/LocationContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AISmartSlotRecommendations } from "@/components/AISmartSlotRecommendations";

interface Appointment {
  id: string;
  start_time: string;
  status: string;
  token_number: string;
  queue_key: string;
}

interface Organization {
  id: number;
  name: string;
  key?: string;
  distance?: number;
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ queue_key: "", time: "", urgency: "routine", organization_id: 0 });
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [modalCategory, setModalCategory] = useState("all");

  const { coords } = useLocation();
  const [nearbyOrgs, setNearbyOrgs] = useState<Organization[]>([]);
  const [isLiveAlertsEnabled, setIsLiveAlertsEnabled] = useState(false);

  const fetchAppointments = useCallback(async () => {
    setIsLoading(true);
    try {
      const resp = await api.get("/appointments");
      const activeAppts = (resp.data.data || []).filter((a: Appointment) => a.status.toLowerCase() !== 'cancelled');
      setAppointments(activeAppts);
    } catch (err) {
      console.error("Failed to fetch appointments", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchNearby = useCallback(async () => {
    try {
      const resp = await api.get(`/search/nearby?lat=${coords.lat}&lng=${coords.lng}&radius=40000`);
      setNearbyOrgs(resp.data.data || []);
    } catch (err) {
      console.error("Discovery error:", err);
    }
  }, [coords.lat, coords.lng]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);
  useEffect(() => { fetchNearby(); }, [fetchNearby]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const dateObj = new Date(formData.time);
    const formattedDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

    // Optimistic Logic
    const tempId = Math.random().toString();
    const optimisticAppt: Appointment = {
      id: selectedAppt?.id || tempId,
      start_time: formattedDate,
      status: "Confirmed",
      token_number: selectedAppt?.token_number || "...",
      queue_key: formData.queue_key
    };

    if (selectedAppt) {
      setAppointments(prev => prev.map(a => a.id === selectedAppt.id ? optimisticAppt : a));
    } else {
      setAppointments(prev => [optimisticAppt, ...prev]);
    }

    setIsModalOpen(false);

    try {
      if (selectedAppt) {
        await api.post(`/appointments/${selectedAppt.id}/reschedule`, {
          start_time: formattedDate
        });
        toast.success("Schedule Updated", { description: "Time vector synchronized." });
      } else {
        const resp = await api.post("/appointments/book", {
          organization_id: formData.organization_id,
          queue_key: formData.queue_key,
          start_time: formattedDate,
          urgency: formData.urgency,
          user_lat: coords.lat,
          user_lon: coords.lng
        });
        // Replace optimistic with real data to get real Token number
        setAppointments(prev => prev.map(a => a.id === tempId ? resp.data.data : a));
        toast.success("Spot Reserved", { description: "Your token is ready." });
      }
      window.dispatchEvent(new Event("userSync"));
      setSelectedAppt(null);
      setFormData({ queue_key: "", time: "", urgency: "routine", organization_id: 0 });
    } catch {
      toast.error("Process Failed", { description: "Unable to secure slot. Please try another time." });
      fetchAppointments(); // Rollback
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckIn = async (id: string) => {
    // Optimistic UI
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: "Checked-in" } : a));
    
    try {
      await api.post(`/appointments/${id}/checkin`);
      toast.success("Check-in Pulse Successful", { description: "You are now live in the queue!" });
    } catch (err: any) {
      toast.error("Check-in Blocked", { description: err.response?.data?.message || "Are you near the location?" });
      fetchAppointments(); // Rollback
    }
  };

  const handleCancel = async (id: string) => {
    toast("Protocol Termination", {
      description: "Release this appointment vector?",
      action: {
        label: "Terminate",
        onClick: async () => {
          const original = appointments.find(a => a.id === id);
          setAppointments(prev => prev.filter(a => a.id !== id));
          
          try {
            await api.post(`/appointments/${id}/cancel`);
            toast.success("Schedule Purged", { description: "Appointment cancelled." });
            window.dispatchEvent(new Event("userSync"));
          } catch (err) {
            if (original) setAppointments(prev => [original, ...prev]); // Rollback
            toast.error("Failure", { description: "Could not cancel appointment." });
          }
        }
      }
    });
  };

  const openScheduleModal = (appt?: Appointment) => {
    if (appt) {
      setSelectedAppt(appt);
      setFormData({ 
        queue_key: appt.queue_key, 
        time: appt.start_time.replace(" ", "T").substring(0, 16),
        urgency: "routine",
        organization_id: 0
      });
    } else {
      setSelectedAppt(null);
      setFormData({ queue_key: "", time: "", urgency: "routine", organization_id: 0 });
    }
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>My Appointments</h1>
          <p className="text-[#49607e] text-sm font-medium mt-1">Manage your upcoming sessions and commute alerts.</p>
        </div>
        <Button onClick={() => openScheduleModal()} className="kinetic-btn-primary h-11 px-6 gap-2 text-sm">
          <Plus className="w-4 h-4" /> Schedule New
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main List */}
        <div className="xl:col-span-2 space-y-4">
          {isLoading ? (
            <div className="flex flex-col gap-4">
              {[1,2,3].map(i => <div key={i} className="h-32 bg-[#f1f4f7] rounded-2xl animate-pulse" />)}
            </div>
          ) : appointments.length > 0 ? (
            appointments.map((appt, i) => {
              const date = new Date(appt.start_time);
              return (
                <motion.div
                  key={appt.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ y: -3 }}
                  className="bg-white rounded-[32px] p-6 border border-[#e5e8eb] hover:border-[#493ee5]/30 hover:shadow-[0_32px_64px_-16px_rgba(73,62,229,0.08)] transition-all flex flex-col md:flex-row gap-6 md:items-center group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-64 h-64 bg-[#493ee5] opacity-0 group-hover:opacity-[0.03] rounded-full blur-[80px] -mr-32 -mt-32 transition-opacity duration-500" />
                  
                  {/* Date Badge */}
                  <div className="w-20 h-20 bg-[#493ee5]/5 rounded-[22px] flex flex-col items-center justify-center text-[#493ee5] shrink-0 group-hover:bg-[#493ee5] group-hover:text-white group-hover:rotate-6 transition-all duration-500 shadow-sm border border-[#493ee5]/10">
                     <span className="text-[10px] uppercase font-black tracking-[0.2em] opacity-60">
                       {date.toLocaleString('default', { month: 'short' })}
                     </span>
                     <span className="text-3xl font-black leading-none mt-1" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{date.getDate()}</span>
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                       <StatusBadge status={appt.status} />
                       
                       {/* Intensity Labels */}
                       {i === 0 ? (
                         <span className="px-2.5 py-0.5 bg-rose-50 text-rose-600 text-[9px] font-black uppercase tracking-widest rounded-md border border-rose-100 flex items-center gap-1.5 shadow-sm">
                            <span className="w-1 h-1 bg-rose-500 rounded-full animate-ping" />
                            Urgent
                         </span>
                       ) : i === 1 ? (
                         <span className="px-2.5 py-0.5 bg-[#493ee5]/5 text-[#493ee5] text-[9px] font-black uppercase tracking-widest rounded-md border border-[#493ee5]/10 flex items-center gap-1.5">
                            Routine
                         </span>
                       ) : (
                         <span className="px-2.5 py-0.5 bg-amber-50 text-amber-600 text-[9px] font-black uppercase tracking-widest rounded-md border border-amber-100 flex items-center gap-1.5">
                            Follow-up
                         </span>
                       )}

                       <div className="h-4 w-px bg-slate-100" />
                       <span className="text-[#49607e] text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Vector ID: {appt.token_number}</span>
                    </div>
                    <h3 className="text-2xl font-black text-[#181c1e] tracking-tight group-hover:text-[#493ee5] transition-colors" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{appt.queue_key}</h3>
                    <div className="flex items-center gap-6 text-xs text-[#49607e] font-bold opacity-60">
                       <span className="flex items-center gap-2 uppercase tracking-wide"><Clock className="w-4 h-4 text-[#493ee5]" /> {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                       <span className="flex items-center gap-2 uppercase tracking-wide"><MapPin className="w-4 h-4 text-[#493ee5]" /> 2.4 KM Distance</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 z-10">
                     {appt.status.toLowerCase() === "scheduled" && (
                       <button 
                        onClick={() => handleCheckIn(appt.id)}
                        className="px-6 py-3 bg-[#493ee5] text-white rounded-2xl text-xs font-black hover:bg-[#3428c5] transition-all shadow-md active:scale-95" 
                        style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
                       >
                         Check-in
                       </button>
                     )}
                     <button 
                      onClick={() => openScheduleModal(appt)}
                      className="px-6 py-3 bg-white border border-[#e5e8eb] rounded-2xl text-xs font-black text-[#181c1e] hover:bg-slate-50 transition-all shadow-sm active:scale-95" 
                      style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
                     >
                       Reschedule
                     </button>
                     <button 
                        onClick={() => handleCancel(appt.id)}
                        className="w-12 h-12 flex items-center justify-center rounded-2xl bg-rose-50 border border-transparent hover:border-rose-200 hover:bg-rose-100 transition-all group/btn"
                        title="Cancel Appointment"
                      >
                       <X className="w-5 h-5 text-rose-500" />
                     </button>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="bg-white rounded-[40px] p-24 flex flex-col items-center justify-center text-center space-y-8 border border-[#e5e8eb] relative overflow-hidden backdrop-blur-xl shadow-sm">
               <div className="absolute inset-0 bg-grid-slate-100/50 [mask-image:radial-gradient(ellipse_at_center,white,transparent)]" />
               <div className="w-24 h-24 bg-[#493ee5]/5 rounded-[32px] flex items-center justify-center relative group">
                  <div className="absolute inset-0 bg-[#493ee5] opacity-20 rounded-[32px] blur-2xl group-hover:opacity-40 transition-opacity" />
                  <CalendarDays className="w-12 h-12 text-[#493ee5] relative" />
               </div>
               <div className="space-y-2 relative">
                 <h3 className="text-3xl font-black text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Calendar Inertia</h3>
                 <p className="text-[#49607e] max-w-[340px] mx-auto text-sm font-medium leading-relaxed">Your professional schedule is currently static. Initialize a bridge to your favorite institutions.</p>
               </div>
               <Button onClick={() => openScheduleModal()} className="kinetic-btn-primary h-14 px-12 text-md shadow-2xl relative">
                 Schedule First Vector
               </Button>
            </div>
          )}
        </div>

        {/* Sidebar: Smart Commute */}
        <div className="space-y-6">
           <div className="bg-white rounded-2xl p-6 ghost-border space-y-6">
              <h3 className="text-xs font-extrabold text-[#49607e] tracking-[0.25em] uppercase flex items-center gap-2" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                <Bell className="w-4 h-4 text-[#493ee5]" /> Smart Commute
              </h3>
              
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#49607e] leading-relaxed max-w-[200px]">
                  We&apos;ll alert you exactly when it&apos;s time to head out based on real-time GPS and traffic.
                </p>
                <div className="flex items-center gap-2">
                  <motion.div 
                    whileHover={{ rotate: 180 }}
                    className="w-8 h-8 bg-[#f1f4f7] rounded-lg flex items-center justify-center text-[#49607e] cursor-help shrink-0"
                    title="How it works: We calculate the distance between your location and the institution, cross-reference it with Google Traffic data, and notify you as soon as the optimal departure window opens."
                  >
                    <Info className="w-4 h-4" />
                  </motion.div>
                  <div className="w-12 h-12 bg-[#493ee5]/5 rounded-xl flex items-center justify-center text-[#493ee5] animate-pulse shrink-0">
                    <Navigation className="w-5 h-5" />
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                 <div className="p-4 bg-[#f1f4f7] rounded-xl flex items-center justify-between group hover:bg-[#e2dfff]/30 transition-all cursor-default">
                    <span className="text-sm text-[#49607e] font-medium group-hover:text-[#493ee5]">Avg. Commute</span>
                    <span className="text-[#493ee5] font-bold text-sm" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                      {isLiveAlertsEnabled || appointments.length > 0 ? "~14 mins" : "-- mins"}
                    </span>
                 </div>
                 <div className="p-4 bg-[#f1f4f7] rounded-xl flex items-center justify-between group hover:bg-green-50 transition-all cursor-default">
                    <span className="text-sm text-[#49607e] font-medium group-hover:text-green-600">Traffic Status</span>
                    <span className={cn(
                      "font-bold uppercase text-[10px] tracking-widest px-2.5 py-1 rounded-lg transition-all",
                      isLiveAlertsEnabled || appointments.length > 0 ? "text-green-600 bg-green-50" : "text-[#49607e] bg-[#e5e8eb]"
                    )}>
                      {isLiveAlertsEnabled || appointments.length > 0 ? "OPTIMAL" : "STANDBY"}
                    </span>
                 </div>
              </div>
              
              <Button 
                onClick={() => {
                  setIsLiveAlertsEnabled(!isLiveAlertsEnabled);
                  if(!isLiveAlertsEnabled) {
                    toast.success("Commute Alerts Active", { description: "Monitoring real-time traffic for your next session." });
                  }
                }}
                className={cn(
                  "w-full h-11 text-sm gap-2 transition-all",
                  isLiveAlertsEnabled ? "bg-green-600 hover:bg-green-700 text-white shadow-lg" : "kinetic-btn-primary"
                )}
              >
                 {isLiveAlertsEnabled ? <CheckCircle2 className="w-4 h-4" /> : <Navigation className="w-4 h-4" />}
                 {isLiveAlertsEnabled ? "Live Alerts Active" : "Enable Live Alerts"}
              </Button>
           </div>
        </div>
      </div>

      {/* Book Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-[32px] md:rounded-3xl border-none shadow-ambient max-h-[95vh] flex flex-col">
          <div className="p-6 text-white relative overflow-hidden shrink-0" style={{ background: 'linear-gradient(135deg, #493ee5, #635bff)' }}>
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
            <div className="flex items-center justify-between relative z-10 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-xl border border-white/20">
                <Calendar className="w-6 h-6" />
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md border border-white/10 transition-all"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <DialogTitle className="text-2xl font-extrabold tracking-tight relative z-10" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
              {selectedAppt ? "Reschedule Appointment" : "Schedule New"}
            </DialogTitle>
            <DialogDescription className="text-white/70 text-sm mt-1 relative z-10">
              {selectedAppt ? `Current Institution: ${selectedAppt.queue_key}` : "Plan your next visit with precision."}
            </DialogDescription>
          </div>

          <div className="p-6 space-y-5 bg-white overflow-y-auto">
              {!selectedAppt && (
                <div>
                  <Label className="text-xs font-bold text-[#49607e] uppercase tracking-[0.15em] mb-3 block" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Select Institution</Label>
                  
                  {/* Modal Search/Filter */}
                  <div className="space-y-4 mb-5">
                    <div className="relative group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#49607e] group-focus-within:text-[#493ee5] transition-colors" />
                      <input
                        type="text"
                        placeholder="Search partner institutions..."
                        className="w-full pl-11 pr-4 py-3 bg-[#f1f4f7] rounded-xl outline-none transition-all text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#493ee5]/10"
                        onChange={(e) => setModalSearchQuery(e.target.value)}
                        value={modalSearchQuery}
                      />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                      {['all', 'hospital', 'bank'].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setModalCategory(cat)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                            modalCategory === cat 
                              ? "bg-[#493ee5] text-white shadow-neobrutal" 
                              : "bg-[#f1f4f7] text-[#49607e] hover:text-[#493ee5] hover:bg-[#493ee5]/5"
                          )}
                          style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <ScrollArea className="h-[200px] pr-2 -mr-1">
                    <div className="space-y-2.5">
                      <AnimatePresence mode="popLayout">
                        {nearbyOrgs.filter(org => {
                          const matchesSearch = org.name.toLowerCase().includes(modalSearchQuery.toLowerCase());
                          const matchesCat = modalCategory === 'all' || org.name.toLowerCase().includes(modalCategory === 'hospital' ? 'hospital' : modalCategory === 'bank' ? 'bank' : '');
                          return matchesSearch && matchesCat;
                        }).length > 0 ? (
                          nearbyOrgs
                            .filter(org => {
                              const matchesSearch = org.name.toLowerCase().includes(modalSearchQuery.toLowerCase());
                              const matchesCat = modalCategory === 'all' || org.name.toLowerCase().includes(modalCategory === 'hospital' ? 'hospital' : modalCategory === 'bank' ? 'bank' : '');
                              return matchesSearch && matchesCat;
                            })
                            .map((org, i) => (
                              <motion.div
                                key={org.key || i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                              >
                                <div
                                  onClick={() => { if (org.key) setFormData({...formData, queue_key: org.key, organization_id: org.id}); }}
                                  className={cn(
                                    "p-4 rounded-xl transition-all flex items-center justify-between border border-transparent",
                                    formData.queue_key === org.key && org.key
                                      ? "bg-[#493ee5]/5 ring-2 ring-[#493ee5]" 
                                      : org.key 
                                        ? "bg-[#f1f4f7] hover:bg-white hover:shadow-ambient cursor-pointer"
                                        : "opacity-60 saturate-50 cursor-not-allowed bg-[#f1f4f7] border border-[#e5e8eb]"
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={cn(
                                      "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                                      org.key ? (formData.queue_key === org.key ? "bg-[#493ee5] text-white" : "bg-white text-[#493ee5] shadow-sm") : "bg-[#ebeef1] text-[#49607e]"
                                    )}>
                                      {org.name.toLowerCase().includes("hospital") ? <HeartPulse className="w-5 h-5" /> : <Landmark className="w-5 h-5" />}
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-[#181c1e] text-sm" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{org.name}</h4>
                                      <p className="text-[10px] text-[#49607e] font-medium">
                                        {org.key 
                                          ? (org.distance ? `${(org.distance/1000).toFixed(1)} km away` : 'Partner Active')
                                          : 'Not Partnered'}
                                      </p>
                                    </div>
                                  </div>
                                  {formData.queue_key === org.key && org.key && <CheckCircle2 className="w-4 h-4 text-[#493ee5]" />}
                                </div>
                              </motion.div>
                            ))
                        ) : (
                          <div className="py-8 text-center text-[#49607e] text-xs font-bold animate-pulse">Scanning Institutions...</div>
                        )}
                      </AnimatePresence>
                    </div>
                  </ScrollArea>
                </div>
              )}

              {formData.queue_key && (
                <div className="pt-2">
                  <AISmartSlotRecommendations 
                    orgId={formData.queue_key} 
                    selectedDateTime={formData.time}
                    onSelect={(datetime) => {
                      // datetime format from API: 2025-08-05T10:00:00Z
                      // input type="datetime-local" needs: YYYY-MM-DDTHH:MM
                      const val = datetime.substring(0, 16);
                      setFormData({ ...formData, time: val });
                      toast.info("AI Optimized Slot Selected", { 
                        description: "Wait time minimizes in this window.",
                        icon: <Sparkles className="w-4 h-4 text-[#493ee5]" />
                      });
                    }}
                  />
                </div>
              )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label className="text-xs font-bold text-[#49607e] uppercase tracking-[0.15em] mb-2 block" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Priority Level</Label>
                <div className="grid grid-cols-3 gap-2">
                   {['urgent', 'routine', 'follow-up'].map((level) => (
                     <button
                       key={level}
                       type="button"
                       onClick={() => setFormData({...formData, urgency: level})}
                       className={cn(
                         "py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                         formData.urgency === level 
                            ? (level === 'urgent' ? "bg-rose-50 border-rose-200 text-rose-600 shadow-sm" : 
                               level === 'routine' ? "bg-[#493ee5]/5 border-[#493ee5]/20 text-[#493ee5] shadow-sm" : 
                               "bg-amber-50 border-amber-200 text-amber-600 shadow-sm")
                            : "bg-[#f1f4f7] border-transparent text-[#49607e] hover:bg-white hover:border-[#e5e8eb]"
                       )}
                     >
                       {level}
                     </button>
                   ))}
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-[#49607e] uppercase tracking-[0.15em] mb-2 block" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Time & Date</Label>
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#49607e]" />
                  <input 
                    type="datetime-local" 
                    required
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    className="w-full pl-11 pr-4 py-3.5 bg-[#f1f4f7] rounded-xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-[#493ee5]/20 transition-all outline-none"
                  />
                </div>
              </div>

              <Button type="submit" disabled={isSubmitting} className="kinetic-btn-primary w-full h-12 text-sm gap-2">
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {selectedAppt ? <Calendar className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {selectedAppt ? "Update Schedule" : "Confirm Schedule"}
                  </>
                )}
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "scheduled" || s === "confirmed") {
    return (
      <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase rounded-lg flex items-center gap-1.5 border border-emerald-100 shadow-sm">
        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
        {s}
      </span>
    );
  }
  if (s === "pending") {
    return (
      <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-black uppercase rounded-lg flex items-center gap-1.5 border border-amber-100 shadow-sm">
        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
        {s}
      </span>
    );
  }
  if (s === "completed") {
    return (
      <span className="px-3 py-1 bg-[#493ee5]/5 text-[#493ee5] text-[10px] font-black uppercase rounded-lg flex items-center gap-1.5 border border-[#493ee5]/10 shadow-sm">
        <CheckCircle2 className="w-3 h-3" />
        {s}
      </span>
    );
  }
  if (s === "cancelled") {
    return (
      <span className="px-3 py-1 bg-rose-50 text-rose-600 text-[10px] font-black uppercase rounded-lg flex items-center gap-1.5 border border-rose-100 shadow-sm">
        <X className="w-3 h-3" />
        {s}
      </span>
    );
  }
  return (
    <span className="px-3 py-1 bg-slate-50 text-slate-500 text-[10px] font-black uppercase rounded-lg border border-slate-100">
      {s}
    </span>
  );
}
