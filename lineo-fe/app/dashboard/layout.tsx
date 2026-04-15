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
import { Toaster } from "sonner";
import { motion } from "framer-motion";
import { LocationProvider, useLocation } from "@/context/LocationContext";
import { SocketProvider } from "@/context/SocketContext";
import { NotificationCenter } from "@/components/NotificationCenter";

function GlobalHeader() {
  const { address, pincode, refreshLocation } = useLocation();
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const userData = sessionStorage.getItem("user");
    if (userData) setUser(JSON.parse(userData));
  }, []);

  if (!mounted) return (
    <header className="h-24 bg-white/80 backdrop-blur-xl border-b border-stripe-border sticky top-0 z-30 flex items-center justify-between px-14 opacity-0">
    </header>
  );

  return (
    <header className="h-24 bg-white/80 backdrop-blur-xl border-b border-stripe-border sticky top-0 z-30 flex items-center justify-between px-14">
      <div className="flex items-center flex-1 max-w-3xl gap-8">
        <div className="relative flex-1 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-stripe-slate group-focus-within:text-stripe-purple transition-colors" />
          <input
            type="text"
            placeholder="Search organizations, medical queues, or banks..."
            className="w-full pl-14 pr-6 py-4 bg-[#f6f9fc] border border-transparent focus:bg-white focus:border-stripe-purple/20 rounded-2xl text-[15px] transition-all outline-none font-medium"
          />
        </div>
        
        <div className="flex items-center gap-3">
           <div 
             onClick={refreshLocation}
             className="flex items-center gap-3 px-5 py-3.5 bg-stripe-purple/5 border border-stripe-purple/10 rounded-2xl cursor-pointer hover:bg-stripe-purple/10 transition-all group"
           >
              <div className="relative">
                 <MapIcon className="w-4.5 h-4.5 text-stripe-purple" />
                 <span className="absolute top-0 right-0 w-2 h-2 bg-green-500 rounded-full border-2 border-white animate-pulse" />
              </div>
              <div className="flex flex-col">
                 <span className="text-[10px] font-black text-stripe-purple uppercase tracking-[0.1em]">{address}</span>
                 <span className="text-[9px] font-bold text-stripe-slate uppercase tracking-widest">{pincode || "Locate Me"}</span>
              </div>
           </div>
        </div>
      </div>

      <div className="flex items-center gap-8">
        <NotificationCenter />
        <div className="h-8 w-px bg-stripe-border"></div>
        <div className="flex items-center gap-5">
          <div className="text-right hidden xl:block">
            <p className="text-[15px] font-bold text-stripe-navy leading-tight">{user?.username || "Quest"}</p>
            <p className="text-[11px] text-stripe-purple uppercase tracking-[0.15em] font-extrabold mt-0.5">Verified Account</p>
          </div>
          <motion.div 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-12 h-12 rounded-2xl bg-stripe-purple shadow-xl shadow-stripe-purple/30 flex items-center justify-center text-white cursor-pointer"
          >
            <User className="w-6 h-6" />
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
    <LocationProvider>
      <SocketProvider>
        <div className="min-h-screen bg-[#f6f9fc] flex transition-all duration-300 font-sans selection:bg-stripe-purple/10 selection:text-stripe-purple">
          <Toaster position="top-right" expand={true} richColors closeButton />
          
          {/* ... sidebars and main content ... */}
          {/* Main Content */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <GlobalHeader />

            <main className="flex-1 p-8 lg:p-14 w-full animate-in fade-in slide-in-from-bottom-4 duration-1000 custom-scrollbar overflow-y-auto">
              {children}
            </main>
          </div>
        </div>
      </SocketProvider>
    </LocationProvider>
  );
}
