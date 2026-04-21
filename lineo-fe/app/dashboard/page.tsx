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
  Star as StarIcon,
  Bell,
  Settings as SettingsIcon,
  LogOut,
  ChevronRight,
  TrendingUp,
  Clock,
  ExternalLink,
  Info,
  TriangleAlert,
  UserPlus,
  Check,
  Activity
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import Link from "next/link";
import { toast } from "sonner";
import { useLocation } from "@/context/LocationContext";
import { useSocket } from "@/context/SocketContext";

// Shadcn UI Components
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

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
  lat?: number;
  lng?: number;
  partnered?: boolean;
  queues?: { name: string; key: string; is_paused: boolean }[];
}

interface Appointment {
  start_time: string;
  queue_key: string;
  token_number: string;
}

interface SocketQueueData {
  event?: { token_number: string; action?: string };
  state?: {
    waiting_list: { token_number: string; username: string; has_disability: boolean }[];
    currently_serving: { token_number: string; username: string; has_disability: boolean } | null;
  };
}

// ─────────────────────────────────────────────────────
// Main Dashboard Component
// ─────────────────────────────────────────────────────
export default function UserDashboard() {
  const { coords, address: locationName } = useLocation();
  const { isConnected, subscribe, unsubscribe } = useSocket();
  const [activeToken, setActiveToken] = useState<TokenData | null>(null);
  const [nearbyOrgs, setNearbyOrgs] = useState<Organization[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [joinQueueKey, setJoinQueueKey] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activities, setActivities] = useState<{ id: string; title: string; subtitle: string; iconType: string; time: string }[]>([
    { id: "init-1", title: "System Ready", subtitle: "Connected to Lineo Nodes", iconType: "check", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);

  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isPriorityToggle, setIsPriorityToggle] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  
  // Real-time Queue Matrix
  const [isQueueMatrixModalOpen, setIsQueueMatrixModalOpen] = useState(false);
  const [queueMatrix, setQueueMatrix] = useState<any>(null);
  const [isMatrixLoading, setIsMatrixLoading] = useState(false);

  // Completion Pulse States
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [completedInfo, setCompletedInfo] = useState<{ queueKey: string; tokenNumber: string } | null>(null);
  
  // Modal Filtering Stats
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [modalCategory, setModalCategory] = useState("all");

  // ─── Data Fetching ──────────────────────────────────
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
    }
    fetchData();
  }, [fetchData]);

  // ─── Real-time Socket ───────────────────────────────
  useEffect(() => {
    if (activeToken?.organization_id) {
        subscribe(activeToken.organization_id, (rawData: unknown) => {
          const data = rawData as SocketQueueData;
          if (data.event?.token_number === activeToken.token_number) {
             const newPos = data.state?.waiting_list?.findIndex((e) => e.token_number === activeToken.token_number);
             const isServing = data.state?.currently_serving?.token_number === activeToken.token_number;
             
             if (data.state) {
               setQueueMatrix(data.state);
             }
             
             if (data.event?.action) {
               const actionText = data.event!.action!.replace(/_/g, ' ');
               setActivities(prev => [{
                 id: Math.random().toString(),
                 title: `Token ${data.event!.token_number}`,
                 subtitle: actionText,
                 iconType: data.event!.action === 'ticket_completed' ? 'check' : 'info',
                 time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
               }, ...prev].slice(0, 5));

               window.dispatchEvent(new CustomEvent("lineo_notify", {
                 detail: {
                   title: `Token ${data.event!.token_number}`,
                   description: `Status updated to ${actionText}`,
                   type: data.event!.action === 'ticket_completed' ? "success" : "info"
                 }
               }));
             }

             if (data.event?.action === "ticket_completed") {
                setCompletedInfo({ 
                  queueKey: activeToken.queue_key, 
                  tokenNumber: activeToken.token_number 
                });
                setShowSuccessScreen(true);
                setActiveToken(null);
                
                // Cinematic delay before showing feedback modal
                setTimeout(() => {
                  setShowSuccessScreen(false);
                  setIsFeedbackModalOpen(true);
                }, 6000);
                return;
             }

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
                   icon: <Zap className="w-4 h-4 text-[#493ee5]" />
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

  // ─── Discovery Pulse ───────────────────────────────
  const [prevOrgCount, setPrevOrgCount] = useState(0);
  useEffect(() => {
    const partneredCount = nearbyOrgs.filter(o => o.partnered).length;
    if (prevOrgCount > 0 && partneredCount > prevOrgCount) {
      const latest = nearbyOrgs.find(o => o.partnered);
      if (latest) {
        toast.info("Discovery Pulse", {
          description: `New institutional node [${latest.name}] is now live nearby!`,
          icon: <Activity className="w-4 h-4 text-[#493ee5]" />,
          duration: 6000
        });
      }
    }
    setPrevOrgCount(partneredCount);
  }, [nearbyOrgs, prevOrgCount]);

  // ─── Actions ────────────────────────────────────────
  const handleJoinQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinQueueKey) return;

    if (isPriorityToggle) {
        toast.info("Priority Payment Active", { description: "Processing VIP Checkout via Razorpay..." });
    }

    // Optimistic close and toast
    setIsJoinModalOpen(false);
    const promise = api.post("/queue/join", {
      queue_key: joinQueueKey,
      user_lat: coords.lat,
      user_lon: coords.lng,
      priority: isPriorityToggle
    });

    toast.promise(promise, {
      loading: 'Securing your spot...',
      success: (resp) => {
        setJoinQueueKey("");
        setActiveToken(resp.data.data); // Optimistic update
        setActivities(prev => [{
          id: Math.random().toString(),
          title: `Joined ${resp.data.data.queue_key}`,
          subtitle: "Slot secured successfully",
          iconType: "check",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }, ...prev].slice(0, 5));
        return `Successfully joined!`;
      },
      error: (err) => {
        fetchData(true); // Re-sync on error
        return err.response?.data?.message || 'Unable to join queue.';
      },
    });
  };

  const fetchQueueMatrix = async () => {
    if (!activeToken) return;
    setIsMatrixLoading(true);
    setIsQueueMatrixModalOpen(true);
    try {
      const resp = await api.get(`/queue/${activeToken.queue_key}/state`);
      setQueueMatrix(resp.data.data);
    } catch (err) {
      toast.error("Security Link Failed", { description: "Could not fetch institutional queue matrix." });
    } finally {
      setIsMatrixLoading(false);
    }
  };

  const handleCancelToken = async () => {
    if (!activeToken) return;
    
    toast("Confirm Departure", {
      description: "Do you want to release your spot in this queue?",
      action: {
        label: "Confirm",
        onClick: async () => {
          const originalToken = activeToken;
          setActiveToken(null); // Optimistic UI
          
          try {
            await api.post(`/queue/${originalToken.queue_key}/cancel/${originalToken.token_number}`);
            toast.success("Spot Released", { description: "You are no longer in the queue." });
            setActivities(prev => [{
              id: Math.random().toString(),
              title: "Departed Queue",
              subtitle: `Released spot #${originalToken.token_number}`,
              iconType: "info",
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }, ...prev].slice(0, 5));
          } catch {
            setActiveToken(originalToken); // Rollback
            toast.error("Process Failed", { description: "Could not cancel the token." });
          }
        }
      }
    });
  };

  if (isLoading && nearbyOrgs.length === 0) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Content Skeleton */}
          <div className="lg:col-span-8 space-y-8">
            <div className="h-[340px] bg-[#f1f4f7] rounded-3xl w-full" />
            <div className="grid grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <div key={i} className="h-28 bg-[#f1f4f7] rounded-2xl" />)}
            </div>
            <div className="h-[400px] bg-[#f1f4f7] rounded-3xl w-full" />
          </div>
          {/* Sidebar Skeleton */}
          <div className="lg:col-span-4 space-y-8">
            <div className="h-[260px] bg-slate-200/50 rounded-2xl w-full" />
            <div className="h-[300px] bg-[#f1f4f7] rounded-2xl w-full" />
            <div className="h-[200px] bg-[#f1f4f7] rounded-2xl w-full" />
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      
      {/* ━━━ DASHBOARD GRID ━━━ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* ━━━ MAIN CONTENT (COL 8) ━━━ */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* ── Live Session Hub / Empty State ── */}
          <AnimatePresence mode="wait">
            {showSuccessScreen ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, y: 20 }}
                key="success-screen"
              >
                 <div className="bg-white border-2 border-emerald-500/10 rounded-3xl p-12 relative overflow-hidden flex flex-col items-center text-center shadow-[0_32px_64px_-16px_rgba(16,185,129,0.1)]">
                    <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
                    <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-8 relative group">
                       <CheckCircle2 className="w-12 h-12 text-emerald-600 relative z-10" />
                       <motion.div 
                         animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
                         transition={{ duration: 2, repeat: Infinity }}
                         className="absolute inset-0 bg-emerald-200 rounded-full"
                       />
                    </div>
                    <h2 className="text-3xl font-black text-[#181c1e] mb-4" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Vector Synchronization Complete</h2>
                    <p className="text-[#49607e] text-base max-w-md font-medium leading-relaxed mb-8">
                       Your session at <span className="text-emerald-600 font-bold">{completedInfo?.queueKey}</span> with token <span className="text-[#181c1e] font-black">#{completedInfo?.tokenNumber}</span> has been successfully executed.
                    </p>
                    <div className="flex items-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-700 rounded-2xl text-xs font-black uppercase tracking-widest border border-emerald-100">
                       <Smile className="w-4 h-4" /> Thank you for choosing Lineo
                    </div>
                 </div>
              </motion.div>
            ) : activeToken ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, y: -20 }}
                key="active-token"
              >
                <div className="glass-panel rounded-3xl p-8 relative overflow-hidden">
                  {/* Decorative glow */}
                  <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#493ee5]/10 rounded-full blur-3xl" />
                  
                  {/* Header */}
                  <div className="flex justify-between items-start mb-10 relative z-10">
                    <div>
                      <h2 className="text-3xl font-extrabold text-[#181c1e] tracking-tight mb-1" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                        Live Session Hub
                      </h2>
                      <div className="flex items-center gap-3">
                         <p className="text-[#49607e] font-medium text-sm">Unit: {activeToken.queue_key}</p>
                         <div className="h-4 w-px bg-[#e5e8eb]" />
                         <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#493ee5]/5 rounded-lg border border-[#493ee5]/10">
                            <Zap className="w-3 h-3 text-[#493ee5]" />
                            <span className="text-[10px] font-black text-[#181c1e] uppercase tracking-wider">
                               Serving: {queueMatrix?.currently_serving?.username || "Institutional Node Idle"}
                            </span>
                         </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-[#e2dfff] text-[#181c1e] px-4 py-2 rounded-full text-sm font-bold shadow-neobrutal" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                      <span className="w-2 h-2 rounded-full bg-[#493ee5] animate-pulse" />
                      Active
                    </div>
                  </div>

                  {/* Token Display Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                    {/* Current Token */}
                    <div className="bg-white rounded-2xl p-6 ghost-border flex flex-col items-center justify-center text-center">
                      <span className="text-[#49607e] font-semibold text-xs mb-3 uppercase tracking-[0.2em]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                        Now Serving
                      </span>
                      <div className="text-7xl font-black text-[#493ee5] tracking-tighter leading-none" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                        {activeToken.token_number}
                      </div>
                      <p className="text-[#49607e] text-sm mt-4 font-medium">
                        {activeToken.position === 0 ? "At Counter" : `Position #${activeToken.position} in line`}
                      </p>
                    </div>
                    
                    {/* Queue Details */}
                    <div className="flex flex-col justify-center space-y-6">
                      {/* Stats Row */}
                      <div className="flex items-center gap-4">
                        <div className="flex-1 bg-[#f1f4f7] rounded-xl p-4">
                          <div className="flex items-center gap-2 text-[#49607e] text-xs font-semibold mb-1">
                            <Clock className="w-3.5 h-3.5" />
                            Wait Time
                          </div>
                          <div className="text-2xl font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                            {activeToken.estimated_wait_mins}<span className="text-base text-[#49607e] font-medium ml-0.5">m</span>
                          </div>
                        </div>
                        <div className="flex-1 bg-[#f1f4f7] rounded-xl p-4">
                          <div className="flex items-center gap-2 text-[#49607e] text-xs font-semibold mb-1">
                            <Zap className="w-3.5 h-3.5" />
                            Avg Speed
                          </div>
                          <div className="text-2xl font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                            4<span className="text-base text-[#49607e] font-medium ml-0.5">m/u</span>
                          </div>
                        </div>
                      </div>

                      {/* Queue Pulse Bar */}
                      <div>
                        <div className="flex justify-between text-sm font-semibold mb-2">
                          <span className="text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Queue Pulse</span>
                          <span className="text-[#493ee5]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                            {activeToken.position === 0 ? "Serving Now" : `${Math.max(100 - activeToken.position * 10, 10)}% Capacity`}
                          </span>
                        </div>
                        <div className="h-3 bg-[#e5e8eb] rounded-full overflow-hidden relative">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: activeToken.position === 0 ? "100%" : `${Math.max(100 - activeToken.position * 10, 10)}%` }}
                            className="absolute top-0 left-0 h-full rounded-full pulse-glow"
                            style={{ background: 'linear-gradient(90deg, #493ee5, #635bff)' }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-4 mt-8 relative z-10">
                    <Button onClick={() => setIsTicketModalOpen(true)} className="kinetic-btn-primary flex-1 h-14 text-base gap-3">
                      <QrCode className="w-5 h-5" /> View Digital Pass
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={handleCancelToken} 
                      className="h-14 px-6 rounded-2xl font-semibold text-[#49607e] bg-[#f1f4f7] hover:bg-red-50 hover:text-red-600 transition-all"
                      style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
                    >
                      Cancel Spot
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                key="no-token"
              >
                <div className="glass-panel rounded-3xl p-8 relative overflow-hidden">
                  <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#493ee5]/10 rounded-full blur-3xl" />
                  
                  <div className="flex justify-between items-start mb-10 relative z-10">
                    <div>
                      <h2 className="text-3xl font-extrabold text-[#181c1e] tracking-tight mb-1" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                        Live Session Hub
                      </h2>
                      <p className="text-[#49607e] font-medium text-sm">No active session — join a queue to get started</p>
                    </div>
                    <div className="flex items-center gap-2 bg-[#f1f4f7] text-[#49607e] px-4 py-2 rounded-full text-sm font-bold" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                      <span className="w-2 h-2 rounded-full bg-[#49607e]/40" />
                      Idle
                    </div>
                  </div>

                  <div className="relative z-10 flex flex-col items-center justify-center py-8 space-y-6">
                    <div className="w-20 h-20 bg-[#f1f4f7] rounded-2xl flex items-center justify-center shadow-inner">
                      <MapPulseIcon />
                    </div>
                    <div className="text-center space-y-2">
                      <h3 className="text-xl font-bold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Queue discovery pulse</h3>
                      <p className="text-[#49607e] text-sm max-w-sm mx-auto">Join active queues for healthcare, finance, or retail instantly from nearby institutions.</p>
                    </div>
                    <Button onClick={() => setIsJoinModalOpen(true)} className="kinetic-btn-primary h-12 px-8 text-sm gap-2">
                      <Search className="w-4 h-4" /> Search Live Queues
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Stat Metric Cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard 
              icon={<Clock className="w-[18px] h-[18px]" />}
              label="Avg Wait Time"
              value={activeToken ? `${activeToken.estimated_wait_mins}` : "14"}
              unit="m"
            />
            <StatCard 
              icon={<Users className="w-[18px] h-[18px]" />}
              label="In Queue"
              value={activeToken ? `${activeToken.position}` : "42"}
            />
            <StatCard 
              icon={<CheckCircle2 className="w-[18px] h-[18px]" />}
              label="Served Today"
              value="128"
            />
          </div>

          {/* ── Nearby / History Tabs ── */}
          <Tabs defaultValue="nearby" className="w-full">
            {/* Tab Header Bar — always on top */}
            <div className="bg-white rounded-2xl p-4 ghost-border mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h3 className="text-lg font-bold text-[#181c1e] hidden sm:block" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Discover</h3>
                  <TabsList className="bg-[#f1f4f7] p-1 rounded-xl h-11">
                    <TabsTrigger value="nearby" className="rounded-lg px-6 h-9 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#493ee5] text-sm font-bold transition-all" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Nearby</TabsTrigger>
                    <TabsTrigger value="history" className="rounded-lg px-6 h-9 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#493ee5] text-sm font-bold transition-all" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>History</TabsTrigger>
                  </TabsList>
                </div>
                
                <div className="flex items-center bg-[#f1f4f7] rounded-xl px-1.5 py-1 gap-1">
                  {['all', 'hospital', 'bank'].map((cat) => (
                    <button 
                      key={cat}
                      className={cn(
                        "rounded-lg h-8 px-4 text-xs font-bold capitalize transition-all",
                        activeCategory === cat 
                          ? "bg-white text-[#493ee5] shadow-sm" 
                          : "text-[#49607e] hover:text-[#181c1e]"
                      )}
                      style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
                      onClick={() => setActiveCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Cards Grid — below the selector */}
            <TabsContent value="nearby" className="mt-0 outline-none">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {nearbyOrgs.length > 0 ? nearbyOrgs.slice(0, 6).map((org, i) => (
                  <motion.div
                    key={i}
                    whileHover={{ y: -4 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    <div 
                      onClick={() => {
                        if (org.key) {
                          setJoinQueueKey(org.key);
                          setSelectedOrg(org);
                          setIsJoinModalOpen(true);
                        } else {
                          toast.info("Partner Pending", { icon: <Info className="w-4 h-4" /> });
                        }
                      }}
                      className="group cursor-pointer bg-white rounded-2xl p-5 ghost-border hover:shadow-ambient transition-all duration-300"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-[#f1f4f7] flex items-center justify-center text-[#49607e] group-hover:bg-[#493ee5] group-hover:text-white transition-all duration-300 shrink-0">
                          {org.types?.includes("hospital") ? <HeartPulse className="w-6 h-6" /> : <Landmark className="w-6 h-6" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-bold text-[#181c1e] text-base truncate" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{org.name}</h4>
                            <div className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg shrink-0">
                              <StarIcon className="w-3 h-3 fill-amber-500" />
                              {org.rating || "4.8"}
                            </div>
                          </div>
                          <p className="text-xs text-[#49607e] font-medium truncate mt-0.5">{org.address || "Main Street, Central Node"}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-1.5 text-xs text-[#49607e]">
                              <Users className="w-3.5 h-3.5 text-[#493ee5] opacity-60" />
                              <span className="font-semibold text-[#181c1e]">4 ahead</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-[#49607e]">
                              <Clock className="w-3.5 h-3.5 text-[#493ee5] opacity-60" />
                              <span className="font-semibold text-[#181c1e]">~12m</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )) : [1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-28 rounded-2xl bg-[#f1f4f7]" />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-0 outline-none">
              <div className="space-y-3">
                 {[
                   { org: "SBI Main Branch", status: "Completed", time: "15m wait", color: "green" },
                   { org: "Apollo Heart Center", status: "Active", time: "Joined", color: "blue" },
                   { org: "HDFC Bank", status: "Completed", time: "22m wait", color: "green" }
                 ].map((h, i) => (
                   <div key={i} className="bg-white rounded-2xl p-5 flex items-center justify-between ghost-border hover:shadow-ambient transition-all duration-300">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-3 h-3 rounded-full",
                          h.color === 'green' ? 'bg-green-500' : 'bg-[#493ee5] pulse-glow'
                        )} />
                        <div>
                          <h5 className="text-base font-bold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{h.org}</h5>
                          <p className="text-xs text-[#49607e] font-medium">Today • {h.status}</p>
                        </div>
                      </div>
                      <div className="bg-[#f1f4f7] px-4 py-1.5 rounded-xl text-sm font-bold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                        {h.time}
                      </div>
                   </div>
                 ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* ━━━ SIDEBAR (COL 4) ━━━ */}
        <div className="lg:col-span-4 space-y-8">

          {/* ── Digital Entry Pass (Dynamic Card) ── */}
          <div 
            className="rounded-2xl p-6 bg-white ghost-border relative overflow-hidden group hover:shadow-ambient transition-all duration-300"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#493ee5]/5 rounded-full blur-2xl group-hover:bg-[#493ee5]/10 transition-colors pointer-events-none" />
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-[#493ee5]/5 text-[#493ee5] rounded-2xl flex items-center justify-center mb-4 border border-[#493ee5]/10 group-hover:scale-105 transition-transform duration-300">
                {activeToken ? (
                  <div className="relative group/qr p-2 bg-white rounded-xl">
                    <QRCodeSVG 
                      value={`${activeToken.token_number}-${activeToken.queue_key}`} 
                      size={64}
                      level="H"
                      includeMargin={false}
                      fgColor="#493ee5"
                      bgColor="transparent"
                      imageSettings={{
                        src: "/favicon.ico",
                        x: undefined,
                        y: undefined,
                        height: 12,
                        width: 12,
                        excavate: true,
                      }}
                    />
                    {/* Animated scanning line effect */}
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-[#493ee5]/30 animate-scan pointer-events-none" />
                  </div>
                ) : (
                  <QrCode className="w-8 h-8" />
                )}
              </div>
              <h3 className="text-xl font-extrabold mb-1 tracking-tight text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                {activeToken ? "My Entry Pass" : "Digital Entry Pass"}
              </h3>
              <p className="text-[#49607e] text-xs font-medium mb-6">
                {activeToken ? `Token ${activeToken.token_number} is active at ${activeToken.queue_key}` : "Scan to join the fast track instantly"}
              </p>
              <button 
                onClick={() => activeToken ? setIsTicketModalOpen(true) : setIsJoinModalOpen(true)}
                className="w-full py-3 rounded-xl font-bold text-sm text-white shadow-neobrutal hover:-translate-y-0.5 active:translate-y-0 transition-all font-manrope"
                style={{ background: '#493ee5' }}
              >
                {activeToken ? "View Digital Pass" : "Generate Pass"}
              </button>
            </div>
          </div>

          {/* ── Recent Activity ── */}
          <div className="bg-white rounded-2xl p-6 ghost-border">
            <h3 className="text-lg font-bold text-[#181c1e] mb-5 pb-4 border-b border-[#e5e8eb]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
              Recent Activity
            </h3>
            <div className="space-y-4">
              {activities.map(act => (
                <div key={act.id} className="flex items-start gap-3.5">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    act.iconType === 'check' ? "bg-[#d9e3f9] text-[#181c1e]" : "bg-[#d2e4ff] text-[#181c1e]"
                  )}>
                    {act.iconType === 'check' ? <Check className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#181c1e] capitalize">{act.title}</div>
                    <div className="text-xs text-[#49607e] capitalize">{act.time} • {act.subtitle}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Appointment Preview ── */}
          <div className="bg-white rounded-2xl p-6 ghost-border">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xs font-extrabold uppercase tracking-[0.25em] text-[#49607e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Next Appointment</h3>
              <Calendar className="w-4.5 h-4.5 text-[#493ee5]" />
            </div>
            
            {appointments.length > 0 ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-[#493ee5] font-extrabold text-2xl tabular-nums" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                    {new Date(appointments[0].start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <h4 className="text-lg font-bold text-[#181c1e] truncate" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{appointments[0].queue_key}</h4>
                  <p className="text-xs text-[#49607e] font-medium flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 opacity-40" /> Sector 44, Business Hub
                  </p>
                </div>
                <Button asChild className="kinetic-btn-primary w-full h-11 text-sm gap-2">
                  <Link href="/dashboard/appointments">
                    <Navigation className="w-4 h-4" /> Start Transit
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="text-center py-6 space-y-3">
                <div className="w-14 h-14 bg-[#f1f4f7] rounded-xl flex items-center justify-center mx-auto opacity-50">
                  <Calendar className="w-7 h-7 text-[#49607e]" />
                </div>
                <div>
                  <p className="text-[#181c1e] font-bold text-sm" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Idle Schedule</p>
                  <p className="text-[#49607e] text-xs">Your calendar is currently open.</p>
                </div>
                <Button variant="ghost" className="rounded-xl text-[#493ee5] hover:bg-[#493ee5]/5 text-sm font-bold h-9" asChild style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                  <Link href="/dashboard/appointments">Select a Slot</Link>
                </Button>
              </div>
            )}
          </div>

          {/* ── Map Preview ── */}
          <div className="rounded-2xl overflow-hidden bg-white p-2">
            <div className="relative h-[280px] w-full rounded-xl overflow-hidden">
               <iframe
                width="100%"
                height="100%"
                title="Nearby Map"
                style={{ border: 0, filter: 'grayscale(0.1) contrast(1.05)' }}
                loading="lazy"
                allowFullScreen
                src={selectedOrg 
                    ? `https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY?.replace('#', '') || ''}&q=${selectedOrg.lat && selectedOrg.lng ? `${selectedOrg.lat},${selectedOrg.lng}` : encodeURIComponent(selectedOrg.name + ' ' + (locationName || ''))}&zoom=16`
                    : `https://www.google.com/maps/embed/v1/view?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY?.replace('#', '')}&center=${coords.lat},${coords.lng}&zoom=15&maptype=roadmap`}
              ></iframe>
              <div className="absolute inset-x-3 bottom-3 glass-panel p-3 rounded-xl flex items-center justify-between">
                 <div>
                    <p className="text-[9px] font-extrabold text-[#493ee5] uppercase tracking-[0.3em]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Active Node</p>
                    <p className="text-sm font-bold text-[#181c1e] truncate max-w-[160px]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{selectedOrg?.name || locationName || "Central Area"}</p>
                 </div>
                 <div className="w-9 h-9 rounded-xl bg-[#181c1e] flex items-center justify-center text-white shadow-neobrutal hover:rotate-12 transition-transform">
                    <Navigation className="w-4 h-4" />
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* MODALS                                         */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

      {/* ── Join Queue Modal ── */}
      <Dialog open={isJoinModalOpen} onOpenChange={setIsJoinModalOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-3xl border-none shadow-ambient">
          <div className="p-8 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #493ee5, #635bff)' }}>
             <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-3xl animate-pulse" />
             <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mb-5 backdrop-blur-xl border border-white/20">
                <Building2 className="w-7 h-7" />
             </div>
             <DialogTitle className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Access Local Queues</DialogTitle>
             <DialogDescription className="text-white/70 text-sm mt-1.5 font-medium">Connect with active nodes in your vicinity.</DialogDescription>
          </div>
          
          <div className="p-6 space-y-5 bg-white">
             {/* Search and Filter in Modal */}
             <div className="space-y-4">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#49607e] group-focus-within:text-[#493ee5] transition-colors" />
                  <input
                    type="text"
                    placeholder="Search by name or type..."
                    className="w-full pl-11 pr-4 py-3 bg-[#f1f4f7] rounded-xl outline-none transition-all text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#493ee5]/10"
                    onChange={(e) => setModalSearchQuery(e.target.value)}
                    value={modalSearchQuery}
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {['all', 'hospital', 'bank'].map((cat) => (
                    <button
                      key={cat}
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

             <ScrollArea className="h-[350px] pr-3 -mr-3">
                <div className="space-y-3 pb-4">
                  <AnimatePresence mode="popLayout">
                    {nearbyOrgs.filter(org => {
                      const matchesSearch = org.name.toLowerCase().includes(modalSearchQuery.toLowerCase());
                      const matchesCat = modalCategory === 'all' || org.types?.includes(modalCategory);
                      return matchesSearch && matchesCat;
                    }).length > 0 ? (
                      nearbyOrgs
                        .filter(org => {
                          const matchesSearch = org.name.toLowerCase().includes(modalSearchQuery.toLowerCase());
                          const matchesCat = modalCategory === 'all' || org.types?.includes(modalCategory);
                          return matchesSearch && matchesCat;
                        })
                        .map((org, i) => (
                          <motion.div
                            key={org.key || i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 25 }}
                          >
                            <div
                              onClick={() => {
                                if (org.key) {
                                  setJoinQueueKey(org.key);
                                  setSelectedOrg(org);
                                } else {
                                  toast.info("Partner Pending", { description: `${org.name} hasn't joined Lineo yet.` });
                                }
                              }}
                              className={cn(
                                "group p-4 rounded-2xl transition-all flex items-center justify-between border border-transparent hover:border-[#493ee5]/10",
                                joinQueueKey === org.key && org.key 
                                  ? "bg-[#493ee5]/5 ring-2 ring-[#493ee5] shadow-inner cursor-pointer"
                                  : org.key 
                                    ? "bg-[#f1f4f7] hover:bg-white hover:shadow-ambient cursor-pointer"
                                    : "opacity-60 saturate-50 cursor-not-allowed bg-[#f1f4f7] border border-[#e5e8eb]/50"
                              )}
                            >
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                                  org.key ? "bg-white text-[#493ee5] shadow-sm group-hover:bg-[#493ee5] group-hover:text-white" : "bg-[#ebeef1] text-[#49607e]"
                                )}>
                                    {org.types?.includes("hospital") ? <HeartPulse className="w-6 h-6" /> : <Landmark className="w-6 h-6" />}
                                </div>
                                <div>
                                    <h4 className="font-bold text-[#181c1e] text-base group-hover:text-[#493ee5] transition-colors" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                                      {org.name}
                                    </h4>
                                    <p className="text-xs text-[#49607e] font-medium mt-0.5">
                                      {org.partnered 
                                          ? (org.distance ? `${(org.distance/1000).toFixed(1)} km away` : 'Partner Active')
                                          : 'Not on Lineo yet'}
                                    </p>
                                </div>
                              </div>
                              {org.key && joinQueueKey === org.key && (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                  <CheckCircle2 className="w-5 h-5 text-[#493ee5]" />
                                </motion.div>
                              )}
                            </div>
                          </motion.div>
                        ))
                    ) : (
                      <div className="text-center py-16 opacity-40">
                         {modalSearchQuery ? (
                           <div className="space-y-2">
                             <Search className="w-8 h-8 mx-auto mb-2 opacity-20" />
                             <p className="font-bold text-sm text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>No nodes found</p>
                             <p className="text-xs">Try a different search term</p>
                           </div>
                         ) : (
                           <>
                             <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-[#493ee5]" />
                             <p className="font-bold text-sm text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Scanning Nodes...</p>
                           </>
                         )}
                      </div>
                    )}
                  </AnimatePresence>
                </div>
             </ScrollArea>

             {selectedOrg && selectedOrg.partnered && selectedOrg.queues && (
                <div className="space-y-4">
                  <Label className="text-xs font-bold text-[#49607e] uppercase tracking-[0.2em]">Operational Units Available</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {selectedOrg.queues.map((q) => (
                      <button
                        key={q.key}
                        onClick={() => setJoinQueueKey(q.key)}
                        disabled={q.is_paused}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-xl border transition-all text-left",
                          joinQueueKey === q.key 
                            ? "border-[#493ee5] bg-[#493ee5]/5 shadow-sm" 
                            : "border-transparent bg-[#f1f4f7] hover:bg-[#e2dfff]/30",
                          q.is_paused && "opacity-40 cursor-not-allowed grayscale"
                        )}
                      >
                        <div>
                          <p className="font-bold text-[#181c1e] text-sm" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{q.name}</p>
                          <p className="text-[10px] text-[#49607e] font-extrabold uppercase mt-0.5">{q.key}</p>
                        </div>
                        {q.is_paused ? (
                          <Badge variant="outline" className="text-[9px] bg-red-50 text-red-600 border-red-100">SUSPENDED</Badge>
                        ) : (
                          joinQueueKey === q.key && <CheckCircle2 className="w-4 h-4 text-[#493ee5]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
             )}

             {joinQueueKey && (
               <form onSubmit={handleJoinQueue} className="space-y-5 pt-5 border-t border-[#e5e8eb]">
                  <div className="flex items-center justify-between p-5 bg-[#f1f4f7] rounded-2xl">
                    <div className="space-y-0.5">
                      <Label htmlFor="priority-mode" className="text-base font-bold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>VIP Priority Pass</Label>
                      <p className="text-xs text-[#49607e] font-medium">Bypass the current queue (+₹150 fee)</p>
                    </div>
                    <Switch 
                      id="priority-mode" 
                      checked={isPriorityToggle} 
                      onCheckedChange={setIsPriorityToggle}
                      className="data-[state=checked]:bg-[#493ee5]"
                    />
                  </div>
                  <Button type="submit" size="lg" className="kinetic-btn-primary w-full h-14 text-base">
                    {isPriorityToggle ? <Zap className="w-5 h-5 mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
                    {isPriorityToggle ? `Join VIP: ${joinQueueKey}` : `Join Queue: ${joinQueueKey}`}
                  </Button>
               </form>
             )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Feedback Modal ── */}
      <Dialog open={isFeedbackModalOpen} onOpenChange={setIsFeedbackModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-8 bg-white border-none shadow-ambient">
          <DialogHeader className="space-y-5">
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto relative group">
               <CheckCircle2 className="w-8 h-8 text-green-600 relative z-10 group-hover:scale-110 transition-transform" />
               <div className="absolute inset-0 bg-green-200 rounded-2xl animate-ping opacity-20" />
            </div>
            <DialogTitle className="text-2xl font-extrabold text-[#181c1e] text-center tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Session Complete</DialogTitle>
            <DialogDescription className="text-center text-[#49607e] text-sm font-medium pb-5 border-b border-[#e5e8eb]">
              Your service node has closed. How was the experience?
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-center gap-3 py-5">
            {[1,2,3,4,5].map(star => (
               <StarIcon 
                 key={star} 
                 onClick={() => setFeedbackRating(star)}
                 className={cn("w-10 h-10 cursor-pointer transition-all hover:scale-125", feedbackRating >= star ? "text-amber-400 fill-amber-400 drop-shadow-lg" : "text-[#e5e8eb] hover:text-[#d7dadd]")} 
               />
            ))}
          </div>

          <div className="space-y-2">
             <Label htmlFor="feedback-comment" className="text-xs font-bold text-[#49607e] uppercase tracking-[0.15em]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Comments</Label>
             <Textarea 
               id="feedback-comment"
               value={feedbackComment}
               onChange={(e) => setFeedbackComment(e.target.value)}
               placeholder="How was the service quality today?"
               className="resize-none h-28 rounded-2xl bg-[#f1f4f7] border-none focus-visible:ring-[#493ee5] text-sm p-4"
             />
          </div>

          <DialogFooter className="mt-6 flex-col sm:flex-col gap-2">
            <Button 
              onClick={() => {
                if(feedbackRating === 0) return toast.error("Please provide a rating");
                setIsFeedbackModalOpen(false);
                toast.success("Feedback Received", { description: "Thank you for the pulse." });
              }} 
              className="kinetic-btn-primary w-full h-12 text-base"
            >
              Submit Feedback
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setIsFeedbackModalOpen(false)}
              className="w-full h-10 rounded-xl text-[#49607e] hover:bg-[#f1f4f7] font-bold text-sm"
              style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
            >
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Digital Pass Modal ── */}
      <Dialog open={isTicketModalOpen} onOpenChange={setIsTicketModalOpen}>
        <DialogContent className="max-w-[360px] p-0 overflow-hidden rounded-[32px] !border-0 !ring-0 !outline-none shadow-[0_32px_128px_-16px_rgba(73,62,229,0.15)] bg-white h-auto">
           {/* Silent Accessibility Helpers */}
           <DialogTitle className="sr-only">Lineo Digital Entry Pass</DialogTitle>
           <DialogDescription className="sr-only">Verified token for your current queue position and estimated wait time.</DialogDescription>

           <div className="p-6 bg-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#493ee5]/10 -mr-16 -mt-16 rounded-full blur-[60px]" />
              <div className="relative z-10">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#493ee5] mb-1" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Vector ID: {activeToken?.token_number}</p>
                <div className="flex items-center justify-between">
                   <h2 className="text-xl font-black tracking-tight text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Lineo Pass</h2>
                   <div className="bg-[#493ee5] text-white px-3 py-1 rounded-full text-[8px] font-black tracking-widest shadow-lg" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>ACTIVE</div>
                </div>
                <DialogDescription className="sr-only">Digital entry pass for Lineo queue system</DialogDescription>
              </div>
           </div>

           <div className="p-6 space-y-6 bg-white">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-[#493ee5]/5 flex items-center justify-center text-[#493ee5]">
                    <QrCode className="w-5 h-5" />
                 </div>
                 <div>
                    <p className="text-[9px] font-black text-[#49607e] uppercase tracking-[0.1em]">Access Node</p>
                    <h3 className="text-sm font-black text-[#181c1e] tracking-tight truncate max-w-[180px]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{activeToken?.queue_key}</h3>
                 </div>
              </div>

              <div className="bg-[#f8fafc] p-6 rounded-[24px] flex flex-col items-center justify-center relative group border border-[#f1f4f7]/50 shadow-inner">
                 <div className="bg-white p-4 rounded-[18px] shadow-sm relative overflow-hidden border border-[#493ee5]/5">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${activeToken?.token_number}-${activeToken?.queue_key}`} 
                      alt="QR Pass"
                      className="w-28 h-28 relative z-0"
                    />
                 </div>
                 <p className="mt-4 text-4xl font-black tracking-tighter text-[#493ee5] tabular-nums" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{activeToken?.token_number}</p>
                 <p className="text-[8px] font-black text-[#49607e] uppercase tracking-[0.3em] mt-1 opacity-40">Verified Entry</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                 <div className="space-y-0.5">
                    <p className="text-[9px] font-black text-[#49607e] uppercase tracking-[0.1em]">Queue Pos</p>
                    <div className="text-xl font-black text-[#181c1e]">#{activeToken?.position}</div>
                 </div>
                 <div className="space-y-0.5 text-right">
                    <p className="text-[9px] font-black text-[#49607e] uppercase tracking-[0.1em]">Wait Time</p>
                    <div className="text-xl font-black text-[#493ee5]">{activeToken?.estimated_wait_mins}m</div>
                 </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                  <Button onClick={fetchQueueMatrix} variant="outline" className="flex-1 h-14 font-black rounded-2xl border-[#e5e8eb] text-[#49607e] hover:bg-[#f1f4f7] transition-all">
                    <Users className="w-4 h-4 mr-2" /> Live Queue
                  </Button>
                  <Button onClick={() => setIsTicketModalOpen(false)} className="kinetic-btn-primary flex-1 h-14 text-base font-black rounded-2xl shadow-xl active:scale-95 transition-all">Dismiss Pass</Button>
               </div>
           </div>
        </DialogContent>
      </Dialog>

      <QueueMatrixModal 
        isOpen={isQueueMatrixModalOpen}
        onOpenChange={setIsQueueMatrixModalOpen}
        data={queueMatrix}
        isLoading={isMatrixLoading}
        activeToken={activeToken}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Sub-Components
// ─────────────────────────────────────────────────────

function MapPulseIcon() {
  return (
    <div className="relative">
      <MapIcon className="w-10 h-10 text-[#493ee5] opacity-30" />
      <motion.div 
        animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute inset-0 bg-[#493ee5]/15 rounded-full blur-xl"
      />
    </div>
  );
}

function StatCard({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: string; unit?: string }) {
  return (
    <div className="stat-card">
      <span className="text-[#49607e] font-medium text-sm mb-4 flex items-center gap-2">
        {icon} {label}
      </span>
      <div className="text-4xl font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
        {value}
        {unit && <span className="text-xl text-[#49607e] font-medium">{unit}</span>}
      </div>
    </div>
  );
}

// ── Queue Matrix Modal ──
function QueueMatrixModal({ isOpen, onOpenChange, data, isLoading, activeToken }: any) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px] p-0 overflow-hidden rounded-[32px] !border-0 !ring-0 !outline-none shadow-2xl bg-white">
          <div className="p-6 bg-[#181c1e] text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#493ee5]/20 -mr-16 -mt-16 rounded-full blur-[60px]" />
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-black tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Queue Matrix</h2>
                  <div className="bg-white/10 px-3 py-1 rounded-full text-[8px] font-black tracking-widest text-[#493ee5] border border-white/5">REAL-TIME</div>
                </div>
                <div className="flex items-center gap-2 text-white/60 text-[10px] font-bold uppercase tracking-widest">
                  <Activity className="w-3.5 h-3.5 text-[#493ee5]" />
                  <span>Unit: {activeToken?.queue_key}</span>
                </div>
            </div>
          </div>

          <div className="p-6 bg-white min-h-[420px]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-[300px] space-y-4">
                  <Loader2 className="w-10 h-10 animate-spin text-[#493ee5]" />
                  <p className="text-[10px] font-black text-[#49607e] uppercase tracking-widest">Scanning Nodes...</p>
              </div>
            ) : (
              <div className="space-y-5">
                  <div className="bg-[#f8fafc] p-5 rounded-[24px] border border-[#f1f4f7] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                       <Zap className="w-12 h-12" />
                    </div>
                    <p className="text-[10px] font-black text-[#49607e] uppercase tracking-widest mb-4">Currently Serving</p>
                    {data?.currently_serving ? (
                      <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#493ee5] rounded-2xl flex items-center justify-center text-white shadow-neobrutal transition-transform group-hover:scale-110">
                                <Zap className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-base font-black text-[#181c1e] tracking-tight">
                                   {data.currently_serving.username?.split(' ')[0]} {data.currently_serving.username?.split(' ')[1] ? data.currently_serving.username?.split(' ')[1][0] + "." : ""}
                                </p>
                            </div>
                          </div>
                          {data.currently_serving.has_disability && (
                            <div className="bg-emerald-500/10 p-3 rounded-xl text-emerald-500 animate-pulse border border-emerald-500/20 shadow-emerald-500/5">
                              <HeartPulse className="w-5 h-5" />
                            </div>
                          )}
                      </div>
                    ) : (
                      <p className="text-sm font-bold text-[#49607e]/50 italic py-2">Node currently idle</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mb-1">
                     <p className="text-[10px] font-black text-[#49607e] uppercase tracking-widest">Waiting List</p>
                     <div className="h-px flex-1 bg-[#f1f4f7]" />
                  </div>
                  
                  <ScrollArea className="h-[320px] -mr-4 pr-4">
                    <div className="space-y-3 pb-4">
                        {data?.waiting_list?.length > 0 ? (
                           data.waiting_list.map((entry: any, i: number) => (
                             <motion.div 
                               initial={{ opacity: 0, y: 5 }}
                               animate={{ opacity: 1, y: 0 }}
                               key={entry.token_number} 
                               className={cn(
                                 "p-4 rounded-2xl flex items-center justify-between transition-all border",
                                 entry.token_number === activeToken?.token_number 
                                   ? "bg-[#493ee5]/5 border-[#493ee5]/20 ring-1 ring-[#493ee5] shadow-sm" 
                                   : "bg-[#f1f4f7] border-transparent hover:bg-white hover:border-[#493ee5]/10 hover:shadow-sm"
                               )}
                             >
                                <div className="flex items-center gap-4">
                                   <div className={cn(
                                     "w-10 h-10 rounded-xl flex items-center justify-center text-[12px] font-black shadow-sm transition-all",
                                     entry.token_number === activeToken?.token_number ? "bg-[#493ee5] text-white scale-110" : "bg-white text-[#49607e]"
                                   )}>
                                      {i + 1}
                                   </div>
                                   <div>
                                      <div className="flex items-center gap-2">
                                          <span className="text-sm font-black text-[#181c1e] tracking-tight">{entry.username?.split(' ')[0]} {entry.username?.split(' ')[1] ? entry.username?.split(' ')[1][0] + "." : ""}</span>
                                          {entry.token_number === activeToken?.token_number && (
                                            <Badge className="bg-[#493ee5] text-[8px] h-4 px-1.5 font-black border-none shadow-sm">YOU</Badge>
                                          )}
                                      </div>
                                   </div>
                                </div>
                                {entry.has_disability && (
                                  <div className="flex flex-col items-end">
                                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shadow-sm animate-in fade-in zoom-in duration-500">
                                        <HeartPulse className="w-3.5 h-3.5" />
                                        <span className="text-[9px] font-black uppercase tracking-tighter">Care Required</span>
                                      </div>
                                  </div>
                                )}
                             </motion.div>
                           ))
                        ) : (
                           <div className="text-center py-20 opacity-30">
                              <Users className="w-12 h-12 mx-auto mb-3" />
                              <p className="text-[11px] font-black uppercase tracking-widest">No Waiting Nodes</p>
                           </div>
                        )}
                    </div>
                  </ScrollArea>
              </div>
            )}
          </div>
      </DialogContent>
    </Dialog>
  );
}
