"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, 
  Timer, 
  MapPin, 
  Plus, 
  QrCode, 
  ArrowUpRight,
  Map as MapIcon,
  Search,
  Loader2,
  Building2,
  X,
  History as HistoryIcon,
  Smile,
  ArrowRight,
  Calendar,
  Navigation,
  CheckCircle2,
  AlertCircle,  
  Zap,
  HeartPulse,
  Landmark,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import Link from "next/link";
import { toast } from "sonner";
import { useLocation } from "@/context/LocationContext";
import { useSocket } from "@/context/SocketContext";

interface TokenData {
  token_number: string;
  queue_key: string;
  organization_id: number;
  position: number;
  estimated_wait_mins: number;
  status: string;
}

interface Organization {
  name: string;
  key?: string;
  types?: string[];
  address?: string;
  rating?: number;
  distance?: number;
}

interface Appointment {
  start_time: string;
  queue_key: string;
  token_number: string;
}

interface SocketQueueData {
  event?: { token_number: string };
  state?: {
    waiting_list: { token_number: string }[];
    currently_serving: { token_number: string } | null;
  };
}

export default function UserDashboard() {
  const { coords, address: locationName, pincode } = useLocation();
  const { isConnected, subscribe, unsubscribe } = useSocket();
  const [activeToken, setActiveToken] = useState<TokenData | null>(null);
  const [nearbyOrgs, setNearbyOrgs] = useState<Organization[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [joinQueueKey, setJoinQueueKey] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [activeResp, apptResp] = await Promise.all([
        api.get("/queue/active").catch(() => ({ data: { data: null } })),
        api.get("/appointments").catch(() => ({ data: { data: [] } })),
      ]);

      if (activeResp.data.data) setActiveToken(activeResp.data.data);
      setAppointments(apptResp.data.data || []); 
    } catch (err) {
      console.error("Critical Dash Sync Error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchNearby = useCallback(async () => {
    try {
      const categoryParam = activeCategory !== "all" ? `&type=${activeCategory}` : "";
      const resp = await api.get(`/search/nearby?lat=${coords.lat}&lng=${coords.lng}${categoryParam}`);
      setNearbyOrgs(resp.data.data || []);
    } catch (err) {
      console.error("Nearby discovery error:", err);
    }
  }, [coords.lat, coords.lng, activeCategory]);

  useEffect(() => {
    setMounted(true);
    const userData = sessionStorage.getItem("user");
    if (userData) {
      const parsed = JSON.parse(userData);
      setUser(parsed);
      toast.success(`Welcome back, ${parsed.username}!`, {
        description: "Your session is live and synchronized.",
        icon: <Zap className="w-4 h-4 text-stripe-purple" />
      });
    }

    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeToken?.organization_id) {
        subscribe(activeToken.organization_id, (rawData: unknown) => {
          const data = rawData as SocketQueueData;
          if (data.event?.token_number === activeToken.token_number) {
             const newPos = data.state?.waiting_list?.findIndex((e) => e.token_number === activeToken.token_number);
             const isServing = data.state?.currently_serving?.token_number === activeToken.token_number;
             
             setActiveToken((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  position: isServing ? 0 : (newPos !== undefined && newPos !== -1 ? newPos + 1 : prev.position),
                  status: isServing ? 'serving' : (newPos !== undefined && newPos !== -1 ? 'waiting' : prev.status)
                };
             });
             
             if (isServing) {
                toast.success("It's your turn!", {
                   description: "Please proceed to the counter.",
                   duration: 10000,
                   icon: <Zap className="w-4 h-4 text-stripe-purple" />
                });
             }
          } else {
             fetchData(true);
          }
       });
       return () => unsubscribe(activeToken.organization_id);
    }
  }, [activeToken?.token_number, activeToken?.organization_id, subscribe, unsubscribe, fetchData]);

  useEffect(() => {
    fetchNearby();
  }, [fetchNearby]);

  const handleJoinQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    const promise = api.post("/queue/join", {
      queue_key: joinQueueKey,
      user_lat: coords.lat,
      user_lon: coords.lng,
      priority: false
    });

    toast.promise(promise, {
      loading: 'Analyzing institution capacity...',
      success: () => {
        setIsJoinModalOpen(false);
        setJoinQueueKey("");
        fetchData();
        return `Successfully joined ${joinQueueKey}!`;
      },
      error: 'Invalid queue key or unauthorized access.',
    });
  };

  const handleCancelToken = async () => {
    if (!activeToken) return;
    
    toast("Confirm Departure", {
      description: "Do you want to release your spot in this queue?",
      action: {
        label: "Confirm",
        onClick: async () => {
          try {
            await api.post(`/queue/${activeToken.queue_key}/cancel/${activeToken.token_number}`);
            toast.success("Spot Released", { description: "You are no longer in the queue." });
            await fetchData();
          } catch {
            toast.error("Process Failed", { description: "Could not cancel the token." });
          }
        }
      }
    });
  };

  if (isLoading && nearbyOrgs.length === 0) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-12 h-12 text-stripe-purple animate-spin" />
        <p className="text-stripe-slate font-medium text-sm animate-pulse tracking-widest uppercase">Syncing Live Data</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 text-left pb-20">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          {mounted && (
            <motion.h1 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-[36px] font-bold text-stripe-navy tracking-tight flex items-center gap-4"
            >
              Bonjour, {user?.username || "Quest"} <Smile className="w-10 h-10 text-stripe-purple/30" />
            </motion.h1>
          )}
          <div className="flex items-center gap-3 mt-1.5 opacity-80">
             <div className="flex items-center gap-2 px-3 py-1 bg-stripe-purple/10 text-stripe-purple rounded-lg border border-stripe-purple/10">
                <MapPin className="w-3.5 h-3.5" />
                <span className="text-[12px] font-black uppercase tracking-widest">{locationName}</span>
             </div>
             {pincode && (
               <span className="text-[12px] font-bold text-stripe-slate bg-[#f6f9fc] px-3 py-1 rounded-lg border border-stripe-border/50">
                 {pincode}
               </span>
             )}
             <span className="w-1 h-1 rounded-full bg-stripe-border mx-1" />
             <div className="text-stripe-slate text-sm font-bold uppercase tracking-widest flex items-center gap-2">
               Real-time Node
               <span className={cn(
                 "w-2 h-2 rounded-full",
                 isConnected ? "bg-green-500 animate-pulse" : "bg-red-400"
               )} />
             </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard/appointments" className="stripe-btn-secondary py-3 px-6 flex items-center gap-2 text-sm font-bold">
            <Plus className="w-4 h-4" /> New Booking
          </Link>
          <button 
            onClick={() => setIsJoinModalOpen(true)}
            className="stripe-btn-primary py-3 px-7 flex items-center gap-2 text-sm font-bold shadow-2xl shadow-stripe-purple/30 hover:scale-[1.05] active:scale-95 transition-all"
          >
             <Zap className="w-4 h-4" /> Join Live Queue
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left Column: Active Queue & Stats */}
        <div className="lg:col-span-2 space-y-10">
          {activeToken ? (
            <motion.div
              layoutId="active-card"
              className="stripe-card relative overflow-hidden group bg-white border-stripe-purple/20 ring-1 ring-stripe-purple/10 shadow-stripe-premium rounded-[40px] p-10"
            >
              <div className="absolute top-0 right-0 p-10">
                <QrCode className="w-20 h-20 text-stripe-purple/10 group-hover:text-stripe-purple/20 transition-all duration-700" />
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-10 text-left relative z-10">
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    <span className="text-[12px] font-extrabold text-green-600 uppercase tracking-[0.2em]">Live Session Active</span>
                  </div>
                  <p className="text-stripe-slate text-sm font-bold tracking-tight">Institution: <span className="text-stripe-navy">{activeToken.queue_key}</span></p>
                  <h2 className="text-[84px] font-extrabold text-stripe-navy tracking-tighter tabular-nums leading-none py-4 text-left">
                    {activeToken.token_number}
                  </h2>
                  <div className="flex items-center gap-10 mt-6 pt-4 border-t border-stripe-border/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-stripe-purple/5 flex items-center justify-center">
                        <Users className="w-5 h-5 text-stripe-purple" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-stripe-navy font-bold text-lg leading-tight">{activeToken.position === 0 ? "At Counter" : `${activeToken.position}nd`}</span>
                        <span className="text-stripe-slate text-[11px] font-bold uppercase tracking-widest">In line</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-stripe-purple/5 flex items-center justify-center">
                        <Timer className="w-5 h-5 text-stripe-purple" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-stripe-navy font-bold text-lg leading-tight">~{activeToken.estimated_wait_mins}m</span>
                        <span className="text-stripe-slate text-[11px] font-bold uppercase tracking-widest">Wait Time</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 min-w-[240px]">
                  <button
                    onClick={() => setIsTicketModalOpen(true)}
                    className="stripe-btn-primary py-5 w-full flex items-center justify-center gap-3 font-bold text-base shadow-2xl shadow-stripe-purple/30 group/btn"
                  >
                    <QrCode className="w-5 h-5 group-hover/btn:scale-110 transition-transform" /> View Live Ticket
                  </button>
                  <button
                    onClick={handleCancelToken}
                    className="py-5 w-full bg-white border-2 border-red-50 text-red-600 rounded-3xl font-bold text-base hover:bg-red-50 hover:border-red-100 transition-all flex items-center justify-center gap-3"
                  >
                    <AlertCircle className="w-5 h-5" /> Release Slot
                  </button>
                </div>
              </div>

              {/* Progress Visualization */}
              <div className="mt-12 space-y-4">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-stripe-slate uppercase tracking-[0.2em]">Queue Pulse</p>
                    <p className="text-sm text-stripe-navy font-bold">Synchronizing every 5s</p>
                  </div>
                  <span className="text-2xl font-bold text-stripe-purple tabular-nums">{activeToken.position === 0 ? "100%" : `${Math.max(100 - activeToken.position * 10, 10)}%`}</span>
                </div>
                <div className="h-4 w-full bg-[#f6f9fc] rounded-2xl overflow-hidden p-1 border border-stripe-border/50">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: activeToken.position === 0 ? "100%" : `${Math.max(100 - activeToken.position * 10, 10)}%` }}
                    className="h-full bg-stripe-purple rounded-xl shadow-[0_0_20px_rgba(83,58,253,0.4)] transition-all ease-out duration-1000"
                  ></motion.div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="stripe-card p-20 bg-white flex flex-col items-center justify-center text-center space-y-8 border-dashed border-2 border-stripe-border shadow-sm rounded-[48px]"
            >
              <div className="w-28 h-28 bg-stripe-purple/[0.04] rounded-full flex items-center justify-center text-stripe-purple/20 relative">
                <Building2 className="w-12 h-12" />
                <div className="absolute inset-0 rounded-full border border-stripe-purple/10 animate-ping"></div>
              </div>
              <div>
                <h3 className="text-3xl font-bold text-stripe-navy tracking-tight">Instant Remote Entry</h3>
                <p className="text-stripe-slate max-w-[400px] mx-auto mt-3 text-lg font-light leading-relaxed">Scan a code or join a medical, banking, or government queue from anywhere. No physical waiting required.</p>
              </div>
              <button
                onClick={() => setIsJoinModalOpen(true)}
                className="stripe-btn-primary px-14 py-5 font-extrabold text-lg shadow-2xl shadow-stripe-purple/40 hover:scale-105 active:scale-95 transition-all"
              >
                Start New Session
              </button>
            </motion.div>
          )}

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <StatCard
              title="Time Reclaimed"
              value="12.4 hrs"
              desc="Skipped linear waiting"
              trend="+12% this week"
              icon={<Zap className="w-6 h-6" />} />
            <StatCard
              title="Member Tier"
              value="Premium"
              desc="Priority priority enabled"
              trend="Status: Ultra"
              icon={<ArrowUpRight className="w-6 h-6 text-stripe-purple" />} />
          </div>

          {/* Nearby Discovery Section */}
          <div className="space-y-8 pt-6 text-left">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[24px] font-bold text-stripe-navy tracking-tight flex items-center gap-4">
                  <MapIcon className="w-7 h-7 text-stripe-purple" /> Verified Nearby Institutions
                </h3>
                <p className="text-stripe-slate text-sm mt-1">Found {nearbyOrgs.length} locations within 5km radius</p>
              </div>
              <div className="flex items-center gap-3">
                <CategoryButton active={activeCategory === 'all'} label="All" onClick={() => setActiveCategory('all')} />
                <CategoryButton active={activeCategory === 'hospital'} label="Hospitals" onClick={() => setActiveCategory('hospital')} />
                <CategoryButton active={activeCategory === 'bank'} label="Banks" onClick={() => setActiveCategory('bank')} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {nearbyOrgs.length > 0 ? nearbyOrgs.slice(0, 3).map((org, i) => (
                <motion.div
                  key={i}
                  whileHover={{ y: -8, scale: 1.02 }}
                  className="stripe-card p-8 cursor-pointer bg-white border-stripe-border hover:border-stripe-purple/30 transition-all shadow-ambient text-left group rounded-[32px]"
                >
                  <div className="w-14 h-14 bg-[#f6f9fc] group-hover:bg-stripe-purple/10 rounded-2xl flex items-center justify-center text-stripe-purple mb-6 transition-all duration-500">
                    {org.types?.includes("hospital") || org.name.toLowerCase().includes("hospital") ? <HeartPulse className="w-7 h-7" /> : <Landmark className="w-7 h-7" />}
                  </div>
                  <h4 className="text-[17px] font-extrabold text-stripe-navy mb-2 line-clamp-1 group-hover:text-stripe-purple transition-colors">{org.name}</h4>
                  <p className="text-[14px] text-stripe-slate mb-8 line-clamp-2 leading-relaxed font-light">{org.address || "Main Street, City Center"}</p>
                  <div className="flex items-center justify-between mt-auto pt-6 border-t border-stripe-border/50">
                    <div className="flex items-center gap-1.5 text-[12px] text-stripe-slate font-bold tracking-tight">
                      <MapPin className="w-4 h-4 text-stripe-purple/40" /> {org.rating ? `${org.rating} Rating` : "1.2 KM"}
                    </div>
                    <div className="px-3 py-1 rounded-lg text-[11px] font-extrabold uppercase bg-green-50 text-green-600 border border-green-100 shadow-sm">
                      Open Now
                    </div>
                  </div>
                </motion.div>
              )) : [1, 2, 3].map(i => (
                <div key={i} className="stripe-card p-8 bg-white border-stripe-border h-56 animate-pulse rounded-[32px]"></div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Appointments & History */}
        <div className="space-y-10 text-left">
          {/* Upcoming Appointments */}
          <div className="stripe-card p-10 bg-white border-stripe-border shadow-stripe-premium text-left relative overflow-hidden group rounded-[40px]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-stripe-purple/[0.03] -mr-16 -mt-16 rounded-full transition-transform group-hover:scale-150 duration-700"></div>

            <h3 className="text-[12px] font-extrabold text-stripe-slate uppercase tracking-[0.2em] mb-8 flex items-center gap-2.5 relative z-10">
              <Calendar className="w-4 h-4 text-stripe-purple" /> Scheduled Session
            </h3>

            {appointments.length > 0 ? (
              <div className="space-y-8 relative z-10">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-stripe-purple font-extrabold text-base">{new Date(appointments[0].start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Today</p>
                    <h4 className="text-[28px] font-bold text-stripe-navy tracking-tight leading-tight">{appointments[0].queue_key}</h4>
                  </div>
                  <div className="px-3 py-1.5 bg-stripe-purple/5 text-stripe-purple text-[11px] font-extrabold uppercase rounded-lg border border-stripe-purple/10">
                    Confirmed
                  </div>
                </div>

                <div className="p-6 bg-[#f6f9fc] rounded-[28px] border border-stripe-border/50 space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-stripe-slate font-bold uppercase tracking-widest">Entry ID</span>
                    <span className="font-mono font-extrabold text-stripe-navy tracking-wider text-sm bg-white px-3 py-1.5 rounded-xl shadow-sm border border-stripe-border/50">
                      {appointments[0].token_number}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-stripe-slate font-bold uppercase tracking-widest">Est. Check-in</span>
                    <span className="text-stripe-navy font-extrabold text-[15px]">10:45 AM</span>
                  </div>
                </div>

                <button className="w-full bg-stripe-navy text-white py-5 rounded-[22px] font-extrabold text-base hover:bg-stripe-navy/90 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl shadow-stripe-navy/20 flex items-center justify-center gap-4">
                  <Navigation className="w-5 h-5 text-stripe-purple" /> Start Commute
                </button>
              </div>
            ) : (
              <div className="text-center py-14 relative z-10">
                <div className="w-20 h-20 bg-stripe-purple/[0.04] rounded-[24px] flex items-center justify-center mx-auto mb-6">
                  <Calendar className="w-10 h-10 text-stripe-purple/30" />
                </div>
                <p className="text-stripe-slate text-base font-medium mb-8 italic">No bookings found for today.</p>
                <Link href="/dashboard/appointments" className="stripe-btn-secondary px-10 py-4 text-xs font-extrabold uppercase tracking-[0.2em] inline-flex items-center justify-center gap-3 group">
                  Book Now <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                </Link>
              </div>
            )}
          </div>

          {/* Live Discovery Map */}
          <div className="stripe-card p-2 bg-white border-stripe-border shadow-stripe-premium rounded-[40px] overflow-hidden group">
            <div className="p-8 pb-4 text-left">
              <h3 className="text-[12px] font-extrabold text-stripe-slate uppercase tracking-[0.2em] mb-1 flex items-center gap-2.5">
                <MapIcon className="w-4 h-4 text-stripe-purple" /> Live Pulse Map
              </h3>
              <p className="text-stripe-navy font-bold text-sm">Real-time status of nearby institutions</p>
            </div>
            <div className="h-[320px] w-full rounded-[32px] overflow-hidden border border-stripe-border relative">
              <iframe
                width="100%"
                height="100%"
                title="Nearby Map"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.google.com/maps/embed/v1/view?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY?.replace('#', '')}&center=${coords.lat},${coords.lng}&zoom=15&maptype=roadmap`}
              ></iframe>
              <div className="absolute bottom-5 left-5 right-5 bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-stripe-purple/10 flex items-center justify-between shadow-lg">
                <div className="flex flex-col">
                  <span className="text-[10px] font-extrabold text-stripe-purple uppercase tracking-[0.1em]">Target Coordinates</span>
                  <span className="text-[11px] font-bold text-stripe-navy font-mono">{coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}</span>
                </div>
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-stripe-purple animate-ping"></div>
                  <div className="w-2 h-2 rounded-full bg-stripe-purple"></div>
                </div>
              </div>
            </div>

            <div className="p-6 pt-4">
              <button onClick={() => setIsCategoryModalOpen(true)} className="w-full py-4 bg-[#f6f9fc] text-stripe-slate hover:text-stripe-purple hover:bg-stripe-purple/5 rounded-2xl font-bold text-[13px] transition-all flex items-center justify-center gap-3">
                <Search className="w-4 h-4" /> Browse Live Categories
              </button>
            </div>
          </div>

          {/* Activity Pulse */}
          <div className="space-y-6 text-left px-4">
            <h3 className="text-[12px] font-extrabold text-stripe-navy tracking-[0.2em] uppercase opacity-50 flex items-center gap-3">
              <HistoryIcon className="w-4 h-4 text-stripe-purple" /> Activity Pulse
            </h3>
            <div className="space-y-4">
              <ActivityRow org="SBI Bank" date="Managed Remote" time="18m wait" />
              <ActivityRow org="Max Health" date="AI Scheduled" time="45m wait" />
              <ActivityRow org="Apollo Care" date="Priority Entry" time="4m wait" />
            </div>
          </div>
        </div>
      </div>

      {/* Join Queue Modal */}
      <AnimatePresence>
        {isJoinModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsJoinModalOpen(false)}
              className="absolute inset-0 bg-stripe-navy/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="bg-white rounded-[48px] p-12 w-full max-w-lg relative z-10 shadow-3xl border border-stripe-purple/10"
            >
              <div className="flex items-center justify-between mb-10">
                <div className="w-16 h-16 bg-stripe-purple/10 rounded-[24px] flex items-center justify-center text-stripe-purple">
                   <Building2 className="w-8 h-8" />
                </div>
                <button onClick={() => setIsJoinModalOpen(false)} className="text-stripe-slate hover:text-stripe-navy p-4 hover:bg-[#f6f9fc] rounded-full transition-all">
                  <X className="w-8 h-8" />
                </button>
              </div>

              <div className="mb-10 text-left">
                <h3 className="text-3xl font-bold text-stripe-navy tracking-tight">Access Local Queues</h3>
                <p className="text-stripe-slate mt-2 text-lg font-light">Select a nearby institution to secure your remote spot instantly.</p>
              </div>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {nearbyOrgs.length > 0 ? (
                  nearbyOrgs.map((org, i) => (
                    <motion.div
                      key={i}
                      whileHover={org.key ? { scale: 1.02 } : {}}
                      whileTap={org.key ? { scale: 0.98 } : {}}
                      onClick={() => {
                        if (org.key) {
                           setJoinQueueKey(org.key);
                           setTimeout(() => {
                              const form = document.getElementById('join-form') as HTMLFormElement;
                              form?.requestSubmit();
                           }, 100);
                        } else {
                           toast.info("Not a Partner Yet", {
                             description: `${org.name} hasn't integrated Lineo queues yet. I've sent a partnership request!`,
                             icon: <Building2 className="w-4 h-4 text-stripe-purple" />
                           });
                        }
                      }}
                      className={cn(
                        "p-6 border-2 rounded-[32px] transition-all flex items-center justify-between group relative overflow-hidden",
                        org.key 
                          ? "border-[#f6f9fc] hover:border-stripe-purple/30 bg-[#f6f9fc] hover:bg-white cursor-pointer shadow-sm"
                          : "border-transparent bg-[#f6f9fc]/50 opacity-60 cursor-not-allowed grayscale"
                      )}
                    >
                      {org.key && (
                         <div className="absolute top-0 right-0 py-1 px-4 bg-stripe-purple text-white text-[9px] font-black uppercase tracking-widest rounded-bl-2xl shadow-sm border-l border-b border-white/20">
                            Partnered
                         </div>
                      )}
                      
                      <div className="flex items-center gap-5">
                         <div className={cn(
                           "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform",
                           org.key ? "bg-white text-stripe-purple shadow-sm group-hover:scale-110" : "bg-stripe-slate/10 text-stripe-slate"
                         )}>
                            {org.name.toLowerCase().includes("hospital") ? <HeartPulse className="w-6 h-6" /> : <Landmark className="w-6 h-6" />}
                         </div>
                         <div className="text-left">
                            <h4 className="font-bold text-stripe-navy text-lg leading-tight flex items-center gap-2">
                               {org.name}
                               {org.key && <CheckCircle2 className="w-4 h-4 text-stripe-purple" />}
                            </h4>
                            <p className="text-stripe-slate text-xs font-bold uppercase tracking-widest mt-0.5">
                               {org.key ? (org.distance ? `${(org.distance/1000).toFixed(1)} km away` : 'Partner Institution') : 'Global Registry'}
                            </p>
                         </div>
                      </div>
                      {org.key ? (
                        <Zap className="w-6 h-6 text-stripe-purple animate-pulse" />
                      ) : (
                        <div className="bg-stripe-slate/10 px-3 py-1.5 rounded-xl text-[9px] font-black text-stripe-slate uppercase">Offline</div>
                      )}
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-10 opacity-50">
                     <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-stripe-purple" />
                     <p className="font-bold text-stripe-slate">Scanning for available queues...</p>
                  </div>
                )}
              </div>

              <form id="join-form" onSubmit={handleJoinQueue} className="hidden">
                 <input type="hidden" value={joinQueueKey} />
              </form>

              <div className="pt-10">
                 <button 
                   onClick={() => setIsJoinModalOpen(false)}
                   className="py-3 w-full text-stripe-slate font-bold hover:text-stripe-navy transition-colors text-base"
                 >
                   Dismiss
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Selection Modal */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCategoryModalOpen(false)}
              className="absolute inset-0 bg-stripe-navy/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-white rounded-[48px] p-12 w-full max-w-2xl relative z-10 shadow-3xl border border-stripe-purple/10"
            >
               <div className="flex items-center justify-between mb-10">
                  <h3 className="text-3xl font-bold text-stripe-navy tracking-tight">Global Categories</h3>
                  <button onClick={() => setIsCategoryModalOpen(false)} className="text-stripe-slate hover:text-stripe-navy p-4 hover:bg-[#f6f9fc] rounded-full transition-all">
                    <X className="w-8 h-8" />
                  </button>
               </div>
               <div className="grid grid-cols-2 gap-6">
                  <CategoryBox icon={<HeartPulse />} title="Hospitals" desc="Real-time clinical queues" onClick={() => { setActiveCategory('hospital'); setIsCategoryModalOpen(false); }} />
                  <CategoryBox icon={<Landmark />} title="Banks" desc="Remote financial sessions" onClick={() => { setActiveCategory('bank'); setIsCategoryModalOpen(false); }} />
                  <CategoryBox icon={<ShoppingCart />} title="Retail" desc="Premium check-in lanes" onClick={() => { setActiveCategory('shopping_mall'); setIsCategoryModalOpen(false); }} />
                  <CategoryBox icon={<Building2 />} title="Government" desc="Verified citizen services" onClick={() => { setActiveCategory('post_office'); setIsCategoryModalOpen(false); }} />
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Digital Pass Modal */}
      <AnimatePresence>
        {isTicketModalOpen && activeToken && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTicketModalOpen(false)}
              className="absolute inset-0 bg-stripe-navy/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, y: 100 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 100 }}
              className="relative w-full max-w-sm bg-white rounded-[40px] overflow-hidden shadow-4xl text-left"
            >
              {/* Header */}
              <div className="bg-stripe-purple p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 -mr-16 -mt-16 rounded-full"></div>
                <div className="relative z-10 flex flex-col gap-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] opacity-80">Lineo Digital Pass</p>
                  <h2 className="text-2xl font-bold tracking-tight">Active Live Spot</h2>
                </div>
              </div>

              {/* Body */}
              <div className="p-10 space-y-8">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-[10px] font-extrabold text-stripe-slate uppercase tracking-widest">Institution</p>
                    <h3 className="text-xl font-bold text-stripe-navy">{activeToken.queue_key}</h3>
                  </div>
                  <div className="w-12 h-12 bg-[#f6f9fc] rounded-2xl flex items-center justify-center text-stripe-purple">
                    <Building2 className="w-6 h-6" />
                  </div>
                </div>

                {/* QR Code Section */}
                <div className="bg-[#f6f9fc] p-8 rounded-[32px] flex flex-col items-center justify-center border border-stripe-border border-dashed relative group">
                  <div className="w-48 h-48 bg-white rounded-2xl shadow-sm flex items-center justify-center text-stripe-navy relative overflow-hidden">
                     <QrCode className="w-32 h-32 opacity-90 group-hover:scale-110 transition-transform duration-500" />
                     {/* Scan animations */}
                     <motion.div 
                       animate={{ top: ['0%', '100%', '0%'] }}
                       transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                       className="absolute left-0 right-0 h-0.5 bg-stripe-purple z-10 opacity-30 shadow-[0_0_10px_#533afd]"
                     />
                  </div>
                  <p className="mt-6 text-2xl font-black text-stripe-navy tracking-[0.2em] font-mono">{activeToken.token_number}</p>
                  <p className="text-[10px] font-bold text-stripe-slate uppercase tracking-widest mt-1">Token Serial ID</p>
                </div>

                <div className="grid grid-cols-2 gap-8">
                   <div className="space-y-1">
                      <p className="text-[10px] font-extrabold text-stripe-slate uppercase tracking-widest">Position</p>
                      <div className="text-xl font-bold text-stripe-purple">#{activeToken.position}</div>
                   </div>
                   <div className="space-y-1">
                      <p className="text-[10px] font-extrabold text-stripe-slate uppercase tracking-widest">Wait Time</p>
                      <div className="text-xl font-bold text-stripe-navy">~{activeToken.estimated_wait_mins || 0}m</div>
                   </div>
                </div>
              </div>

              <button 
                onClick={() => setIsTicketModalOpen(false)}
                className="w-full py-6 bg-stripe-navy text-white font-bold text-sm tracking-widest uppercase hover:bg-stripe-navy/90 transition-all"
              >
                Close Ticket
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CategoryBox({ icon, title, desc, onClick }: { icon: React.ReactNode, title: string, desc: string, onClick: () => void }) {
  return (
    <button onClick={onClick} className="p-8 rounded-[32px] border-2 border-stripe-border hover:border-stripe-purple/30 hover:bg-stripe-purple/[0.02] transition-all group text-left">
       <div className="w-12 h-12 rounded-2xl bg-stripe-purple/10 flex items-center justify-center text-stripe-purple mb-6 group-hover:scale-110 transition-transform">
          {icon}
       </div>
       <h4 className="text-xl font-bold text-stripe-navy mb-2">{title}</h4>
       <p className="text-sm text-stripe-slate font-light leading-relaxed">{desc}</p>
    </button>
  );
}

function CategoryButton({ active, label, onClick }: { active: boolean, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-5 py-2 rounded-xl text-[13px] font-bold transition-all duration-300",
        active 
          ? "bg-stripe-purple text-white shadow-lg shadow-stripe-purple/20" 
          : "bg-[#f6f9fc] text-stripe-slate hover:bg-stripe-border"
      )}
    >
      {label}
    </button>
  );
}

function StatCard({ title, value, desc, trend, icon }: { title: string, value: string, desc: string, trend: string, icon: React.ReactNode }) {
  return (
    <div className="stripe-card p-10 bg-white hover:border-stripe-purple/30 hover:shadow-stripe-premium transition-all group rounded-[40px] text-left border-stripe-border shadow-sm">
      <div className="flex items-center justify-between mb-8">
         <div className="w-14 h-14 rounded-2xl bg-[#f6f9fc] flex items-center justify-center text-stripe-purple group-hover:bg-stripe-purple group-hover:text-white transition-all duration-500">
            {icon}
         </div>
         <span className="text-[11px] font-extrabold text-green-600 bg-green-50 px-3 py-1.5 rounded-xl tracking-widest border border-green-100 shadow-sm">{trend}</span>
      </div>
      <p className="text-[14px] font-extrabold text-stripe-slate uppercase tracking-[0.2em] mb-3 font-display">{title}</p>
      <h3 className="text-4xl font-light text-stripe-navy tabular-nums mb-3 tracking-tighter">{value}</h3>
      <p className="text-[15px] text-stripe-slate/80 font-light">{desc}</p>
    </div>
  );
}

function ActivityRow({ org, date, time }: { org: string, date: string, time: string }) {
  return (
    <div className="flex items-center justify-between p-6 rounded-[32px] border border-transparent hover:border-stripe-border/50 hover:bg-white transition-all cursor-default group text-left">
       <div className="flex items-center gap-5">
          <div className="w-3 h-3 rounded-full bg-stripe-border group-hover:bg-stripe-purple group-hover:scale-150 transition-all duration-500"></div>
          <div>
            <h5 className="text-[16px] font-extrabold text-stripe-navy leading-tight group-hover:text-stripe-purple transition-colors">{org}</h5>
            <p className="text-[13px] text-stripe-slate font-medium opacity-60 tracking-tight">{date}</p>
          </div>
       </div>
       <div className="text-right">
          <p className="text-[15px] font-extrabold text-stripe-navy tabular-nums">{time}</p>
       </div>
    </div>
  );
}
