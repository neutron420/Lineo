"use client";

import React, { useEffect, useState } from "react";
import {
  Users,
  Building2,
  TrendingUp,
  AlertCircle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  BarChart3,
  Activity,
  ArrowUpRight,
  RefreshCw,
  Map as MapIcon,
  CreditCard
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, Label,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

function AnimatedCounter({ value, label, icon: Icon, color, limit = 4 }: { 
  value: number; label: string; icon: React.ElementType; color: string; limit?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) return;
    const totalDuration = 1000;
    const increment = end / (totalDuration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value]);

  const isCapped = displayValue > limit;
  const displayText = isCapped ? `${limit}+` : displayValue;

  return (
    <div className="bg-white rounded-2xl border border-transparent shadow-ambient p-5 hover:shadow-neobrutal transition-all relative overflow-hidden group">
      <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-[0.03] transition-transform duration-700 group-hover:scale-150`} style={{ backgroundColor: color }} />
      <div className="flex items-center justify-between relative z-10">
        <div className="p-2.5 rounded-xl border border-transparent" style={{ backgroundColor: `${color}15` }}>
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        {isCapped && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 animate-pulse uppercase tracking-wider">
            Critical
          </span>
        )}
      </div>
      <div className="mt-4 relative z-10">
        <p className={`text-4xl font-black transition-all duration-300 ${isCapped ? 'text-red-500 scale-105 origin-left tracking-tighter' : 'text-[#181c1e] tracking-tighter'}`} style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
          {displayText}
        </p>
        <p className="text-sm font-bold text-[#49607e] mt-1">{label}</p>
      </div>
    </div>
  );
}

interface DashboardData {
  organizations: number;
  users: {
    end_users: number;
    staff: number;
    admins: number;
    total: number;
  };
  unverified_institutions: number;
  peak_active_queues: number;
  banned_violators: number;
  monthly_volume: { month: string; count: number }[];
  enterprise_categories: { label: string; count: number }[];
  audit_logs: { id: number; action: string; admin: string; time: string }[];
}

export default function SystemAdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  const fetchData = async () => {
     setLoading(true);
     try {
       const res = await api.get("/admin/dashboard");
       if (res.data?.data) {
         setData(res.data.data);
       }
     } catch (err) {
       console.error("Dashboard fetch error:", err);
     } finally {
       setLoading(false);
     }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const monthlyActivity = data?.monthly_volume || [];
  const userPieData = data?.users ? [
    { name: "End Users", value: data.users.end_users, color: "#493ee5" },
    { name: "Staff", value: data.users.staff, color: "#06b6d4" },
    { name: "System Admin", value: data.users.admins, color: "#ef4444" },
  ] : [];
  const categoryData = data?.enterprise_categories || [];
  const recentLogs = data?.audit_logs || [];
  const totalUsersText = data?.users ? 
    (data.users.total > 1000 ? (data.users.total/1000).toFixed(1) + "K" : data.users.total) : "0";

  if (loading && !data) {
    return (
      <div className="space-y-6 w-full animate-pulse">
         <div className="flex justify-between">
            <div>
               <Skeleton className="h-8 w-64 mb-2 rounded-lg" />
               <Skeleton className="h-4 w-48 rounded-md" />
            </div>
            <Skeleton className="h-10 w-32 rounded-xl" />
         </div>
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-32 rounded-2xl w-full" />
            <Skeleton className="h-32 rounded-2xl w-full" />
            <Skeleton className="h-32 rounded-2xl w-full" />
            <Skeleton className="h-32 rounded-2xl w-full" />
         </div>
         <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Skeleton className="xl:col-span-2 h-96 rounded-3xl w-full" />
            <Skeleton className="h-96 rounded-3xl w-full" />
         </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Lineo Global Metrics</h1>
          <p className="text-[#49607e] text-sm font-medium mt-1">Platform overview and infrastructure alerts.</p>
        </div>
        <button onClick={fetchData} className="inline-flex items-center gap-2 px-4 py-2 bg-white ghost-border rounded-lg text-[#181c1e] hover:bg-[#f7fafd] shadow-sm font-bold text-sm transition-all" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
          <RefreshCw className="h-4 w-4 text-[#493ee5]" /> Force Sync
        </button>
      </div>

      {/* Hero Action Layer based on Sharebite */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnimatedCounter value={data?.unverified_institutions || 0} label="Unverified Institutions" icon={ShieldAlert} color="#ef4444" />
        <AnimatedCounter value={data?.peak_active_queues || 0} label="Peak Active Queues" icon={Activity} color="#f97316" />
        <AnimatedCounter value={data?.banned_violators || 0} label="Banned Violators" icon={ShieldAlert} color="#ec4899" limit={2} />
        
        <div className="bg-gradient-to-br from-[#493ee5] to-[#635bff] rounded-2xl p-5 flex flex-col justify-between text-white lg:col-span-1 group cursor-pointer hover:shadow-lg transition-all shadow-neobrutal border border-white/10">
           <div className="flex items-center justify-between">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                 <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <ArrowUpRight className="h-5 w-5 opacity-50 group-hover:opacity-100 transition-opacity text-white" />
           </div>
           <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-widest text-[#f1f4f7]/80 mb-1">Root Terminal</p>
              <p className="text-lg font-extrabold tracking-tight text-white" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Verify Approvals</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-3xl border border-transparent ghost-border p-6 shadow-ambient">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Network Volume</h2>
              <p className="text-sm text-[#49607e] font-medium">Tickets processed over the last 6 months</p>
            </div>
            <div className="flex items-center gap-1.5 bg-[#493ee5]/10 text-[#493ee5] text-xs font-bold px-3 py-1.5 rounded-full" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
              <TrendingUp className="h-3.5 w-3.5" /> High Volume
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={monthlyActivity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                   <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#493ee5" stopOpacity={0.3} />
                     <stop offset="95%" stopColor="#493ee5" stopOpacity={0} />
                   </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f4f7" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#49607e", fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#49607e", fontWeight: 700 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "#181c1e", color: "white", border: "none", borderRadius: "12px", fontSize: "12px", fontWeight: "bold" }} />
                <Area type="monotone" dataKey="count" stroke="#493ee5" strokeWidth={3} fill="url(#colorUsage)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-transparent ghost-border p-6 flex flex-col shadow-ambient">
          <div className="mb-6 text-center">
            <h2 className="text-base font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Population</h2>
            <p className="text-sm text-[#49607e] font-medium">Active accounts by role</p>
          </div>
          <div className="flex-1 min-h-[250px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={userPieData} innerRadius={70} outerRadius={100} paddingAngle={4} dataKey="value" stroke="none">
                  {userPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                            <tspan x={viewBox.cx} y={viewBox.cy} className="fill-[#493ee5] text-3xl font-extrabold" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                              {totalUsersText}
                            </tspan>
                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-[#49607e] text-[10px] font-extrabold uppercase tracking-widest">
                              Accounts
                            </tspan>
                          </text>
                        );
                      }
                    }}
                  />
                </Pie>
                <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 10px 25px rgba(0,0,0,0.1)", fontWeight: "bold" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center flex-wrap gap-x-6 gap-y-2 mt-4">
            {userPieData.map((p) => (
              <div key={p.name} className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="text-xs font-extrabold text-[#49607e]">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-transparent ghost-border p-6 shadow-ambient">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Enterprise Categories</h2>
              <p className="text-sm text-[#49607e] font-medium">Platform reliance by industry</p>
            </div>
            <BarChart3 className="h-5 w-5 text-[#49607e]" />
          </div>
          <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={categoryData} layout="vertical" margin={{ left: -10 }}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#f1f4f7" horizontal={false} />
                 <XAxis type="number" tick={{ fontSize: 11, fill: "#49607e", fontWeight: 700 }} axisLine={false} tickLine={false} />
                 <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: "#181c1e", fontWeight: 700 }} width={100} axisLine={false} tickLine={false} />
                 <Tooltip cursor={{ fill: "#f1f4f7" }} contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 10px 25px rgba(0,0,0,0.1)", fontWeight: "bold" }} />
                 <Bar dataKey="count" name="SaaS Instances" radius={[0, 8, 8, 0]} barSize={24}>
                   {categoryData.map((_: Record<string, unknown>, idx: number) => (<Cell key={idx} fill={idx === 0 ? "#181c1e" : idx === 1 ? "#493ee5" : idx === 2 ? "#eab308" : "#ec4899"} />))}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-transparent ghost-border p-6 shadow-ambient flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>System Audit Logs</h2>
              <p className="text-sm text-[#49607e] font-medium">Critical events across the cluster</p>
            </div>
            <Activity className="h-5 w-5 text-[#49607e]" />
          </div>
          <div className="divide-y divide-[#e5e8eb] flex-1 overflow-y-auto pr-2 custom-scrollbar">
             {recentLogs.map((log: { id: React.Key | null | undefined; admin: React.ReactNode; action: React.ReactNode; time: React.ReactNode; }) => (
                <div key={log.id} className="py-3 flex items-center gap-4 hover:bg-[#f7fafd] transition-colors rounded-xl px-2">
                   <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", 
                     log.admin === 'Root' ? 'bg-red-50 text-red-600' : 'bg-[#f1f4f7] text-[#181c1e]'
                   )}>
                      {log.admin === 'Root' ? <ShieldAlert className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
                   </div>
                   <div className="flex-1 min-w-0">
                      <p className="text-sm font-extrabold text-[#181c1e] truncate" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{log.action}</p>
                      <p className="text-xs text-[#49607e] font-medium">Actor: {log.admin}</p>
                   </div>
                   <div className="text-xs font-bold text-[#49607e] bg-[#f1f4f7] px-2.5 py-1 rounded-md">{log.time}</div>
                </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
}
