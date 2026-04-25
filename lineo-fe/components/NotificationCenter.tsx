"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Bell, 
  Zap, 
  Calendar,
  MapPin,
  Clock,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
  type: "info" | "success" | "warning" | "alert";
  icon: React.ReactNode;
  unread: boolean;
}

function getIconForType(type: string): React.ReactNode {
  switch (type) {
    case "success":
    case "appointment":
      return <Calendar className="w-4 h-4" />;
    case "alert":
    case "queue":
      return <Zap className="w-4 h-4" />;
    case "commute":
      return <MapPin className="w-4 h-4" />;
    default:
      return <Bell className="w-4 h-4" />;
  }
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 10) return "Just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const bellRef = useRef<HTMLButtonElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [isMobile, setIsMobile] = useState(false);

  // Calculate fixed position from bell button — adapts to mobile vs desktop
  const updatePosition = useCallback(() => {
    const mobile = window.innerWidth < 640;
    setIsMobile(mobile);

    if (mobile) {
      // Full-width centered panel on mobile
      setDropdownStyle({
        top: bellRef.current ? bellRef.current.getBoundingClientRect().bottom + 8 : 60,
        left: 8,
        right: 8,
      });
    } else if (bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect();
      setDropdownStyle({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }
  }, [isOpen, updatePosition]);

  // ─── Shared notification adder (must be before useEffects that use it) ───
  const addNotification = useCallback((title: string, description: string, type: string) => {
    const newNotif: Notification = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      title,
      description,
      time: getRelativeTime(new Date()),
      type: (type || "info") as Notification["type"],
      icon: getIconForType(type),
      unread: true,
    };
    setNotifications((prev) => [newNotif, ...prev].slice(0, 20));
  }, []);

  // ─── Listen for custom in-app events (existing pattern) ───
  useEffect(() => {
    const handleNotify = (e: CustomEvent<{ title: string; description: string; type: string }>) => {
      const { title, description, type } = e.detail;
      addNotification(title, description, type);
    };

    window.addEventListener("lineo_notify", handleNotify as EventListener);
    return () => window.removeEventListener("lineo_notify", handleNotify as EventListener);
  }, [addNotification]);

  // ─── Listen for push notifications from Service Worker ───
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_RECEIVED") {
        const { title, body, notifType } = event.data;
        addNotification(title || "Lineo", body || "New notification", notifType || "info");
      }
    };

    navigator.serviceWorker.addEventListener("message", handleSWMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleSWMessage);
  }, [addNotification]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <>
      <button
        ref={bellRef}
        onClick={() => setIsOpen(!isOpen)}
        className="w-9 h-9 md:w-11 md:h-11 rounded-2xl hover:bg-[#f6f9fc] flex items-center justify-center transition-all bg-white shadow-sm hover:shadow-md relative group border border-[#e5e8eb]/50"
      >
        <Bell
          className={cn(
            "w-4 h-4 md:w-5 md:h-5 text-[#49607e] group-hover:text-[#493ee5] transition-colors",
            isOpen && "text-[#493ee5]"
          )}
        />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 md:top-2 md:right-2 min-w-[16px] h-4 bg-[#493ee5] text-white text-[9px] font-bold rounded-full border-2 border-white flex items-center justify-center px-0.5 animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop — semi-transparent on mobile for context */}
            <div
              className="fixed inset-0 z-[60] bg-black/10 sm:bg-transparent"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown — fixed positioning, responsive */}
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className={cn(
                "fixed z-[70] bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-[#e5e8eb] overflow-hidden text-left",
                isMobile ? "" : "w-[380px]"
              )}
              style={dropdownStyle}
            >
              {/* ── Header ── */}
              <div className="px-5 py-4 border-b border-[#e5e8eb] flex items-center justify-between bg-white">
                <div>
                  <h3
                    className="text-[15px] font-extrabold text-[#181c1e] leading-none"
                    style={{ fontFamily: "var(--font-manrope), sans-serif" }}
                  >
                    Notifications
                  </h3>
                  <p className="text-[11px] text-[#49607e] mt-1">
                    Queue alerts, appointments & commute
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAll}
                      className="text-[10px] font-bold text-[#49607e] hover:text-red-500 uppercase tracking-widest transition-colors"
                    >
                      Clear
                    </button>
                  )}
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[10px] font-bold text-[#493ee5] uppercase tracking-widest hover:underline"
                    >
                      Read all
                    </button>
                  )}
                </div>
              </div>

              {/* ── Notification List ── */}
              <div className="max-h-[360px] overflow-y-auto">
                {notifications.length > 0 ? (
                  notifications.map((n, i) => (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={cn(
                        "px-5 py-3.5 flex gap-3.5 hover:bg-[#f7fafd] transition-colors cursor-pointer relative border-b border-[#e5e8eb]/50 last:border-b-0",
                        n.unread && "bg-[#493ee5]/[0.02]"
                      )}
                    >
                      {n.unread && (
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#493ee5] rounded-r-full" />
                      )}
                      <div
                        className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                          n.type === "success"
                            ? "bg-emerald-50 text-emerald-600"
                            : n.type === "alert"
                            ? "bg-amber-50 text-amber-600"
                            : n.type === "warning"
                            ? "bg-orange-50 text-orange-600"
                            : "bg-[#493ee5]/8 text-[#493ee5]"
                        )}
                      >
                        {n.icon}
                      </div>

                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between gap-2">
                          <h4
                            className="text-[13px] font-bold text-[#181c1e] truncate"
                            style={{ fontFamily: "var(--font-manrope), sans-serif" }}
                          >
                            {n.title}
                          </h4>
                          <span className="text-[9px] text-[#49607e] font-medium shrink-0">
                            {n.time}
                          </span>
                        </div>
                        <p className="text-[12px] text-[#49607e] leading-relaxed line-clamp-2 mt-0.5">
                          {n.description}
                        </p>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="py-14 text-center space-y-3">
                    <div className="w-14 h-14 bg-[#f7fafd] rounded-2xl flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                    </div>
                    <div>
                      <p
                        className="text-sm font-bold text-[#181c1e]"
                        style={{ fontFamily: "var(--font-manrope), sans-serif" }}
                      >
                        All caught up!
                      </p>
                      <p className="text-[11px] text-[#49607e] mt-1">
                        Push notifications will appear here
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Footer ── */}
              {notifications.length > 0 && (
                <div className="px-5 py-3 bg-[#f8fafc] border-t border-[#e5e8eb] flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[#49607e]">
                    <Clock className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase tracking-tight">
                      {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-[10px] font-extrabold text-[#493ee5] uppercase tracking-wider hover:underline"
                    style={{ fontFamily: "var(--font-manrope), sans-serif" }}
                  >
                    Close
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
