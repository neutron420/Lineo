"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Building2, 
  Map as MapIcon, 
  BarChart3, 
  Settings, 
  LogOut, 
  Bell,
  Search,
  ChevronRight,
  ShieldAlert,
  Users,
  Activity,
  CreditCard,
  ChevronLeft,
  Settings as SettingsIcon,
  Zap,
  Radio,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";
import { motion } from "framer-motion";

function SystemAdminHeader() {
  return (
    <header className="h-20 bg-white/80 backdrop-blur-xl sticky top-0 z-30 flex items-center justify-between px-8 border-b border-[#e5e8eb]">
      <div className="flex items-center flex-1 max-w-2xl gap-6">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#49607e] group-focus-within:text-[#493ee5] transition-colors" />
          <input
            type="text"
            placeholder="Global search (Users, Orgs, Terminals)..."
            className="w-full pl-11 pr-6 py-3 bg-[#f1f4f7] border border-transparent focus:bg-white focus:border-[#493ee5]/15 focus:ring-2 focus:ring-[#493ee5]/5 rounded-xl text-sm transition-all outline-none font-medium text-[#181c1e] placeholder:text-[#49607e]/60"
          />
        </div>
      </div>

      <div className="flex items-center gap-5">
        <Link href="/admin/notifications" className="w-11 h-11 rounded-2xl bg-[#f7fafd] hover:bg-[#e5e8eb] flex items-center justify-center transition-all text-[#181c1e] border border-transparent relative">
          <Bell className="w-5 h-5 text-[#49607e]" />
          <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
        </Link>
        <button className="w-11 h-11 rounded-2xl bg-red-50 hover:bg-red-100 flex items-center justify-center transition-all text-red-600 border border-transparent relative">
          <ShieldAlert className="w-5 h-5" />
        </button>
        <div className="h-6 w-px bg-[#e5e8eb]" />
        <div className="flex items-center gap-4">
          <div className="text-right hidden xl:block">
            <p className="text-sm font-bold text-[#181c1e] leading-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>System Root</p>
            <p className="text-[10px] text-[#493ee5] uppercase tracking-[0.12em] font-extrabold mt-0.5" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Level 1 Clearance</p>
          </div>
          <motion.div 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white cursor-pointer shadow-[0_4px_14px_0_rgba(73,62,229,0.3)]"
            style={{ background: 'linear-gradient(135deg, #493ee5, #635bff)' }} // Blue badge to match user UI
          >
            <ShieldAlert className="w-5 h-5" />
          </motion.div>
        </div>
      </div>
    </header>
  );
}

export default function SystemAdminLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const isAuthPage = pathname === "/admin/login" || pathname === "/admin/register";

  useEffect(() => {
    if (isAuthPage) return;
    const userStr = sessionStorage.getItem("admin_user");
    if (!userStr) {
      window.location.href = "/admin/login";
      return;
    }
    const user = JSON.parse(userStr);
    if (user.role !== "admin") {
      window.location.href = "/admin/login";
    }
  }, [isAuthPage]);

  const navItems = [
    { name: "System Overview", href: "/admin", icon: Activity },
    { name: "Verifications", href: "/admin/verifications", icon: Building2 }, // Verify Orgs
    { name: "Global Network", href: "/admin/map", icon: MapIcon },
    { name: "All Users", href: "/admin/users", icon: Users },
    { name: "Billing Vault", href: "/admin/payments", icon: CreditCard },
    { name: "Platform Analytics", href: "/admin/analytics", icon: BarChart3 },
    { name: "Infrastructure", href: "/admin/terminals", icon: Cpu },
    { name: "Announcements", href: "/admin/announcements", icon: Radio },
    { name: "Root Settings", href: "/admin/settings", icon: SettingsIcon },
  ];

  const handleLogout = () => {
    sessionStorage.removeItem("admin_token");
    sessionStorage.removeItem("admin_user");
    window.location.href = "/admin/login";
  };

  if (isAuthPage) {
    return (
      <div className="min-h-screen font-sans selection:bg-[#493ee5]/10 selection:text-[#493ee5]">
        <Toaster position="top-right" expand={true} richColors closeButton />
        {children}
      </div>
    );
  }

  return (
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
                    ? "text-white font-bold shadow-[0_4px_14px_0_rgba(73,62,229,0.3)] bg-[#493ee5]"
                    : "text-[#49607e] hover:bg-[#f1f4f7] hover:text-[#181c1e] font-medium"
                )}
                style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
              >
                <item.icon className={cn(
                  "w-[18px] h-[18px] transition-transform duration-200 shrink-0",
                  isActive ? "text-white" : "text-[#49607e] group-hover:text-[#181c1e] group-hover:scale-110"
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
            {!isCollapsed && <span>System Lock</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <SystemAdminHeader />
        <main className="flex-1 p-5 w-full animate-in fade-in slide-in-from-bottom-4 duration-700 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
