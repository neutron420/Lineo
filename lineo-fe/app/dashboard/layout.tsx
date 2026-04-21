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
import { LocationProvider, useLocation } from "@/context/LocationContext";
import { SocketProvider, useSocket } from "@/context/SocketContext";
import { NotificationCenter } from "@/components/NotificationCenter";
import api from "@/lib/api";

interface UserData {
  username: string;
  email?: string;
  subscription_tier?: string;
  daily_joins?: number;
  daily_appts?: number;
}

interface SocketQueueData {
  event?: { token_number: string; action?: string };
  state?: {
    waiting_list: { token_number: string; username: string; has_disability: boolean }[];
    currently_serving: { token_number: string; username: string; has_disability: boolean } | null;
  };
}

function GlobalHeader() {
  const { address, pincode, refreshLocation } = useLocation();
  const [user, setUser] = useState<UserData | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const userData = sessionStorage.getItem("user");
    let parsedUser = null;
    if (userData) {
      try {
        parsedUser = JSON.parse(userData);
      } catch (e) {
        console.error("Failed to parse user data", e);
      }
    }
    
    void Promise.resolve().then(() => {
      setUser(parsedUser);
      setMounted(true);
    });
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
    <header className="h-20 bg-white/80 backdrop-blur-xl sticky top-0 z-30 flex items-center justify-between px-8 ghost-border border-t-0 border-x-0">
      <div className="flex items-center flex-1 max-w-2xl gap-6">
        {/* Search Bar */}
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#49607e] group-focus-within:text-[#493ee5] transition-colors" />
          <input
            type="text"
            placeholder="Search organizations, queues, or banks..."
            className="w-full pl-11 pr-6 py-3 bg-[#f1f4f7] border border-transparent focus:bg-white focus:border-[#493ee5]/15 focus:ring-2 focus:ring-[#493ee5]/5 rounded-xl text-sm transition-all outline-none font-medium text-[#181c1e] placeholder:text-[#49607e]/60"
          />
        </div>
        
        {/* Location Badge */}
        <div 
          onClick={refreshLocation}
          className="flex items-center gap-2.5 px-4 py-2.5 bg-[#493ee5]/5 rounded-xl cursor-pointer hover:bg-[#493ee5]/10 transition-all group shrink-0"
        >
           <div className="relative">
              <MapIcon className="w-4 h-4 text-[#493ee5]" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border-2 border-white animate-pulse" />
           </div>
           <div className="flex flex-col">
              <span className="text-[10px] font-extrabold text-[#493ee5] uppercase tracking-[0.08em] leading-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{address || "Locating..."}</span>
              <span className="text-[9px] font-bold text-[#49607e] uppercase tracking-widest">{pincode || "Detect"}</span>
           </div>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2.5 bg-[#f1f4f7] text-[#49607e] rounded-xl hover:bg-[#493ee5]/5 hover:text-[#493ee5] transition-all group"
          >
            <Share2 className="w-4 h-4" />
          </motion.button>
          
          <LiveQueuePopover />
          
          <NotificationCenter />
        </div>
        <div className="h-6 w-px bg-[#e5e8eb]" />
        
        {/* Logout Button */}
        <motion.button
          onClick={handleLogout}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all text-xs font-bold border border-red-100/50"
          style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </motion.button>

        <div className="flex items-center gap-4">
          <div className="text-right hidden xl:block">
            <p className="text-sm font-bold text-[#181c1e] leading-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{user?.username || "Authenticated User"}</p>
            <p className="text-[10px] text-[#493ee5] uppercase tracking-[0.12em] font-extrabold mt-0.5" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Verified Account</p>
          </div>
          <motion.div 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white cursor-pointer shadow-neobrutal"
            style={{ background: 'linear-gradient(135deg, #493ee5, #635bff)' }}
          >
            <User className="w-5 h-5" />
          </motion.div>
        </div>
      </div>
    </header>
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);
  const pathname = usePathname();

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
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <GlobalHeader />

            <main className="flex-1 p-6 lg:p-10 w-full animate-in fade-in slide-in-from-bottom-4 duration-700 overflow-y-auto">
              {children}
            </main>
          </div>
        </div>
      </SocketProvider>
    </LocationProvider>
  );
}
