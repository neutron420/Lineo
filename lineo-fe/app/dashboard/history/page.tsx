"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  History as HistoryIcon, 
  Calendar as CalendarIcon, 
  Clock, 
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Filter,
  Download,
  CheckCircle2,
  XCircle,
  HelpCircle
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

interface HistoryItem {
  queue_key: string;
  joined_at: string;
  token_number: string;
  serving_duration: number; // in seconds
  status: string;
}

const waitTimeData = [
  { day: 'Mon', time: 12 },
  { day: 'Tue', time: 18 },
  { day: 'Wed', time: 15 },
  { day: 'Thu', time: 25 },
  { day: 'Fri', time: 20 },
  { day: 'Sat', time: 10 },
  { day: 'Sun', time: 5 },
];

export default function HistoryPage() {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

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
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Visit History</h1>
          <p className="text-[#49607e] text-sm font-medium">Trace your professional movements and queue analytics.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
           <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#49607e] group-focus-within:text-[#493ee5] transition-colors" />
              <input 
                type="text" 
                placeholder="Search history..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-white rounded-xl border border-[#e5e8eb] text-sm font-medium focus:ring-4 focus:ring-[#493ee5]/5 focus:border-[#493ee5]/20 outline-none transition-all w-full md:w-64 shadow-sm"
              />
           </div>
           <button className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-[#e5e8eb] text-sm font-bold text-[#181c1e] hover:bg-[#f1f4f7] transition-all shadow-sm">
             <Filter className="w-4 h-4" /> Filter
           </button>
           <button className="flex items-center gap-2 px-4 py-2.5 bg-[#181c1e] rounded-xl text-sm font-bold text-white hover:bg-[#493ee5] transition-all shadow-md">
             <Download className="w-4 h-4" /> Export
           </button>
        </div>
      </div>

      {/* Analytics Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <StatsBox 
            title="Total Visits" 
            value={historyItems.length.toString()} 
            desc="Completed lifetime sessions" 
            color="purple" 
            icon={<HistoryIcon className="w-5 h-5" />}
         />
         <StatsBox 
            title="Avg. Wait Time" 
            value="14m" 
            desc="Across all institutions" 
            color="green" 
            icon={<Clock className="w-5 h-5" />}
         />
         <StatsBox 
            title="Time Saved" 
            value="3.2h" 
            desc="Efficiency vs. physical queues" 
            color="blue" 
            icon={<TrendingUp className="w-5 h-5" />}
         />
      </div>

      {/* Velocity Chart */}
      <div className="bg-white rounded-[32px] p-6 md:p-8 border border-[#e5e8eb] shadow-ambient">
         <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
               <h3 className="text-lg font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Visit Velocity</h3>
               <p className="text-[#49607e] text-xs font-bold uppercase tracking-wider opacity-60">Avg. Wait Time (Mins) vs. Day</p>
            </div>
            <div className="flex items-center gap-2">
               <span className="w-3 h-3 rounded-full bg-[#493ee5]" />
               <span className="text-[10px] font-black text-[#493ee5] uppercase tracking-widest">Wait Time</span>
            </div>
         </div>
         <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={waitTimeData}>
                  <defs>
                    <linearGradient id="colorWait" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#493ee5" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#493ee5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="day" 
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
        {historyItems.length > 0 ? (
          <>
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
          </>
        ) : (
          <div className="py-24 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-16 h-16 bg-[#f1f4f7] rounded-2xl flex items-center justify-center text-[#49607e]">
               <HistoryIcon className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>History is quiet</h3>
              <p className="text-[#49607e] max-w-[280px] mx-auto text-sm font-medium">Your activity trail will appear here once you complete or join sessions.</p>
            </div>
          </div>
        )}
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
