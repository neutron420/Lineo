"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Users, 
  Zap, 
  BarChart3, 
  Calendar,
  CheckCircle2,
  XCircle,
  Timer,
  Award,
  Target,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface HistoryItem {
  queue_key: string;
  joined_at: string;
  token_number: string;
  serving_duration?: number;
  status: string;
}

export default function AnalyticsPage() {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("month");

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

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Computed analytics
  const totalVisits = historyItems.length;
  const completedVisits = historyItems.filter(h => h.status === "completed" || h.status === "serving").length;
  const cancelledVisits = historyItems.filter(h => h.status === "cancelled").length;
  const successRate = totalVisits > 0 ? Math.round((completedVisits / totalVisits) * 100) : 0;
  const avgWaitTime = historyItems.length > 0 
    ? Math.round(historyItems.reduce((acc, h) => acc + (h.serving_duration || 240), 0) / historyItems.length / 60) 
    : 0;
  const timeSavedHours = (totalVisits * 15 / 60).toFixed(1); // assume 15 min saved per digital queue vs physical

  // Weekly distribution (mock based on actual data days)
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weeklyData = weekDays.map((day, i) => {
    const count = historyItems.filter(h => new Date(h.joined_at).getDay() === (i + 1) % 7).length;
    return { day, count, height: Math.max(count * 20, 8) };
  });
  const maxWeekly = Math.max(...weeklyData.map(w => w.count), 1);

  // Top organizations
  const orgCounts: Record<string, number> = {};
  historyItems.forEach(h => {
    orgCounts[h.queue_key] = (orgCounts[h.queue_key] || 0) + 1;
  });
  const topOrgs = Object.entries(orgCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Monthly trend (last 6 months)
  const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const monthName = d.toLocaleString('default', { month: 'short' });
    const count = historyItems.filter(h => {
      const hd = new Date(h.joined_at);
      return hd.getMonth() === d.getMonth() && hd.getFullYear() === d.getFullYear();
    }).length;
    return { month: monthName, count };
  });
  const maxMonthly = Math.max(...monthlyTrend.map(m => m.count), 1);

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 bg-[#f1f4f7] rounded-md w-48 mb-2" />
            <div className="h-4 bg-[#f1f4f7] rounded-md w-72" />
          </div>
          <div className="h-8 bg-[#f1f4f7] rounded-xl w-48" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-[#f1f4f7] rounded-2xl ghost-border" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 h-[300px] bg-[#f1f4f7] rounded-2xl ghost-border" />
          <div className="lg:col-span-5 h-[300px] bg-[#f1f4f7] rounded-2xl ghost-border" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 h-[260px] bg-[#f1f4f7] rounded-2xl ghost-border" />
          <div className="lg:col-span-5 h-[260px] bg-[#f1f4f7] rounded-2xl ghost-border" />
        </div>
        <div className="h-[120px] bg-[#f1f4f7] rounded-2xl ghost-border w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Analytics</h1>
          <p className="text-[#49607e] text-sm font-medium mt-1">Insights into your queue usage patterns and time savings.</p>
        </div>
        <div className="flex items-center bg-[#f1f4f7] rounded-xl px-1.5 py-1 gap-1">
          {['week', 'month', 'year'].map((period) => (
            <button 
              key={period}
              className={cn(
                "rounded-lg h-8 px-4 text-xs font-bold capitalize transition-all",
                selectedPeriod === period 
                  ? "bg-white text-[#493ee5] shadow-sm" 
                  : "text-[#49607e] hover:text-[#181c1e]"
              )}
              style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
              onClick={() => setSelectedPeriod(period)}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Hero Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          label="Total Visits" 
          value={totalVisits.toString()} 
          change="+12%" 
          trend="up" 
          icon={<Users className="w-5 h-5" />} 
          color="purple" 
        />
        <MetricCard 
          label="Time Saved" 
          value={`${timeSavedHours}h`} 
          change="+8.2%" 
          trend="up" 
          icon={<Timer className="w-5 h-5" />} 
          color="green" 
        />
        <MetricCard 
          label="Success Rate" 
          value={`${successRate}%`} 
          change="+3%" 
          trend="up" 
          icon={<Target className="w-5 h-5" />} 
          color="blue" 
        />
        <MetricCard 
          label="Avg Wait Time" 
          value={`${avgWaitTime}m`} 
          change="-15%" 
          trend="down" 
          icon={<Clock className="w-5 h-5" />} 
          color="amber" 
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Weekly Activity Chart */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-4 md:p-6 ghost-border">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Weekly Activity</h3>
              <p className="text-xs text-[#49607e] mt-0.5">Queue visits by day of the week</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#493ee5] font-bold bg-[#493ee5]/5 px-3 py-1.5 rounded-lg" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
              <BarChart3 className="w-3.5 h-3.5" />
              This {selectedPeriod}
            </div>
          </div>
          
          <div className="flex items-end justify-between gap-3 h-[200px] px-2">
            {weeklyData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: `${(d.count / maxWeekly) * 160 + 16}px` }}
                  transition={{ delay: i * 0.08, duration: 0.6, ease: "easeOut" }}
                  className={cn(
                    "w-full rounded-xl transition-colors relative group cursor-pointer min-h-[16px]",
                    d.count > 0 ? "bg-[#493ee5]/15 hover:bg-[#493ee5]/25" : "bg-[#f1f4f7]"
                  )}
                >
                  {d.count > 0 && (
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: '100%' }}
                      transition={{ delay: i * 0.08 + 0.3, duration: 0.4 }}
                      className="absolute bottom-0 left-0 right-0 rounded-xl"
                      style={{ background: 'linear-gradient(180deg, #493ee5, #635bff)', maxHeight: '100%' }}
                    />
                  )}
                  {/* Tooltip */}
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#181c1e] text-white text-[10px] font-bold px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
                    {d.count} visits
                  </div>
                </motion.div>
                <span className="text-[11px] font-bold text-[#49607e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-4 md:p-6 ghost-border">
          <h3 className="text-base font-extrabold text-[#181c1e] mb-6" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Visit Outcomes</h3>
          
          <div className="space-y-5">
            {/* Donut-like visual */}
            <div className="flex items-center justify-center py-4">
              <div className="relative w-36 h-36">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f1f4f7" strokeWidth="3" />
                  <motion.circle 
                    cx="18" cy="18" r="15.915" fill="none" stroke="#493ee5" strokeWidth="3"
                    strokeDasharray={`${successRate} ${100 - successRate}`}
                    strokeLinecap="round"
                    initial={{ strokeDasharray: "0 100" }}
                    animate={{ strokeDasharray: `${successRate} ${100 - successRate}` }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{successRate}%</span>
                  <span className="text-[10px] text-[#49607e] font-bold uppercase tracking-wider">Success</span>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-[#f1f4f7] rounded-xl">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-[#493ee5]" />
                  <span className="text-sm font-bold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Completed</span>
                </div>
                <span className="text-sm font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{completedVisits}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-[#f1f4f7] rounded-xl">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <span className="text-sm font-bold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Cancelled</span>
                </div>
                <span className="text-sm font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{cancelledVisits}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-[#f1f4f7] rounded-xl">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-[#e5e8eb]" />
                  <span className="text-sm font-bold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Other</span>
                </div>
                <span className="text-sm font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{totalVisits - completedVisits - cancelledVisits}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Monthly Trend */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-4 md:p-6 ghost-border">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Monthly Trend</h3>
            <span className="text-xs text-[#49607e] font-medium">Last 6 months</span>
          </div>
          
          <div className="flex items-end justify-between gap-4 h-[160px] px-1">
            {monthlyTrend.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[11px] font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{m.count}</span>
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: `${(m.count / maxMonthly) * 120 + 12}px` }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="w-full rounded-xl min-h-[12px]"
                  style={{ 
                    background: i === monthlyTrend.length - 1 
                      ? 'linear-gradient(180deg, #493ee5, #635bff)' 
                      : '#e2dfff' 
                  }}
                />
                <span className="text-[10px] font-bold text-[#49607e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{m.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Institutions */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-4 md:p-6 ghost-border">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Top Institutions</h3>
            <Award className="w-4 h-4 text-[#493ee5]" />
          </div>
          
          {topOrgs.length > 0 ? (
            <div className="space-y-3">
              {topOrgs.map(([org, count], i) => (
                <motion.div 
                  key={org}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center justify-between p-3 bg-[#f1f4f7] rounded-xl hover:bg-[#e5e8eb] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-extrabold",
                      i === 0 ? "bg-[#493ee5] text-white shadow-neobrutal" : "bg-white text-[#49607e] ghost-border"
                    )} style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                      {i + 1}
                    </div>
                    <span className="text-sm font-bold text-[#181c1e] truncate max-w-[180px]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{org}</span>
                  </div>
                  <span className="text-xs font-bold text-[#493ee5] bg-[#493ee5]/10 px-2 py-0.5 rounded-md" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                    {count} visits
                  </span>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <BarChart3 className="w-8 h-8 text-[#e5e8eb] mx-auto mb-3" />
              <p className="text-sm text-[#49607e] font-medium">No data yet. Start using queues to see insights.</p>
            </div>
          )}
        </div>
      </div>

      {/* Performance Summary */}
      <div className="rounded-2xl p-4 md:p-6 bg-white ghost-border relative overflow-hidden group hover:shadow-ambient transition-shadow duration-300">
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div className="absolute -top-24 -left-24 w-48 md:w-64 h-48 md:h-64 bg-[#493ee5]/5 rounded-full blur-3xl group-hover:bg-[#493ee5]/10 transition-colors duration-700" />
          <div className="absolute bottom-0 right-0 w-32 md:w-48 h-32 md:h-48 bg-[#493ee5]/5 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h3 className="text-lg md:text-xl font-extrabold tracking-tight text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Performance Summary</h3>
            <p className="text-[#49607e] text-sm max-w-md font-medium">
              You&apos;re in the <span className="text-[#493ee5] font-extrabold bg-[#493ee5]/10 px-1.5 py-0.5 rounded-md">top 1%</span> of Lineo users. You&apos;ve saved an estimated <span className="text-[#181c1e] font-extrabold">{timeSavedHours} hours</span> by using digital queues this month.
            </p>
          </div>
          <div className="flex items-center gap-3 md:gap-4 overflow-x-auto no-scrollbar">
            <div className="text-center px-4 md:px-6 py-3 bg-[#f1f4f7] rounded-xl border border-[#e5e8eb] shrink-0">
              <p className="text-xl md:text-2xl font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{totalVisits}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#49607e]">Visits</p>
            </div>
            <div className="text-center px-4 md:px-6 py-3 bg-[#f1f4f7] rounded-xl border border-[#e5e8eb] shrink-0">
              <p className="text-xl md:text-2xl font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{successRate}%</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#49607e]">Success</p>
            </div>
            <div className="text-center px-4 md:px-6 py-3 bg-[#493ee5] text-white rounded-xl shadow-neobrutal shrink-0">
              <p className="text-xl md:text-2xl font-extrabold" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{timeSavedHours}h</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">Saved</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-Components ───────────────────────────────────

function MetricCard({ label, value, change, trend, icon, color }: { 
  label: string; value: string; change: string; trend: 'up' | 'down'; icon: React.ReactNode; color: string 
}) {
  const colorMap: Record<string, { bg: string, text: string, iconBg: string }> = {
    purple: { bg: "bg-[#493ee5]/5", text: "text-[#493ee5]", iconBg: "bg-[#493ee5]/10" },
    green: { bg: "bg-green-50", text: "text-green-600", iconBg: "bg-green-100" },
    blue: { bg: "bg-blue-50", text: "text-blue-600", iconBg: "bg-blue-100" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", iconBg: "bg-amber-100" },
  };
  const c = colorMap[color];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-5 ghost-border hover:shadow-ambient transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={cn("p-2 rounded-lg", c.iconBg, c.text)}>{icon}</div>
        <div className={cn(
          "flex items-center gap-0.5 text-[10px] md:text-[11px] font-bold px-1.5 md:px-2 py-0.5 rounded-md",
          trend === 'up' ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50'
        )}>
          {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {change}
        </div>
      </div>
      <p className="text-[10px] md:text-[11px] font-extrabold text-[#49607e] uppercase tracking-[0.15em] mb-1" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{label}</p>
      <p className="text-2xl md:text-3xl font-extrabold text-[#181c1e] tracking-tighter" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{value}</p>
    </motion.div>
  );
}
