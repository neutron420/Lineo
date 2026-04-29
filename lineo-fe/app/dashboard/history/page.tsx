"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Loader2,
  TrendingDown
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";

interface HistoryItem {
  queue_key: string;
  joined_at: string;
  token_number: string;
  serving_duration?: number;
  status: string;
}

export default function QueueHistoryPage() {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      const resp = await api.get("/queue/history");
      setHistoryItems(resp.data.data || []);
    } catch (err) {
      console.error("Failed to fetch history", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const chartData = [
    { name: 'Mon', time: 12 },
    { name: 'Tue', time: 18 },
    { name: 'Wed', time: 15 },
    { name: 'Thu', time: 25 },
    { name: 'Fri', time: 10 },
    { name: 'Sat', time: 5 },
    { name: 'Sun', time: 20 },
  ];

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 bg-[#f1f4f7] rounded-md w-48 mb-2" />
            <div className="h-4 bg-[#f1f4f7] rounded-md w-72" />
          </div>
          <div className="h-10 bg-[#f1f4f7] rounded-xl w-[350px]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
           {[1,2,3].map(i => <div key={i} className="h-28 bg-[#f1f4f7] rounded-2xl ghost-border" />)}
        </div>
        <div className="h-[500px] bg-[#f1f4f7] rounded-2xl w-full ghost-border" />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Queue History</h1>
          <p className="text-[#49607e] text-xs md:text-sm font-medium mt-1">A detailed record of your past visits and time saved.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative group flex-1 sm:flex-none">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#49607e] group-focus-within:text-[#493ee5] transition-colors" />
            <input 
              type="text" 
              placeholder="Search history..." 
              className="w-full sm:w-[200px] pl-10 pr-4 py-2.5 bg-white rounded-xl text-sm ghost-border focus:ring-2 focus:ring-[#493ee5]/10 outline-none transition-all"
            />
          </div>
          <div className="flex gap-2">
            <button className="flex-1 sm:flex-none p-2.5 bg-white rounded-xl ghost-border text-[#49607e] hover:text-[#493ee5] transition-all flex justify-center items-center">
              <Filter className="w-4 h-4" />
            </button>
            <Button variant="ghost" className="flex-[2] sm:flex-none h-11 px-4 rounded-xl text-sm font-bold text-[#49607e] bg-white ghost-border hover:text-[#493ee5] gap-2" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
               <Download className="w-4 h-4" /> Export
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
         <StatsBox title="Total Visits" value={historyItems.length.toString()} desc="Lifetime visits tracked" icon={<History className="w-5 h-5" />} color="purple" />
         <StatsBox title="Total Time Saved" value="12.8h" desc="Skipping physical lines" icon={<Zap className="w-5 h-5" />} color="green" />
         <StatsBox title="Success Rate" value="94%" desc="Against cancelled tickets" icon={<BarChart3 className="w-5 h-5" />} color="blue" />
      </div>

      {/* Analytics Chart */}
      <div className="bg-white p-6 md:p-8 rounded-3xl ghost-border shadow-ambient">
         <div className="flex items-center justify-between mb-8">
            <div>
               <h3 className="text-lg font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Visit Velocity</h3>
               <p className="text-xs text-[#49607e] font-medium">Tracking your queue efficiency over time</p>
            </div>
            <div className="flex items-center gap-2 bg-[#f1f4f7] p-1 rounded-lg">
               <button className="px-3 py-1 bg-white text-[#493ee5] shadow-sm rounded-md text-[10px] font-bold uppercase tracking-wider">Wait Time</button>
               <button className="px-3 py-1 text-[#49607e] text-[10px] font-bold uppercase tracking-wider">Visits</button>
            </div>
         </div>
         
         <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={chartData}>
                  <defs>
                     <linearGradient id="colorWait" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#493ee5" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#493ee5" stopOpacity={0}/>
                     </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f4f7" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#49607e' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#49607e' }}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.08)', padding: '12px' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 800, color: '#493ee5' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="time" 
                    stroke="#493ee5" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorWait)" 
                  />
               </AreaChart>
            </ResponsiveContainer>
         </div>
      </div>

      {/* History List/Table */}
      <div className="bg-white rounded-2xl md:rounded-3xl overflow-hidden ghost-border shadow-ambient">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#e5e8eb] bg-[#f7fafd]">
                  <th className="px-6 py-4 text-[11px] font-extrabold text-[#49607e] uppercase tracking-[0.15em]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Queue Key</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold text-[#49607e] uppercase tracking-[0.15em]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Date</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold text-[#49607e] uppercase tracking-[0.15em]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Token</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold text-[#49607e] uppercase tracking-[0.15em]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Wait Time</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold text-[#49607e] uppercase tracking-[0.15em]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Status</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f4f7]">
                {historyItems.map((item, i) => (
                  <motion.tr 
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="hover:bg-[#493ee5]/[0.02] transition-colors group cursor-default"
                  >
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-[#181c1e] group-hover:text-[#493ee5] transition-colors" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{item.queue_key}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-[#49607e]">
                        <CalendarIcon className="w-3.5 h-3.5 opacity-50" /> {new Date(item.joined_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-[#181c1e] bg-[#f1f4f7] px-2 py-0.5 rounded-md" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                        {item.token_number}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-[#181c1e] font-medium">
                        <Clock className="w-3.5 h-3.5 text-[#49607e] opacity-50" /> {item.serving_duration ? `${Math.floor(item.serving_duration / 60)}m` : "4m"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-[#49607e] hover:text-[#493ee5] transition-all p-1.5 rounded-lg hover:bg-[#493ee5]/5">
                          <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
        </div>

        {/* Mobile List View */}
        <div className="md:hidden divide-y divide-[#f1f4f7]">
          {historyItems.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-5 active:bg-[#f1f4f7] transition-colors"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="space-y-1">
                   <p className="text-[10px] font-extrabold text-[#493ee5] uppercase tracking-widest" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{item.token_number}</p>
                   <h3 className="text-sm font-bold text-[#181c1e] line-clamp-1">{item.queue_key}</h3>
                </div>
                <StatusBadge status={item.status} />
              </div>
              
              <div className="flex items-center justify-between mt-4">
                 <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#49607e]">
                       <CalendarIcon className="w-3 h-3 opacity-60" />
                       {new Date(item.joined_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#49607e]">
                       <Clock className="w-3 h-3 opacity-60" />
                       {item.serving_duration ? `${Math.floor(item.serving_duration / 60)}m` : "4m"}
                    </div>
                 </div>
                 <button className="w-8 h-8 rounded-lg bg-[#f1f4f7] flex items-center justify-center text-[#49607e]">
                    <ExternalLink className="w-3.5 h-3.5" />
                 </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Pagination/Summary */}
        <div className="px-6 py-4 bg-[#f7fafd] border-t border-[#e5e8eb] flex items-center justify-between">
           <p className="text-[10px] md:text-xs text-[#49607e] font-bold uppercase tracking-wide">Showing {historyItems.length} records</p>
           <div className="flex items-center gap-1.5">
              <button disabled className="p-2 bg-white rounded-lg ghost-border disabled:opacity-30">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button disabled className="p-2 bg-white rounded-lg ghost-border disabled:opacity-30">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}

function StatsBox({ title, value, desc, color, icon }: { title: string, value: string, desc: string, color: string, icon: React.ReactNode }) {
  const colorMap: Record<string, { bg: string, text: string, iconBg: string }> = {
    purple: { bg: "bg-[#493ee5]/5", text: "text-[#493ee5]", iconBg: "bg-white" },
    green: { bg: "bg-green-50", text: "text-green-600", iconBg: "bg-white" },
    blue: { bg: "bg-blue-50", text: "text-blue-600", iconBg: "bg-white" },
  };
  const c = colorMap[color];
  
  return (
    <div className={cn("p-5 rounded-2xl transition-all hover:shadow-ambient", c.bg)}>
       <div className="flex items-center justify-between mb-3">
          <div className={cn("p-2 rounded-lg shadow-sm", c.iconBg, c.text)}>{icon}</div>
          <TrendingUp className="w-3.5 h-3.5 opacity-20" />
       </div>
       <p className={cn("text-[11px] font-extrabold uppercase tracking-[0.15em] mb-1 opacity-80", c.text)} style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{title}</p>
       <h3 className={cn("text-3xl font-extrabold tracking-tighter mb-1", c.text)} style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{value}</h3>
       <p className="text-xs text-[#49607e] opacity-70">{desc}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed" || status === "serving") {
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-green-700 bg-green-50 px-2 py-0.5 rounded-md">
         <CheckCircle2 className="w-3 h-3" /> {status}
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-red-700 bg-red-50 px-2 py-0.5 rounded-md">
         <XCircle className="w-3 h-3" /> Cancelled
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-[#49607e] bg-[#f1f4f7] px-2 py-0.5 rounded-md">
       <HelpCircle className="w-3 h-3" /> {status}
    </span>
  );
}
