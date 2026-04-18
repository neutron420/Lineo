"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Building2, 
  Users, 
  BarChart3, 
  Settings, 
  LogOut, 
  Bell,
  Search,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";
import { SocketProvider } from "@/context/SocketContext";
import { motion } from "framer-motion";

function StaffHeader() {
  const [user] = useState<{ email?: string } | null>(() => {
    if (typeof window === "undefined") return null;
    const userStr = sessionStorage.getItem("staff_user");
    return userStr ? JSON.parse(userStr) : null;
  });

  return (
    <header className="h-20 bg-white/80 backdrop-blur-xl sticky top-0 z-30 flex items-center justify-between px-8 border-b border-[#e5e8eb]">
      <div className="flex items-center flex-1 max-w-2xl gap-6">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#49607e] group-focus-within:text-[#493ee5] transition-colors" />
          <input
            type="text"
            placeholder="Search active tokens or records..."
            className="w-full pl-11 pr-6 py-3 bg-[#f7fafd] border border-[#e5e8eb] focus:bg-white focus:border-[#493ee5] focus:ring-4 focus:ring-[#493ee5]/5 rounded-xl text-sm transition-all outline-none font-medium text-[#181c1e] placeholder:text-[#49607e]/60"
          />
        </div>
      </div>

      <div className="flex items-center gap-5">
        <button className="w-11 h-11 rounded-2xl bg-[#f7fafd] hover:bg-[#eef2f6] flex items-center justify-center transition-all text-[#49607e] border border-[#e5e8eb] relative group">
          <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
        </button>
        <div className="h-6 w-px bg-[#e5e8eb]" />
        <div className="flex items-center gap-4">
          <div className="text-right hidden xl:block">
            <p className="text-sm font-bold text-[#181c1e] tracking-tight leading-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{user?.email || "System Agent"}</p>
            <p className="text-[10px] text-[#493ee5] uppercase tracking-[0.15em] font-extrabold mt-0.5" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>OPERATIONS LEVEL 2</p>
          </div>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-neobrutal" style={{ background: 'linear-gradient(135deg, #493ee5, #635bff)' }}>
             <User className="w-5 h-5" />
          </div>
        </div>
      </div>
    </header>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const userStr = sessionStorage.getItem("staff_user");
    if (!userStr) {
      window.location.href = "/login";
      return;
    }
  }, []);

  const navItems = [
    { name: "Live Operations", href: "/staff", icon: Building2 },
    { name: "Manage Queues", href: "/staff/queues", icon: Users },
    { name: "Analytics", href: "/staff/analytics", icon: BarChart3 },
    { name: "Settings", href: "/staff/settings", icon: Settings },
  ];

  const handleLogout = () => {
    sessionStorage.removeItem("staff_token");
    sessionStorage.removeItem("staff_user");
    window.location.href = "/login";
  };

  return (
    <SocketProvider>
      <div className="min-h-screen bg-[#f7fafd] flex transition-all duration-300 font-sans selection:bg-[#493ee5]/10 selection:text-[#493ee5]">
        <Toaster position="top-right" expand={true} richColors closeButton />
        
        {/* ━━━ Sidebar ━━━ */}
        <aside className={cn(
          "bg-white hidden md:flex flex-col sticky top-0 h-screen transition-all duration-300 z-40 border-r border-[#e5e8eb]",
          isCollapsed ? "w-[72px]" : "w-[260px]"
        )}>
          <div className={cn(
            "p-5 flex items-center gap-3 transition-all border-b border-[#e5e8eb]",
            isCollapsed ? "justify-center px-3" : "justify-start"
          )}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-neobrutal shrink-0" style={{ background: 'linear-gradient(135deg, #493ee5, #635bff)' }}>
               <span className="text-white font-extrabold text-lg" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>L</span>
            </div>
            {!isCollapsed && (
              <div>
                <span className="text-xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Lineo<span className="text-[#493ee5]">.hq</span></span>
              </div>
            )}
          </div>

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

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <StaffHeader />
          <main className="flex-1 p-5 w-full animate-in fade-in slide-in-from-bottom-4 duration-700 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SocketProvider>
  );
}
