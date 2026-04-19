"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight,
  Activity,
  Download
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell
} from "recharts";
import { cn } from "@/lib/utils";

const HOUR_DATA = [
  { time: "09 AM", count: 12 },
  { time: "10 AM", count: 28 },
  { time: "11 AM", count: 45 },
  { time: "12 PM", count: 32 },
  { time: "01 PM", count: 18 },
  { time: "02 PM", count: 24 },
  { time: "03 PM", count: 52 },
  { time: "04 PM", count: 38 },
  { time: "05 PM", count: 15 },
];

const WEEK_DATA = [
  { day: "Mon", processed: 142 },
  { day: "Tue", processed: 165 },
  { day: "Wed", processed: 189 },
  { day: "Thu", processed: 134 },
  { day: "Fri", processed: 210 },
  { day: "Sat", processed: 120 },
];

export default function OrgAnalyticsPage() {
  const [range, setRange] = useState("7d");

  return (
    <div className="max-w-[1400px] mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <h1 className="text-4xl font-black text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
             Strategic Intel
           </h1>
           <p className="text-[#49607e] text-sm font-medium mt-1">Deep analysis of operational throughput and latency vectors.</p>
        </div>
        
        <div className="flex items-center gap-3">
           <div className="flex bg-white border border-[#e5e8eb] p-1 rounded-xl shadow-sm">
              <button onClick={() => setRange("24h")} className={cn("px-4 py-2 text-[10px] font-black uppercase tracking-tight rounded-lg transition-all", range === "24h" ? "bg-[#181c1e] text-white" : "text-[#49607e] hover:bg-slate-50")}>24H</button>
              <button onClick={() => setRange("7d")} className={cn("px-4 py-2 text-[10px] font-black uppercase tracking-tight rounded-lg transition-all", range === "7d" ? "bg-[#181c1e] text-white" : "text-[#49607e] hover:bg-slate-50")}>7D</button>
              <button onClick={() => setRange("30d")} className={cn("px-4 py-2 text-[10px] font-black uppercase tracking-tight rounded-lg transition-all", range === "30d" ? "bg-[#181c1e] text-white" : "text-[#49607e] hover:bg-slate-50")}>30D</button>
           </div>
           <button className="p-3 bg-white border border-[#e5e8eb] rounded-xl text-[#49607e] shadow-sm"><Download className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <MetricCard label="Total Acquisitions" value="1,284" trend="+12%" trendUp icon={Users} color="blue" />
         <MetricCard label="Avg Latency (Min)" value="14.2" trend="-4%" trendUp={false} icon={Clock} color="amber" />
         <MetricCard label="System Integrity" value="98.4%" trend="+2.4%" trendUp icon={Activity} color="emerald" />
         <MetricCard label="Peak Intensity" value="03:20 PM" trend="Session High" trendUp icon={TrendingUp} color="indigo" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         <div className="lg:col-span-8 bg-white border border-[#e5e8eb] rounded-[32px] p-8 shadow-sm">
            <h3 className="text-xl font-black text-[#181c1e] mb-10">Heat Map Distribution</h3>
            <div className="h-[350px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={HOUR_DATA}>
                     <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#493ee5" stopOpacity={0.1}/><stop offset="95%" stopColor="#493ee5" stopOpacity={0}/></linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f4f7" />
                     <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#49607e', fontSize: 10, fontWeight: 700 }} />
                     <YAxis axisLine={false} tickLine={false} tick={{ fill: '#49607e', fontSize: 10, fontWeight: 700 }} />
                     <Tooltip contentStyle={{ backgroundColor: '#181c1e', border: 'none', borderRadius: '16px', color: '#fff' }} />
                     <Area type="monotone" dataKey="count" stroke="#493ee5" strokeWidth={4} fillOpacity={1} fill="url(#colorCount)" />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="lg:col-span-4 bg-[#181c1e] rounded-[32px] p-8 shadow-2xl relative overflow-hidden">
            <h3 className="text-xl font-black text-white mb-2">Weekly Velocity</h3>
            <p className="text-xs text-white/40 font-bold uppercase tracking-widest mb-10">Processed Entities</p>
            <div className="h-[280px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={WEEK_DATA}>
                     <Bar dataKey="processed" radius={[6, 6, 0, 0]}>
                        {WEEK_DATA.map((entry, index) => <Cell key={`cell-${index}`} fill={index === 4 ? "#493ee5" : "rgba(255,255,255,0.1)"} />)}
                     </Bar>
                     <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700 }} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, trend, trendUp, icon: Icon, color }: any) {
  const colors: any = {
    blue: "bg-[#493ee5]/5 text-[#493ee5] border-[#493ee5]/10",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100"
  };
  return (
    <div className="bg-white border border-[#e5e8eb] p-8 rounded-[32px] shadow-sm hover:shadow-xl transition-all group">
       <div className="flex items-center justify-between mb-6">
          <div className={cn("p-4 rounded-[20px] transition-transform group-hover:scale-110", colors[color])}><Icon className="w-6 h-6" /></div>
          <div className={cn("px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1", trendUp ? "text-emerald-600 bg-emerald-50" : "text-amber-600 bg-amber-50")}>
            {trendUp ? <ArrowUpRight className="w-3" /> : <ArrowDownRight className="w-3" />} {trend}
          </div>
       </div>
       <div className="text-[11px] font-black text-[#49607e] uppercase tracking-[0.2em] mb-1">{label}</div>
       <div className="text-3xl font-black text-[#181c1e] tracking-tighter" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{value}</div>
    </div>
  );
}
