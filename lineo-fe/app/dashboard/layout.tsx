"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Calendar, 
  History as HistoryIcon, 
  Settings, 
  LogOut, 
  Search,
  User,
  ChevronLeft,
  ChevronRight,
  Map as MapIcon,
  BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";
import { motion } from "framer-motion";
import { LocationProvider, useLocation } from "@/context/LocationContext";
import { SocketProvider } from "@/context/SocketContext";
import { NotificationCenter } from "@/components/NotificationCenter";

interface UserData {
  username: string;
  email?: string;
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
    
    // Using microtask to avoid "synchronous setState in effect" lint error
    // and prevent immediate cascading renders in the same tick.
    void Promise.resolve().then(() => {
      setUser(parsedUser);
      setMounted(true);
    });
  }, []);

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
        <NotificationCenter />
        <div className="h-6 w-px bg-[#e5e8eb]" />
        <div className="flex items-center gap-4">
          <div className="text-right hidden xl:block">
            <p className="text-sm font-bold text-[#181c1e] leading-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{user?.username || "Quest"}</p>
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { name: "Live Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Discovery & Maps", href: "/dashboard/discovery", icon: MapIcon },
    { name: "My Appointments", href: "/dashboard/appointments", icon: Calendar },
    { name: "Queue History", href: "/dashboard/history", icon: HistoryIcon },
    { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    window.location.href = "/login";
  };

  return (
    <LocationProvider>
      <SocketProvider>
        <div className="min-h-screen bg-[#f7fafd] flex transition-all duration-300 font-sans selection:bg-[#493ee5]/10 selection:text-[#493ee5]">
          <Toaster position="top-right" expand={true} richColors closeButton />
          
          {/* ━━━ Sidebar ━━━ */}
          <aside className={cn(
            "bg-white hidden md:flex flex-col sticky top-0 h-screen transition-all duration-300 z-40 ghost-border border-t-0 border-b-0 border-l-0",
            isCollapsed ? "w-[72px]" : "w-[260px]"
          )}>
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
            <nav className="flex-1 p-3 space-y-1 mt-2 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative text-sm",
                      isActive
                        ? "text-white font-bold shadow-neobrutal"
                        : "text-[#49607e] hover:bg-[#f1f4f7] hover:text-[#493ee5] font-medium"
                    )}
                    style={isActive ? { background: 'linear-gradient(135deg, #493ee5, #635bff)', fontFamily: 'var(--font-manrope), sans-serif' } : { fontFamily: 'var(--font-manrope), sans-serif' }}
                  >
                    <item.icon className={cn(
                      "w-[18px] h-[18px] transition-transform duration-200 shrink-0",
                      isActive ? "text-white" : "text-[#49607e] group-hover:text-[#493ee5] group-hover:scale-110"
                    )} />
                    {!isCollapsed && <span>{item.name}</span>}
                  </Link>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="p-3 space-y-1 border-t border-[#e5e8eb] bg-[#f7fafd]/50">
              <button
                 onClick={() => setIsCollapsed(!isCollapsed)}
                 className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-[#49607e] hover:bg-[#f1f4f7] hover:text-[#181c1e] transition-all duration-200 group text-sm font-medium"
                 style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
              >
                 <div className="shrink-0">{isCollapsed ? <ChevronRight className="w-[18px] h-[18px]" /> : <ChevronLeft className="w-[18px] h-[18px]" />}</div>
                 {!isCollapsed && <span>Collapse</span>}
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-[#49607e] hover:bg-red-50 hover:text-red-600 transition-all duration-200 group text-sm font-medium"
                style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
              >
                <LogOut className="w-[18px] h-[18px] shrink-0" />
                {!isCollapsed && <span>Sign out</span>}
              </button>
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
