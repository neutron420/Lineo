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
  Map as MapIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationCenter } from "@/components/NotificationCenter";
import { Toaster } from "sonner";
import { motion } from "framer-motion";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const pathname = usePathname();

  useEffect(() => {
    const userData = sessionStorage.getItem("user");
    if (userData) setUser(JSON.parse(userData));
  }, []);

  const navItems = [
    { name: "Live Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Discovery & Maps", href: "/dashboard/discovery", icon: MapIcon },
    { name: "My Appointments", href: "/dashboard/appointments", icon: Calendar },
    { name: "Queue History", href: "/dashboard/history", icon: HistoryIcon },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-[#f6f9fc] flex transition-all duration-300 font-sans selection:bg-stripe-purple/10 selection:text-stripe-purple">
      <Toaster position="top-right" expand={true} richColors closeButton />
      
      {/* Sidebar */}
      <aside className={cn(
        "bg-white border-r border-stripe-border hidden md:flex flex-col sticky top-0 h-screen transition-all duration-300 z-40 shadow-sm",
        isCollapsed ? "w-20" : "w-72"
      )}>
        <div className={cn(
          "p-6 border-b border-stripe-border flex items-center gap-4 transition-all",
          isCollapsed ? "justify-center px-2" : "justify-start"
        )}>
          <div className="w-10 h-10 bg-stripe-purple rounded-[12px] flex items-center justify-center shadow-lg shadow-stripe-purple/20 shrink-0">
            <span className="text-white font-bold text-2xl uppercase tracking-tighter">L</span>
          </div>
          {!isCollapsed && (
            <span className="text-[24px] font-bold text-stripe-navy tracking-tight">Lineo<span className="text-stripe-purple">.ai</span></span>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-2 mt-4 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 group relative",
                  isActive
                    ? "bg-stripe-purple text-white shadow-xl shadow-stripe-purple/20 font-bold"
                    : "text-stripe-slate hover:bg-[#f6f9fc] hover:text-stripe-purple"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5 transition-transform duration-300",
                  isActive ? "text-white scale-110" : "text-stripe-slate group-hover:text-stripe-purple group-hover:scale-110"
                )} />
                {!isCollapsed && <span className="text-[15px]">{item.name}</span>}
                {isActive && (
                  <motion.div 
                    layoutId="active-indicator"
                    className="absolute left-0 w-1 h-6 bg-white rounded-r-full"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-stripe-border space-y-2 bg-[#fcfdfe]">
          <button
             onClick={() => setIsCollapsed(!isCollapsed)}
             className="flex items-center gap-4 px-5 py-4 w-full rounded-2xl text-stripe-slate hover:bg-[#f6f9fc] hover:text-stripe-navy transition-all duration-200 group"
          >
             <div className="shrink-0">{isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}</div>
             {!isCollapsed && <span className="text-[14px] font-bold">Collapse Panel</span>}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-4 px-5 py-4 w-full rounded-2xl text-stripe-slate hover:bg-red-50 hover:text-red-600 transition-all duration-200 group"
          >
            <LogOut className="w-5 h-5 shrink-0 group-hover:scale-110 transition-transform" />
            {!isCollapsed && <span className="text-[15px] font-bold">Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white/80 backdrop-blur-xl border-b border-stripe-border sticky top-0 z-30 flex items-center justify-between px-10">
          <div className="flex items-center flex-1 max-w-2xl group">
            <div className="relative w-full">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-stripe-slate group-focus-within:text-stripe-purple transition-colors" />
              <input
                type="text"
                placeholder="Search organizations, medical queues, or banks..."
                className="w-full pl-12 pr-4 py-3.5 bg-[#f6f9fc] border border-transparent focus:bg-white focus:border-stripe-purple/20 rounded-2xl text-[14px] transition-all outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <NotificationCenter />
            
            <div className="h-10 w-px bg-stripe-border h-8"></div>
            
            <div className="flex items-center gap-4 pl-2">
              <div className="text-right hidden sm:block">
                <p className="text-[15px] font-bold text-stripe-navy leading-tight">{user?.username || "Quest"}</p>
                <p className="text-[11px] text-stripe-purple uppercase tracking-[0.15em] font-extrabold mt-0.5">Premium Plan</p>
              </div>
              <motion.div 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-12 h-12 rounded-[16px] bg-stripe-purple shadow-xl shadow-stripe-purple/30 flex items-center justify-center text-white cursor-pointer"
              >
                <User className="w-6 h-6" />
              </motion.div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 lg:p-14 w-full animate-in fade-in slide-in-from-bottom-4 duration-1000 custom-scrollbar overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
