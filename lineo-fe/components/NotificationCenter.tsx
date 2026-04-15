"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Bell, 
  Navigation, 
  Zap, 
  Calendar
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

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: "1",
      title: "Appointment Confirmed",
      description: "Your visit to SBI Bank is scheduled for tomorrow at 10:30 AM.",
      time: "2m ago",
      type: "success",
      icon: <Calendar className="w-4 h-4" />,
      unread: true
    },
    {
      id: "2",
      title: "Smart Commute Alert",
      description: "Traffic is picking up. Leave in 15 mins to reach Apollo Care on time.",
      time: "1h ago",
      type: "alert",
      icon: <Navigation className="w-4 h-4" />,
      unread: true
    },
    {
      id: "3",
      title: "Queue Update",
      description: "You are now 3rd in line at Indo-Clinic.",
      time: "3h ago",
      type: "info",
      icon: <Zap className="w-4 h-4" />,
      unread: false
    }
  ]);

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-11 h-11 rounded-2xl hover:bg-[#f6f9fc] flex items-center justify-center transition-all bg-white shadow-sm hover:shadow-md relative group border border-stripe-border/50"
      >
        <Bell className={cn("w-5 h-5 text-stripe-slate group-hover:text-stripe-purple transition-colors", isOpen && "text-stripe-purple")} />
        {unreadCount > 0 && (
          <span className="absolute top-2.5 right-2.5 w-4 h-4 bg-stripe-purple text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40 bg-transparent" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-4 w-[380px] bg-white rounded-3xl shadow-2xl border border-stripe-border overflow-hidden z-50 text-left"
            >
              <div className="p-6 border-b border-stripe-border flex items-center justify-between">
                <div>
                   <h3 className="text-lg font-bold text-stripe-navy leading-none">Notifications</h3>
                   <p className="text-xs text-stripe-slate mt-1">Manage your live queue and commute alerts</p>
                </div>
                <button 
                  onClick={() => setNotifications(notifications.map(n => ({...n, unread: false})))}
                  className="text-[11px] font-bold text-stripe-purple uppercase tracking-widest hover:underline"
                >
                  Mark all as read
                </button>
              </div>

              <div className="max-h-[400px] overflow-y-auto custom-scrollbar text-left">
                {notifications.length > 0 ? (
                  notifications.map((n, i) => (
                    <motion.div 
                      key={n.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={cn(
                        "p-5 flex gap-4 hover:bg-[#f6f9fc] transition-colors cursor-pointer relative",
                        n.unread && "bg-stripe-purple/[0.02]"
                      )}
                    >
                      {n.unread && <div className="absolute left-0 top-0 bottom-0 w-1 bg-stripe-purple" />}
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        n.type === "success" ? "bg-green-50 text-green-600" :
                        n.type === "alert" ? "bg-orange-50 text-orange-600" :
                        "bg-stripe-purple/10 text-stripe-purple"
                      )}>
                         {n.icon}
                      </div>

                      <div className="flex-1 space-y-1 text-left">
                        <div className="flex items-center justify-between">
                           <h4 className="text-sm font-bold text-stripe-navy">{n.title}</h4>
                           <span className="text-[10px] text-stripe-slate font-medium">{n.time}</span>
                        </div>
                        <p className="text-[13px] text-stripe-slate leading-relaxed line-clamp-2">{n.description}</p>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="p-12 text-center space-y-3">
                     <div className="w-16 h-16 bg-[#f6f9fc] rounded-full flex items-center justify-center mx-auto">
                        <Bell className="w-8 h-8 text-stripe-purple/20" />
                     </div>
                     <p className="text-sm text-stripe-slate">All caught up!</p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-[#fcfdfe] border-t border-stripe-border text-center">
                 <button className="text-xs font-bold text-stripe-slate hover:text-stripe-navy transition-colors">
                    View Notification History
                 </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
