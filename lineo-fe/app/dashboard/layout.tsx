"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Zap,
  Activity,
  HeartPulse,
  Clock,
  Users,
  Loader2,
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  HistoryIcon,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MapIcon,
  Search,
  Settings,
  Share2,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Toaster, toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff } from "lucide-react";
import { LocationProvider, useLocation } from "@/context/LocationContext";
import { SocketProvider, useSocket } from "@/context/SocketContext";
import { NotificationCenter } from "@/components/NotificationCenter";
import { initPushNotifications } from "@/lib/push";
import api from "@/lib/api";
import { CitySelection } from "@/components/CitySelection";
import { FeedbackModal } from "@/components/FeedbackModal";
import { WelcomeOnboarding } from "@/components/WelcomeOnboarding";
import { MessageSquare } from "lucide-react";

interface UserData {
  username: string;
  email?: string;
  subscription_tier?: string;
  daily_joins?: number;
  daily_appts?: number;
  avatar_url?: string;
}

interface SocketQueueData {
  event?: { token_number: string; action?: string };
  state?: {
    waiting_list: { token_number: string; username: string; has_disability: boolean }[];
    currently_serving: { token_number: string; username: string; has_disability: boolean } | null;
  };
}

function GlobalHeader() {
  const { address, city, setCity, refreshLocation } = useLocation();
  const [user, setUser] = useState<UserData | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    setIsOnline(navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const loadUser = () => {
      const userData = sessionStorage.getItem("user");
      if (userData) {
        try {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
        } catch (e) {
          console.error("Failed to parse user data", e);
        }
      }
      setMounted(true);
    };

    loadUser();
    
    // Listen for storage changes in the same window
    window.addEventListener("user-updated", loadUser);
    return () => window.removeEventListener("user-updated", loadUser);
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    window.location.href = "/user/login";
  };

  if (!mounted) return (
    <header className="h-20 bg-white/80 backdrop-blur-xl sticky top-0 z-30 flex items-center justify-between px-8 opacity-0" />
  );

  return (
    <>
      <AnimatePresence>
        {!isOnline && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-red-600 text-white text-[10px] font-black uppercase tracking-[0.2em] py-2 text-center flex items-center justify-center gap-2 sticky top-0 z-[100]"
          >
            <WifiOff className="w-3 h-3" />
            You are currently offline. Some features may be limited.
          </motion.div>
        )}
      </AnimatePresence>
      <header className="h-16 md:h-20 bg-white/80 backdrop-blur-xl sticky top-0 z-30 flex items-center justify-between px-4 md:px-8 ghost-border border-t-0 border-x-0">
      <div className="flex items-center flex-1 max-w-2xl gap-4 md:gap-6">
        {/* Logo on mobile only */}
        <div className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center shadow-neobrutal shrink-0" style={{ background: 'linear-gradient(135deg, #493ee5, #635bff)' }}>
          <span className="text-white font-extrabold text-sm" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>L</span>
        </div>
        {/* Search Bar */}
        <div className="relative flex-1 group hidden sm:block">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#49607e] group-focus-within:text-[#493ee5] transition-colors" />
          <input
            type="text"
            placeholder="Search organizations, queues, or banks..."
            className="w-full pl-11 pr-6 py-3 bg-[#f1f4f7] border border-transparent focus:bg-white focus:border-[#493ee5]/15 focus:ring-2 focus:ring-[#493ee5]/5 rounded-xl text-sm transition-all outline-none font-medium text-[#181c1e] placeholder:text-[#49607e]/60"
          />
        </div>
        
        {/* Location Badge - compact on mobile */}
        <div 
          onClick={() => setCity("")} // Reset city to trigger modal
          className="hidden sm:flex items-center gap-2.5 px-4 py-2.5 bg-[#493ee5]/5 rounded-xl cursor-pointer hover:bg-[#493ee5]/10 transition-all group shrink-0"
        >
           <div className="relative">
              <MapIcon className="w-4 h-4 text-[#493ee5]" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border-2 border-white animate-pulse" />
           </div>
           <div className="flex flex-col">
              <span className="text-[10px] font-extrabold text-[#493ee5] uppercase tracking-[0.08em] leading-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{city || "Select City"}</span>
              <span className="text-[9px] font-bold text-[#49607e] uppercase tracking-widest truncate max-w-[100px]">{address || "Locating..."}</span>
           </div>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-5">
        <div className="flex items-center gap-2 md:gap-3">
          {/* Mobile search button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="sm:hidden p-2.5 bg-[#f1f4f7] text-[#49607e] rounded-xl hover:bg-[#493ee5]/5 hover:text-[#493ee5] transition-all"
          >
            <Search className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="hidden sm:flex p-2.5 bg-[#f1f4f7] text-[#49607e] rounded-xl hover:bg-[#493ee5]/5 hover:text-[#493ee5] transition-all group"
          >
            <Share2 className="w-4 h-4" />
          </motion.button>
          
          <LiveQueuePopover />
          
          <NotificationCenter />
        </div>
        {/* Profile Dropdown */}
        <ProfileDropdown user={user} onLogout={handleLogout} />
      </div>
    </header>
    </>
  );
}

function LiveQueuePopover() {
  const { subscribe, unsubscribe } = useSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [activeToken, setActiveToken] = useState<any>(null);
  const [queueMatrix, setQueueMatrix] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchActive = async () => {
      try {
        const resp = await api.get("/queue/active");
        if (resp.data.data) {
          setActiveToken(resp.data.data);
          // Initial fetch of matrix
          const matrixResp = await api.get(`/queue/${resp.data.data.queue_key}/state`);
          setQueueMatrix(matrixResp.data.data);
        }
      } catch (err) {
        console.error("Layout Active Token Fetch Error", err);
      }
    };
    fetchActive();
    
    // Listen for queue join events globally if needed, or just poll occasionally
    const interval = setInterval(fetchActive, 30000); // 30s fallback
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeToken?.organization_id) {
      subscribe(activeToken.organization_id, (data: any) => {
        if (data.state) {
          setQueueMatrix(data.state);
        }
        if (data.event?.action === "ticket_completed" && data.event?.token_number === activeToken.token_number) {
            setActiveToken(null);
            setQueueMatrix(null);
        }
      });
      return () => unsubscribe(activeToken.organization_id);
    }
  }, [activeToken, subscribe, unsubscribe]);

  if (!activeToken) return null;

  return (
    <div className="relative">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-bold text-xs shadow-sm border",
          isOpen ? "bg-[#493ee5] text-white border-transparent shadow-neobrutal" : "bg-white text-[#493ee5] border-[#493ee5]/10"
        )}
      >
        <div className="relative">
           <Zap className={cn("w-3.5 h-3.5", isOpen ? "text-white" : "text-[#493ee5]")} />
           <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-sm" />
        </div>
        <span>Live Queue</span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-3 w-80 bg-white rounded-[24px] shadow-2xl border border-[#e5e8eb] z-50 overflow-hidden"
            >
              <div className="p-5 bg-[#181c1e] text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#493ee5]/10 -mr-16 -mt-16 rounded-full blur-[40px]" />
                <div className="flex items-center justify-between mb-3 relative z-10">
                  <p className="text-[10px] font-black tracking-[0.2em] text-[#493ee5] uppercase">Live Matrix</p>
                  <Activity className="w-3.5 h-3.5 text-[#493ee5] animate-pulse" />
                </div>
                <h3 className="font-extrabold text-sm tracking-tight relative z-10">Node: {activeToken.queue_key}</h3>
              </div>

              <div className="p-4 max-h-[360px] overflow-y-auto">
                {queueMatrix?.waiting_list ? (
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-[#49607e] uppercase tracking-widest mb-3">Waiting Participants</p>
                    {queueMatrix.waiting_list.map((entry: any, i: number) => (
                      <div 
                        key={entry.token_number}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-xl transition-all",
                          entry.token_number === activeToken.token_number ? "bg-[#493ee5]/5 border border-[#493ee5]/10" : "bg-[#f1f4f7]/50"
                        )}
                      >
                         <div className="flex items-center gap-3">
                            <span className={cn(
                              "w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center",
                              entry.token_number === activeToken.token_number ? "bg-[#493ee5] text-white" : "bg-white text-[#49607e] border border-[#e5e8eb]"
                            )}>{i + 1}</span>
                            <span className="text-xs font-bold text-[#181c1e]">
                               {entry.username?.split(' ')[0]} {entry.username?.split(' ')[1] ? entry.username?.split(' ')[1][0] + "." : ""}
                            </span>
                         </div>
                         {entry.has_disability && <HeartPulse className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />}
                         {entry.token_number === activeToken.token_number && <span className="text-[8px] font-black text-[#493ee5] uppercase bg-[#493ee5]/10 px-1.5 py-0.5 rounded-full">YOU</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-10 text-center opacity-30">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-[#493ee5]" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Connecting Pulse...</p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-[#f8fafc] border-t border-[#e5e8eb] flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[#493ee5]" />
                    <span className="text-[10px] font-bold text-[#49607e] uppercase tracking-tight">Wait: {activeToken.estimated_wait_mins}m</span>
                 </div>
                 <Link href="/dashboard" onClick={() => setIsOpen(false)} className="text-[10px] font-black text-[#493ee5] uppercase hover:underline">Full Dashboard</Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Profile Dropdown Component  
// ─────────────────────────────────────────────────────
function ProfileDropdown({ user, onLogout }: { user: UserData | null, onLogout: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const tierLimits: Record<string, { joins: number, appts: number, label: string }> = {
    basic: { joins: 3, appts: 2, label: "Basic" },
    starter: { joins: 3, appts: 2, label: "Basic" },
    plus: { joins: 15, appts: 10, label: "Plus" },
    unlimited: { joins: 999, appts: 999, label: "Unlimited" },
  };
  
  const tier = tierLimits[user?.subscription_tier || "basic"] || tierLimits.basic;
  const usedJoins = user?.daily_joins || 0;
  const usedAppts = user?.daily_appts || 0;
  const joinsPercent = tier.joins === 999 ? 5 : Math.min((usedJoins / tier.joins) * 100, 100);
  const apptsPercent = tier.appts === 999 ? 5 : Math.min((usedAppts / tier.appts) * 100, 100);

  return (
    <div className="relative">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center text-white cursor-pointer transition-shadow overflow-hidden",
          isOpen ? "shadow-lg ring-2 ring-[#493ee5]/30" : "shadow-neobrutal"
        )}
        style={{ background: 'linear-gradient(135deg, #493ee5, #635bff)' }}
      >
        {user?.avatar_url ? (
          <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
        ) : (
          <User className="w-4 h-4 md:w-5 md:h-5" />
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute right-0 mt-2.5 w-[280px] md:w-[300px] bg-white rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.12)] border border-[#e5e8eb]/80 z-50 overflow-hidden"
            >
              {/* ── Profile Header ── */}
              <div className="p-4 border-b border-[#e5e8eb]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-extrabold shrink-0 overflow-hidden" style={{ background: 'linear-gradient(135deg, #493ee5, #635bff)', fontFamily: 'var(--font-manrope), sans-serif' }}>
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      user?.username?.charAt(0).toUpperCase() || "U"
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[13px] text-[#181c1e] truncate" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{user?.username || "User"}</p>
                    <p className="text-[11px] text-[#49607e] truncate">{user?.email || "user@lineo.ai"}</p>
                  </div>
                </div>
              </div>

              {/* ── Subscription & Limits ── */}
              <div className="p-3.5 bg-[#f8fafc] border-b border-[#e5e8eb]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-extrabold text-[#49607e] uppercase tracking-[0.12em]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Plan & Limits</span>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#493ee5]/10 text-[#493ee5] border border-[#493ee5]/10" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{tier.label}</span>
                </div>
                
                {/* Quota Bars */}
                <div className="space-y-2.5">
                  <div>
                    <div className="flex justify-between text-[10px] font-semibold text-[#49607e] mb-1">
                      <span>Joins</span>
                      <span className={cn("font-bold", joinsPercent >= 100 ? "text-amber-600" : "text-[#181c1e]")}>{usedJoins}/{tier.joins === 999 ? "∞" : tier.joins}</span>
                    </div>
                    <div className="w-full bg-[#e5e8eb] rounded-full h-1.5 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${joinsPercent}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className={cn("h-full rounded-full", joinsPercent >= 100 ? "bg-amber-500" : "bg-[#493ee5]")} 
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-semibold text-[#49607e] mb-1">
                      <span>Appointments</span>
                      <span className={cn("font-bold", apptsPercent >= 100 ? "text-amber-600" : "text-[#181c1e]")}>{usedAppts}/{tier.appts === 999 ? "∞" : tier.appts}</span>
                    </div>
                    <div className="w-full bg-[#e5e8eb] rounded-full h-1.5 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${apptsPercent}%` }}
                        transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
                        className={cn("h-full rounded-full", apptsPercent >= 100 ? "bg-amber-500" : "bg-[#635bff]")} 
                      />
                    </div>
                  </div>
                </div>

                <Link 
                  href="/dashboard/settings/billing"
                  onClick={() => setIsOpen(false)}
                  className="mt-3 flex items-center justify-center gap-1.5 w-full py-2 bg-[#493ee5] text-white rounded-lg text-[11px] font-bold hover:bg-[#3d33c4] transition-all"
                  style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
                >
                  <Zap className="w-3 h-3" />
                  {tier.label === "Unlimited" ? "Manage Subscription" : "Upgrade Plan"}
                </Link>
              </div>

              {/* ── Menu Items ── */}
              <div className="p-1.5">
                <Link href="/dashboard/settings" onClick={() => setIsOpen(false)} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#f1f4f7] transition-colors text-[13px] font-medium text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                  <Settings className="w-4 h-4 text-[#49607e]" /> Settings
                </Link>
                <Link href="/dashboard/analytics" onClick={() => setIsOpen(false)} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#f1f4f7] transition-colors text-[13px] font-medium text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                  <BarChart3 className="w-4 h-4 text-[#49607e]" /> Analytics
                </Link>
                <Link href="/dashboard/settings/billing" onClick={() => setIsOpen(false)} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#f1f4f7] transition-colors text-[13px] font-medium text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                  <CreditCard className="w-4 h-4 text-[#49607e]" /> Billing
                </Link>
                <div className="h-px bg-[#e5e8eb] mx-2 my-1" />
                <button onClick={() => { setIsOpen(false); onLogout(); }} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors text-[13px] font-medium text-red-500 w-full text-left" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);
  const pathname = usePathname();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  useEffect(() => {
    const userData = sessionStorage.getItem("user");
    if (!userData) {
      window.location.href = "/user/login";
      return;
    }
    try {
      setUser(JSON.parse(userData));
    } catch (e) {
      console.error("Layout user parse error", e);
    }

    // Fresh fetch from backend to sync daily limits/counters
    const syncProfile = async () => {
      try {
        const resp = await api.get("/user/me");
        const freshUser = resp.data.data;
        if (freshUser) {
          setUser(freshUser);
          sessionStorage.setItem("user", JSON.stringify(freshUser));
        }
      } catch (err) {
        console.error("Failed to sync user profile", err);
      }
    };
    syncProfile();

    window.addEventListener("userSync", syncProfile);

    // Midnight Watcher: Auto-reset frontend limits if date changes while app is open
    let lastDate = new Date().getDate();
    const midnightCheck = setInterval(() => {
      const current = new Date().getDate();
      if (current !== lastDate) {
        lastDate = current;
        syncProfile(); // Fetch fresh limits!
      }
    }, 60000); // check every minute

    return () => {
      window.removeEventListener("userSync", syncProfile);
      clearInterval(midnightCheck);
    };

    // Register push notifications for returning sessions (idempotent)
    initPushNotifications().catch(() => {});
  }, []);

  const mainNavItems = [
    { name: "Live Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Discovery & Maps", href: "/dashboard/discovery", icon: MapIcon },
    { name: "My Appointments", href: "/dashboard/appointments", icon: Calendar, badge: 2 },
    { name: "Queue History", href: "/dashboard/history", icon: HistoryIcon },
    { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  ];

  const footerNavItems = [
    { name: "My Subscription", href: "/dashboard/settings/billing", icon: Zap },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
    { name: "Support", href: "/dashboard/support", icon: LifeBuoy, status: "Online" },
  ];


  return (
    <LocationProvider>
      <SocketProvider>
        <div className="h-screen bg-[#f7fafd] flex transition-all duration-300 font-sans selection:bg-[#493ee5]/10 selection:text-[#493ee5] overflow-hidden">
          <Toaster position="top-right" expand={true} richColors closeButton />
          
          {/* ━━━ Sidebar ━━━ */}
          <aside className={cn(
            "bg-white hidden md:flex flex-col sticky top-0 h-screen transition-all duration-300 z-40 ghost-border border-t-0 border-b-0 border-l-0 relative",
            isCollapsed ? "w-[72px]" : "w-[260px]"
          )}>
            {/* Floating Collapse Toggle */}
            <button
               onClick={() => setIsCollapsed(!isCollapsed)}
               className="absolute -right-3 top-7 w-6 h-6 bg-white border border-[#e5e8eb] rounded-full flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:border-[#493ee5]/30 hover:text-[#493ee5] transition-all z-50 group"
            >
               {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:scale-110" /> : <ChevronLeft className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />}
            </button>
            {/* Logo */}
            <div className={cn(
              "p-5 flex items-center gap-3 transition-all border-b border-[#e5e8eb]",
              isCollapsed ? "justify-center px-3" : "justify-start"
            )}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-neobrutal shrink-0" style={{ background: 'linear-gradient(135deg, #493ee5, #635bff)' }}>
                <span className="text-white font-extrabold text-lg" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>L</span>
              </div>
              {!isCollapsed && (
                <div>
                  <span className="text-xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Lineo<span className="text-[#493ee5]">.ai</span></span>
                </div>
              )}
            </div>

            {/* Nav Items */}
            <nav className="flex-1 p-3 space-y-1 mt-2 overflow-y-auto flex flex-col">
              {mainNavItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group relative text-sm",
                      isActive
                        ? "text-white font-bold shadow-neobrutal"
                        : "text-[#49607e] hover:bg-[#f1f4f7] hover:text-[#493ee5] font-medium"
                    )}
                    style={isActive ? { background: 'linear-gradient(135deg, #493ee5, #635bff)', fontFamily: 'var(--font-manrope), sans-serif' } : { fontFamily: 'var(--font-manrope), sans-serif' }}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={cn(
                        "w-[18px] h-[18px] transition-transform duration-200 shrink-0",
                        isActive ? "text-white" : "text-[#49607e] group-hover:text-[#493ee5] flex-shrink-0"
                      )} />
                      {!isCollapsed && <span>{item.name}</span>}
                    </div>
                    {!isCollapsed && item.badge && (
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-bold",
                        isActive ? "bg-white/20 text-white" : "bg-[#f1f4f7] text-[#49607e] group-hover:text-[#493ee5] group-hover:bg-[#493ee5]/10"
                      )}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}

            </nav>

            {/* Footer */}
            <div className="p-3 space-y-1 border-t border-[#e5e8eb] bg-white">
              {footerNavItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group relative text-sm",
                      isActive
                        ? "text-white font-bold shadow-neobrutal"
                        : "text-[#49607e] hover:bg-[#f1f4f7] hover:text-[#493ee5] font-medium"
                    )}
                    style={isActive ? { background: 'linear-gradient(135deg, #493ee5, #635bff)', fontFamily: 'var(--font-manrope), sans-serif' } : { fontFamily: 'var(--font-manrope), sans-serif' }}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={cn(
                        "w-[18px] h-[18px] transition-transform duration-200 shrink-0",
                        isActive ? "text-white" : "text-[#49607e] group-hover:text-[#493ee5]"
                      )} />
                      {!isCollapsed && <span>{item.name}</span>}
                    </div>
                    {!isCollapsed && item.status && (
                       <div className="flex items-center gap-1.5 bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold border border-green-200">
                         <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                         {item.status}
                       </div>
                    )}
                  </Link>
                );
              })}

              <button
                onClick={() => setIsFeedbackOpen(true)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-[#49607e] hover:bg-amber-50 hover:text-amber-600 font-medium text-sm mt-1 w-full text-left",
                  isCollapsed && "justify-center px-0"
                )}
                style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
              >
                <MessageSquare className="w-[18px] h-[18px] shrink-0" />
                {!isCollapsed && <span>Report an Issue</span>}
              </button>

              {/* Subscription Usage Card */}
              {!isCollapsed && user && (
                <div className="mt-4 p-4 rounded-2xl bg-[#f7fafd] border border-[#e5e8eb] shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-[#493ee5]/5 to-transparent rounded-bl-full -mr-8 -mt-8" />
                  
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-[#181c1e] capitalize" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{user.subscription_tier || 'Basic'} Plan</h4>
                    <span className="text-[10px] font-black text-[#493ee5] uppercase tracking-wider">Quota</span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-[#49607e] mb-1 uppercase tracking-tight">
                        <span>Joins</span>
                        <span>{user.daily_joins || 0}/{user.subscription_tier === 'plus' ? '15' : user.subscription_tier === 'unlimited' ? '∞' : '3'}</span>
                      </div>
                      <div className="w-full bg-[#e5e8eb] rounded-full h-1 overflow-hidden">
                        <div 
                          className="bg-[#493ee5] h-full rounded-full transition-all duration-1000" 
                          style={{ width: `${Math.min(((user.daily_joins || 0) / (user.subscription_tier === 'plus' ? 15 : user.subscription_tier === 'unlimited' ? 100 : 3)) * 100, 100)}%` }} 
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-[#49607e] mb-1 uppercase tracking-tight">
                        <span>Appointments</span>
                        <span>{user.daily_appts || 0}/{user.subscription_tier === 'plus' ? '10' : user.subscription_tier === 'unlimited' ? '∞' : '2'}</span>
                      </div>
                      <div className="w-full bg-[#fce7f3] rounded-full h-1 overflow-hidden">
                        <div 
                          className="bg-pink-500 h-full rounded-full transition-all duration-1000" 
                          style={{ width: `${Math.min(((user.daily_appts || 0) / (user.subscription_tier === 'plus' ? 10 : user.subscription_tier === 'unlimited' ? 100 : 2)) * 100, 100)}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-4">
                    <Link 
                      href="/dashboard/settings/billing"
                      className="text-[11px] font-bold text-center text-white bg-[#181c1e] hover:bg-[#493ee5] transition-all py-2 px-3 rounded-lg w-full" 
                      style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
                    >
                      {user.subscription_tier === 'unlimited' ? 'Manage Billing' : 'Upgrade Limits'}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* ━━━ Main Content ━━━ */}
          <div className="flex-1 flex flex-col min-w-0">
            <GlobalHeader />

            <main className="flex-1 p-4 md:p-6 lg:p-10 pb-24 md:pb-6 lg:pb-10 w-full animate-in fade-in slide-in-from-bottom-4 duration-700 overflow-y-auto">
              {children}
            </main>
          </div>

          <CitySelection />

          {/* ━━━ Mobile Bottom Tab Bar ━━━ */}
          <MobileTabBar pathname={pathname} />
          
          <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
          <WelcomeOnboarding />
        </div>
      </SocketProvider>
    </LocationProvider>
  );
}

// ─────────────────────────────────────────────────────
// Mobile Bottom Tab Bar Component
// ─────────────────────────────────────────────────────
function MobileTabBar({ pathname }: { pathname: string }) {
  const tabs = [
    { name: "Home", href: "/dashboard", icon: LayoutDashboard },
    { name: "Discover", href: "/dashboard/discovery", icon: MapIcon },
    { name: "Bookings", href: "/dashboard/appointments", icon: Calendar },
    { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
    { name: "History", href: "/dashboard/history", icon: HistoryIcon },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-[#e5e8eb] safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || (tab.href !== "/dashboard" && pathname.startsWith(tab.href));
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 py-1 rounded-xl transition-all relative",
                isActive 
                  ? "text-[#493ee5]" 
                  : "text-[#49607e]/60 active:text-[#493ee5]"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-[#493ee5]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className={cn(
                "w-5 h-5 transition-transform",
                isActive && "scale-110"
              )} />
              <span className={cn(
                "text-[9px] font-bold tracking-wide",
                isActive ? "font-extrabold" : "font-medium"
              )} style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                {tab.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
