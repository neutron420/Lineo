"use client";

import React, { useState, useEffect } from "react";
import { 
  User, 
  Shield, 
  Bell, 
  CreditCard, 
  UserPlus, 
  ChevronRight,
  Globe,
  Smartphone,
  Mail,
  Lock,
  Camera,
  Zap,
  Crown,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";

interface UserProfile {
  username: string;
  email: string;
  subscription_tier?: string;
  daily_joins?: number;
  daily_appts?: number;
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const userData = sessionStorage.getItem("user");
    let parsedUser: UserProfile | null = null;
    if (userData) {
      try {
        parsedUser = JSON.parse(userData);
      } catch (e) {
        console.error("Failed to parse user data", e);
      }
    }
    void Promise.resolve().then(() => {
      setUser(parsedUser);
      setMounted(true);
    });
  }, []);

  if (!mounted) return null;

  const tierLimits: Record<string, { joins: number, appts: number, label: string, color: string }> = {
    basic: { joins: 3, appts: 2, label: "Basic", color: "#49607e" },
    starter: { joins: 3, appts: 2, label: "Basic", color: "#49607e" },
    plus: { joins: 15, appts: 10, label: "Plus", color: "#493ee5" },
    unlimited: { joins: 999, appts: 999, label: "Unlimited", color: "#493ee5" },
  };
  const tier = tierLimits[user?.subscription_tier || "basic"] || tierLimits.basic;
  const usedJoins = user?.daily_joins || 0;
  const usedAppts = user?.daily_appts || 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Settings</h1>
        <p className="text-[#49607e] text-sm font-medium mt-1">Manage your account preferences and security.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8">
        {/* Nav Tabs */}
        <div className="lg:col-span-1 flex lg:flex-col gap-1 overflow-x-auto no-scrollbar pb-2 lg:pb-0">
           <SettingsNavItem icon={<User className="w-4 h-4" />} title="Profile" active />
           <SettingsNavItem icon={<Shield className="w-4 h-4" />} title="Security" />
           <SettingsNavItem icon={<Bell className="w-4 h-4" />} title="Notifications" />
           <SettingsNavItem icon={<CreditCard className="w-4 h-4" />} title="Billing" />
           <div className="lg:pt-4">
              <SettingsNavItem icon={<UserPlus className="w-4 h-4" />} title="Refer & Earn" highlight />
           </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-6">
           {/* ── Subscription & Limits Card ── */}
           <div className="bg-white rounded-2xl ghost-border overflow-hidden">
              <div className="p-4 md:p-6 bg-gradient-to-br from-[#493ee5]/5 to-[#635bff]/5 border-b border-[#e5e8eb]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-neobrutal" style={{ background: 'linear-gradient(135deg, #493ee5, #635bff)' }}>
                      <Crown className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Subscription</h3>
                      <p className="text-xs text-[#49607e] font-medium">Your current plan and daily limits</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-[#493ee5]/10 text-[#493ee5] self-start" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                    <Zap className="w-3 h-3" />
                    {tier.label} Plan
                  </span>
                </div>
              </div>
              
              <div className="p-4 md:p-6 space-y-5">
                {/* Quota Bars */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-[#f8fafc] rounded-xl border border-[#e5e8eb]">
                    <div className="flex justify-between text-xs font-bold text-[#49607e] mb-2">
                      <span>Queue Joins Today</span>
                      <span className="text-[#181c1e] font-extrabold">{usedJoins} / {tier.joins === 999 ? "∞" : tier.joins}</span>
                    </div>
                    <div className="w-full bg-[#e5e8eb] rounded-full h-2 overflow-hidden">
                      <div className="bg-[#493ee5] h-full rounded-full transition-all duration-700" style={{ width: `${tier.joins === 999 ? 3 : Math.min((usedJoins / tier.joins) * 100, 100)}%` }} />
                    </div>
                  </div>
                  <div className="p-4 bg-[#f8fafc] rounded-xl border border-[#e5e8eb]">
                    <div className="flex justify-between text-xs font-bold text-[#49607e] mb-2">
                      <span>Appointments Today</span>
                      <span className="text-[#181c1e] font-extrabold">{usedAppts} / {tier.appts === 999 ? "∞" : tier.appts}</span>
                    </div>
                    <div className="w-full bg-[#fce7f3] rounded-full h-2 overflow-hidden">
                      <div className="bg-pink-500 h-full rounded-full transition-all duration-700" style={{ width: `${tier.appts === 999 ? 3 : Math.min((usedAppts / tier.appts) * 100, 100)}%` }} />
                    </div>
                  </div>
                </div>

                {/* Features list */}
                <div className="flex flex-wrap gap-2">
                  {[
                    tier.label !== "Basic" ? "Priority Notifications" : "Standard Alerts",
                    tier.label !== "Basic" ? "VIP Priority Passes" : "Basic Queue Access",
                    tier.label === "Unlimited" ? "24/7 Concierge" : "Email Support",
                  ].map((f, i) => (
                    <span key={i} className="text-[10px] font-bold text-[#49607e] bg-[#f1f4f7] px-2.5 py-1 rounded-lg uppercase tracking-wider border border-[#e5e8eb]">
                      ✓ {f}
                    </span>
                  ))}
                </div>

                <Link 
                  href="/dashboard/settings/billing"
                  className="flex items-center justify-center gap-2 w-full py-3 bg-[#181c1e] text-white rounded-xl text-sm font-bold hover:bg-[#493ee5] transition-all shadow-sm"
                  style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
                >
                  {tier.label === "Unlimited" ? "Manage Billing" : "Upgrade Plan"}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
           </div>

           {/* ── Profile Card ── */}
           <div className="bg-white rounded-2xl p-4 md:p-6 ghost-border">
              <div className="flex items-center gap-4 md:gap-6 mb-6 md:mb-8">
                 <div className="relative group">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center text-white text-xl md:text-2xl font-extrabold shadow-neobrutal group-hover:scale-105 transition-transform" style={{ background: 'linear-gradient(135deg, #493ee5, #635bff)', fontFamily: 'var(--font-manrope), sans-serif' }}>
                       {user?.username?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <button className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-white rounded-full flex items-center justify-center text-[#49607e] hover:text-[#493ee5] shadow-sm ghost-border hover:scale-110 transition-all">
                       <Camera className="w-3.5 h-3.5" />
                    </button>
                 </div>
                 <div>
                    <h3 className="text-lg md:text-xl font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{user?.username || "Quest User"}</h3>
                    <p className="text-[#49607e] text-sm font-medium">{user?.email || "quest@lineo.ai"}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                       <span className="px-2.5 py-0.5 bg-[#493ee5]/10 text-[#493ee5] text-[10px] font-bold uppercase rounded-full tracking-widest" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{tier.label}</span>
                       <span className="px-2.5 py-0.5 bg-[#f1f4f7] text-[#49607e] text-[10px] font-bold uppercase rounded-full tracking-widest">Active since 2024</span>
                    </div>
                 </div>
              </div>

              <div className="space-y-5 pt-5 border-t border-[#e5e8eb]">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField label="Full Name" placeholder="R.K Singh" defaultValue={user?.username} />
                    <InputField label="Email Address" placeholder="rk@example.com" defaultValue={user?.email} icon={<Mail className="w-3.5 h-3.5" />} />
                    <InputField label="Phone Number" placeholder="+91 98765 43210" icon={<Smartphone className="w-3.5 h-3.5" />} />
                    <InputField label="Timezone" placeholder="UTC+5:30 (IST)" icon={<Globe className="w-3.5 h-3.5" />} />
                 </div>
                 
                 <div className="pt-4 flex flex-col sm:flex-row justify-end gap-2">
                    <Button variant="ghost" className="h-10 px-5 rounded-xl text-sm font-bold text-[#49607e] bg-[#f1f4f7] hover:bg-[#e5e8eb]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                       Discard
                    </Button>
                    <Button onClick={() => toast.success("Settings saved!")} className="kinetic-btn-primary h-10 px-6 text-sm">
                       Save Changes
                    </Button>
                 </div>
              </div>
           </div>

           {/* Security Link */}
           <div className="bg-white rounded-2xl p-4 md:p-5 ghost-border flex items-center justify-between group cursor-pointer hover:shadow-ambient transition-all">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all duration-300">
                    <Lock className="w-5 h-5" />
                 </div>
                 <div>
                    <h4 className="text-sm md:text-base font-bold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Password & Authentication</h4>
                    <p className="text-xs text-[#49607e]">Set up two-factor authentication or change credentials.</p>
                 </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#49607e] group-hover:text-[#493ee5] group-hover:translate-x-1 transition-all" />
           </div>

           {/* Danger Zone */}
           <div className="pt-4">
              <h3 className="text-[11px] font-extrabold text-red-600 uppercase tracking-[0.2em] mb-3" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Danger Zone</h3>
              <div className="bg-red-50/50 rounded-2xl p-4 md:p-5 ghost-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <div>
                    <h4 className="text-sm md:text-base font-bold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Delete Account</h4>
                    <p className="text-xs text-[#49607e]">Permanently remove your account. This is irreversible.</p>
                 </div>
                 <button className="px-5 py-2.5 border border-red-200 text-red-600 font-bold text-sm rounded-xl hover:bg-red-600 hover:text-white transition-all shrink-0" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                    Deactivate Account
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function SettingsNavItem({ icon, title, active, highlight }: { icon: React.ReactNode, title: string, active?: boolean, highlight?: boolean }) {
  return (
    <button className={cn(
       "flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200 group text-left text-sm",
       active ? "bg-white text-[#493ee5] shadow-sm font-bold ghost-border" : "text-[#49607e] hover:bg-white/60 hover:text-[#181c1e]",
       highlight && "bg-[#493ee5] text-white shadow-neobrutal hover:bg-[#493ee5]"
    )} style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
       <div className={cn(
         "transition-transform duration-300",
         active ? "text-[#493ee5]" : "text-[#49607e] group-hover:text-[#181c1e]",
         highlight && "text-white"
       )}>{icon}</div>
       <span>{title}</span>
    </button>
  );
}

function InputField({ label, placeholder, icon, defaultValue }: { label: string, placeholder: string, icon?: React.ReactNode, defaultValue?: string }) {
  return (
    <div className="space-y-1.5">
       <label className="text-[11px] font-extrabold text-[#49607e] uppercase tracking-[0.15em] pl-0.5" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{label}</label>
       <div className="relative group">
          {icon && <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#49607e] group-focus-within:text-[#493ee5] transition-colors">{icon}</div>}
          <input 
            type="text" 
            placeholder={placeholder} 
            defaultValue={defaultValue}
            className={cn(
               "w-full py-3 bg-[#f1f4f7] rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#493ee5]/10 outline-none transition-all",
               icon ? "pl-10 pr-4" : "px-4"
            )}
          />
       </div>
    </div>
  );
}
