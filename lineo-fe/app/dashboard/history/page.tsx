"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  History, 
  Search, 
  Filter, 
  Download, 
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Zap,
  BarChart3,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

export default function QueueHistoryPage() {
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const resp = await api.get("/queue/history");
        setHistoryItems(resp.data.data || []);
      } catch (err) {
        console.error("Failed to fetch history", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, []);

  return (
    <div className="space-y-10 text-left">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-light text-stripe-navy tracking-tight">Queue History</h1>
          <p className="text-stripe-slate text-lg font-light">A detailed record of your past visits and time saved.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stripe-slate group-focus-within:text-stripe-purple transition-colors" />
            <input 
              type="text" 
              placeholder="Search history..." 
              className="pl-10 pr-4 py-2 bg-white border border-stripe-border rounded-xl text-sm focus:ring-2 focus:ring-stripe-purple/10 focus:border-stripe-purple outline-none transition-all"
            />
          </div>
          <button className="p-2 bg-white border border-stripe-border rounded-xl text-stripe-slate hover:text-stripe-navy hover:border-stripe-navy transition-all">
            <Filter className="w-5 h-5" />
          </button>
          <button className="stripe-btn-secondary py-2 px-4 flex items-center gap-2 text-sm font-medium">
             <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <StatsBox title="Total Visits" value={historyItems.length.toString()} desc="Lifetime visits tracked" icon={<History className="w-5 h-5" />} color="purple" />
         <StatsBox title="Total Time Saved" value="12.8h" desc="Skipping physical lines" icon={<Zap className="w-5 h-5" />} color="green" />
         <StatsBox title="Success Rate" value="94%" desc="Against cancelled tickets" icon={<BarChart3 className="w-5 h-5" />} color="blue" />
      </div>

      <div className="stripe-card bg-white overflow-hidden border-stripe-border shadow-stripe-premium rounded-3xl">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-stripe-purple animate-spin" />
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stripe-border bg-[#fcfdfe]">
                  <th className="px-6 py-4 text-[12px] font-bold text-stripe-slate uppercase tracking-wider">Queue Key</th>
                  <th className="px-6 py-4 text-[12px] font-bold text-stripe-slate uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-[12px] font-bold text-stripe-slate uppercase tracking-wider">Token</th>
                  <th className="px-6 py-4 text-[12px] font-bold text-stripe-slate uppercase tracking-wider">Wait Time</th>
                  <th className="px-6 py-4 text-[12px] font-bold text-stripe-slate uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-[12px] font-bold text-stripe-slate uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stripe-border">
                {historyItems.map((item, i) => (
                  <motion.tr 
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="hover:bg-stripe-purple/[0.02] transition-colors group cursor-default"
                  >
                    <td className="px-6 py-5">
                      <span className="text-[15px] font-medium text-stripe-navy group-hover:text-stripe-purple transition-colors">{item.queue_key}</span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-[14px] text-stripe-slate">
                        <CalendarIcon className="w-3.5 h-3.5" /> {new Date(item.joined_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-[13px] font-mono font-bold text-stripe-navy bg-stripe-border/30 px-2 py-0.5 rounded uppercase font-display">
                        {item.token_number}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-[14px] text-stripe-navy tabular">
                        <Clock className="w-3.5 h-3.5 text-stripe-slate" /> {item.serving_duration ? `${Math.floor(item.serving_duration / 60)}m` : "4m"}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button className="text-stripe-slate hover:text-stripe-purple transition-all p-2 rounded-lg hover:bg-stripe-purple/10">
                          <ExternalLink className="w-4 h-4" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Pagination/Footer */}
        <div className="px-6 py-4 bg-[#fcfdfe] border-t border-stripe-border flex items-center justify-between">
           <p className="text-sm text-stripe-slate font-light">Showing result {historyItems.length} of {historyItems.length}</p>
           <div className="flex items-center gap-2">
              <button disabled className="p-2 border border-stripe-border rounded-lg disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button disabled className="p-2 border border-stripe-border rounded-lg disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}

function StatsBox({ title, value, desc, color, icon }: any) {
  const colorMap: any = {
    purple: "bg-stripe-purple/5 text-stripe-purple border-stripe-purple/20",
    green: "bg-green-50 text-green-600 border-green-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100",
  };
  
  return (
    <div className={cn("stripe-card p-6 border transition-all hover:scale-[1.02] rounded-3xl", colorMap[color])}>
       <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-white rounded-xl shadow-sm">{icon}</div>
          <TrendingUp className="w-4 h-4 opacity-30" />
       </div>
       <p className="text-[13px] font-bold uppercase tracking-wider mb-1 opacity-80 font-display">{title}</p>
       <h3 className="text-4xl font-light tracking-tighter tabular mb-2">{value}</h3>
       <p className="text-[13px] opacity-70">{desc}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed" || status === "serving") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-green-700 bg-green-100 px-2 py-1 rounded-lg border border-green-200">
         <CheckCircle2 className="w-3 h-3" /> {status}
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-red-700 bg-red-100 px-2 py-1 rounded-lg border border-red-200">
         <XCircle className="w-3 h-3" /> Cancelled
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-stripe-slate bg-stripe-border px-2 py-1 rounded-lg">
       <HelpCircle className="w-3 h-3" /> {status}
    </span>
  );
}
