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
  Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { useLocation } from "@/context/LocationContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Appointment {
  id: string;
  start_time: string;
  status: string;
  token_number: string;
  queue_key: string;
}

interface Organization {
  name: string;
  key?: string;
  distance?: number;
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ queue_key: "", time: "" });
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [modalCategory, setModalCategory] = useState("all");

  const { coords } = useLocation();
  const [nearbyOrgs, setNearbyOrgs] = useState<Organization[]>([]);
  const [isLiveAlertsEnabled, setIsLiveAlertsEnabled] = useState(false);

  const fetchAppointments = useCallback(async () => {
    setIsLoading(true);
    try {
      const resp = await api.get("/appointments");
      setAppointments(resp.data.data || []);
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
    if (!formData.queue_key) {
      toast.error("Please select a partner institution before scheduling.");
      return;
    }
    setIsSubmitting(true);
    
    const dateObj = new Date(formData.time);
    const formattedDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

    try {
      await api.post("/appointments/book", {
        queue_key: formData.queue_key,
        start_time: formattedDate,
        user_lat: coords.lat,
        user_lon: coords.lng
      });
      setIsModalOpen(false);
      setFormData({ queue_key: "", time: "" });
      await fetchAppointments();
      toast.success("Appointment scheduled successfully!");
    } catch {
      toast.error("Booking failed. Please check the queue code and time slot.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>My Appointments</h1>
          <p className="text-[#49607e] text-sm font-medium mt-1">Manage your upcoming sessions and commute alerts.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="kinetic-btn-primary h-11 px-6 gap-2 text-sm">
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
                  className="bg-white rounded-2xl p-5 ghost-border hover:shadow-ambient transition-all flex flex-col md:flex-row gap-5 md:items-center group"
                >
                  {/* Date Badge */}
                  <div className="w-16 h-16 bg-[#493ee5]/5 rounded-xl flex flex-col items-center justify-center text-[#493ee5] shrink-0 group-hover:bg-[#493ee5] group-hover:text-white transition-all duration-300">
                     <span className="text-[10px] uppercase font-bold tracking-tight opacity-70">
                       {date.toLocaleString('default', { month: 'short' })}
                     </span>
                     <span className="text-xl font-extrabold leading-none" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{date.getDate()}</span>
                  </div>

                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                       <StatusBadge status={appt.status} />
                       <span className="text-[#49607e] text-[10px] font-bold uppercase tracking-widest opacity-40">Token: {appt.token_number}</span>
                    </div>
                    <h3 className="text-lg font-bold text-[#181c1e] group-hover:text-[#493ee5] transition-colors" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{appt.queue_key}</h3>
                    <div className="flex items-center gap-5 text-xs text-[#49607e]">
                       <span className="flex items-center gap-1.5 font-medium"><Clock className="w-3.5 h-3.5 text-[#493ee5]/50" /> {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                       <span className="flex items-center gap-1.5 font-medium"><MapPin className="w-3.5 h-3.5 text-[#493ee5]/50" /> 2.4 KM Away</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                     <button className="px-4 py-2 bg-[#f1f4f7] rounded-xl text-xs font-bold text-[#181c1e] hover:bg-[#e5e8eb] transition-colors" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                       Reschedule
                     </button>
                     <button className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#f1f4f7] transition-all">
                       <MoreVertical className="w-4 h-4 text-[#49607e]" />
                     </button>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="bg-white rounded-2xl p-16 flex flex-col items-center justify-center text-center space-y-5 ghost-border">
               <div className="w-20 h-20 bg-[#f1f4f7] rounded-2xl flex items-center justify-center">
                  <CalendarDays className="w-10 h-10 text-[#49607e]/30" />
               </div>
               <div className="space-y-1">
                 <h3 className="text-xl font-bold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Your calendar is clear</h3>
                 <p className="text-[#49607e] max-w-[300px] mx-auto text-sm">Schedule a remote appointment to minimize your wait.</p>
               </div>
               <Button onClick={() => setIsModalOpen(true)} className="kinetic-btn-primary h-12 px-10">
                 Book Now
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
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-3xl border-none shadow-ambient">
          <div className="p-6 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #493ee5, #635bff)' }}>
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4 backdrop-blur-xl border border-white/20">
              <Calendar className="w-6 h-6" />
            </div>
            <DialogTitle className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Schedule New</DialogTitle>
            <DialogDescription className="text-white/70 text-sm mt-1">Plan your next visit with precision.</DialogDescription>
          </div>

          <div className="p-6 space-y-5 bg-white">
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
                              onClick={() => { if (org.key) setFormData({...formData, queue_key: org.key}); }}
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

            <form onSubmit={handleSubmit} className="space-y-5">
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
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Confirm Schedule</>}
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "scheduled") {
    return (
      <span className="px-2.5 py-0.5 bg-green-50 text-green-700 text-[10px] font-bold uppercase rounded-lg flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3" /> {status}
      </span>
    );
  }
  return (
    <span className="px-2.5 py-0.5 bg-[#f1f4f7] text-[#49607e] text-[10px] font-bold uppercase rounded-lg">
      {status}
    </span>
  );
}
