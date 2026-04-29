"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, useMotionValueEvent, useScroll } from "framer-motion"; // Fixed import
import { cn } from "@/lib/utils";
import { Info, AlertTriangle, ShieldAlert, X, RefreshCw } from "lucide-react";
import api from "@/lib/api";

interface Announcement {
  id: number;
  title: string;
  message: string;
  level: string;
  expires_at?: string;
}

export const StickyBanner = ({
  className,
  hideOnScroll = false,
}: {
  className?: string;
  hideOnScroll?: boolean;
}) => {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [visible, setVisible] = useState(false);
  const [lastDismissedId, setLastDismissedId] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const { scrollY } = useScroll();

  useEffect(() => {
    const stored = localStorage.getItem("last_dismissed_announcement_id");
    if (stored) setLastDismissedId(parseInt(stored));
  }, []);

  const fetchLatest = async () => {
    try {
      // Skip showing for admins
      const adminStr = sessionStorage.getItem("admin_user");
      if (adminStr) {
        const adminData = JSON.parse(adminStr);
        if (adminData.role === 'admin') return;
      }

      const res = await api.get("/announcement/latest");
      const data = res.data?.data;
      
      const dismissedId = parseInt(localStorage.getItem("last_dismissed_announcement_id") || "0");

      if (data && data.id !== dismissedId) {
        // Check if expired
        if (data.expires_at) {
            const now = new Date();
            const expiry = new Date(data.expires_at);
            if (expiry.getTime() <= now.getTime()) {
                setAnnouncement(null);
                setVisible(false);
                return;
            }
        }
        setAnnouncement(data);
        setVisible(true);
      } else {
        setAnnouncement(null);
        setVisible(false);
      }
    } catch (err) {
      console.error("Announcement fetch failed:", err);
    }
  };

  useEffect(() => {
    fetchLatest();
    const interval = setInterval(fetchLatest, 30000);
    return () => clearInterval(interval);
  }, [lastDismissedId]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (announcement?.expires_at) {
      const updateTimer = () => {
        const now = new Date();
        const expiry = new Date(announcement.expires_at!);
        const diff = expiry.getTime() - now.getTime();
        if (diff <= 0) {
          setTimeLeft("EXPIRED");
          setVisible(false);
          // Auto-dismiss expired
          localStorage.setItem("last_dismissed_announcement_id", announcement.id.toString());
          setLastDismissedId(announcement.id);
          return;
        }
        const mins = Math.floor(diff / 1000 / 60);
        const secs = Math.floor((diff / 1000) % 60);
        setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
      };
      updateTimer();
      timer = setInterval(updateTimer, 1000);
    } else {
      setTimeout(() => setTimeLeft(""), 0);
    }
    return () => clearInterval(timer);
  }, [announcement]);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const dismissedId = parseInt(localStorage.getItem("last_dismissed_announcement_id") || "0");
    if (hideOnScroll && latest > 40) {
      setVisible(false);
    } else if (hideOnScroll && announcement && latest <= 40 && announcement.id !== dismissedId) {
      setVisible(true);
    }
  });

  if (!announcement || !visible) return null;

  const levelConfig: Record<string, any> = {
    INFO: {
      bg: "bg-[#493ee5]", 
      icon: <Info className="h-4 w-4" />,
      label: "Notice"
    },
    WARNING: {
      bg: "bg-amber-500",
      icon: <AlertTriangle className="h-4 w-4" />,
      label: "Warning"
    },
    EMERGENCY: {
      bg: "bg-red-600",
      icon: <ShieldAlert className="h-4 w-4" />,
      label: "Emergency"
    }
  };

  const config = levelConfig[announcement.level] || levelConfig.INFO;

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem("last_dismissed_announcement_id", announcement.id.toString());
    setLastDismissedId(announcement.id);
  };

  return (
    <AnimatePresence>
      <motion.div
        className={cn(
          "fixed inset-x-0 top-0 z-[9999] flex min-h-12 w-full items-center justify-between border-b border-white/10 px-4 py-2 shadow-2xl",
          config.bg,
          className,
        )}
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        transition={{ duration: 0.4, ease: "circOut" }}
      >
        <div className="flex items-center justify-center gap-4 max-w-7xl mx-auto flex-1 overflow-hidden">
          <div className="flex items-center gap-2 shrink-0 bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-white/20 text-white">
            {config.icon}
            <span>{config.label}</span>
          </div>
          
          <div className="flex items-center gap-2 truncate text-white">
             <span className="font-black text-xs uppercase tracking-tight whitespace-nowrap hidden lg:inline">{announcement.title}</span>
             <span className="hidden lg:inline opacity-30 font-light">|</span>
             <span className="font-bold text-xs truncate opacity-95 tracking-wide">{announcement.message}</span>
             
             {timeLeft && (
               <span className="ml-2 px-2 py-0.5 bg-black/30 rounded-lg font-black text-[10px] tabular-nums border border-white/10 flex items-center gap-1.5 animate-pulse">
                 <RefreshCw className="h-3 w-3" />
                 {timeLeft === "EXPIRED" ? "ENDED" : timeLeft}
               </span>
             )}
          </div>

          <div className="hidden xl:flex items-center gap-2 shrink-0 ml-2">
             <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
             <span className="text-[10px] font-black uppercase opacity-60 tracking-widest">Active</span>
          </div>
        </div>

        <button 
          onClick={handleDismiss}
          className="p-1.5 hover:bg-white/20 rounded-xl transition-all shrink-0 text-white"
        >
          <X className="h-4 w-4" strokeWidth={3} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};
