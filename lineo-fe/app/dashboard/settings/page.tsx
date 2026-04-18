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
  Camera
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface UserProfile {
  username: string;
  email: string;
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem("user");
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Settings</h1>
        <p className="text-[#49607e] text-sm font-medium mt-1">Manage your account preferences and security.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Nav Tabs */}
        <div className="lg:col-span-1 space-y-1">
           <SettingsNavItem icon={<User className="w-4 h-4" />} title="Profile" active />
           <SettingsNavItem icon={<Shield className="w-4 h-4" />} title="Security" />
           <SettingsNavItem icon={<Bell className="w-4 h-4" />} title="Notifications" />
           <SettingsNavItem icon={<CreditCard className="w-4 h-4" />} title="Billing" />
           <div className="pt-4">
              <SettingsNavItem icon={<UserPlus className="w-4 h-4" />} title="Refer & Earn" highlight />
           </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-6">
           {/* Profile Card */}
           <div className="bg-white rounded-2xl p-6 ghost-border">
              <div className="flex items-center gap-6 mb-8">
                 <div className="relative group">
                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-extrabold shadow-neobrutal group-hover:scale-105 transition-transform" style={{ background: 'linear-gradient(135deg, #493ee5, #635bff)', fontFamily: 'var(--font-manrope), sans-serif' }}>
                       {user?.username?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <button className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-white rounded-full flex items-center justify-center text-[#49607e] hover:text-[#493ee5] shadow-sm ghost-border hover:scale-110 transition-all">
                       <Camera className="w-3.5 h-3.5" />
                    </button>
                 </div>
                 <div>
                    <h3 className="text-xl font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{user?.username || "Quest User"}</h3>
                    <p className="text-[#49607e] text-sm font-medium">{user?.email || "quest@lineo.ai"}</p>
                    <div className="flex gap-2 mt-2">
                       <span className="px-2.5 py-0.5 bg-[#493ee5]/10 text-[#493ee5] text-[10px] font-bold uppercase rounded-full tracking-widest" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Premium</span>
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
                 
                 <div className="pt-4 flex justify-end gap-2">
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
           <div className="bg-white rounded-2xl p-5 ghost-border flex items-center justify-between group cursor-pointer hover:shadow-ambient transition-all">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all duration-300">
                    <Lock className="w-5 h-5" />
                 </div>
                 <div>
                    <h4 className="text-base font-bold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Password & Authentication</h4>
                    <p className="text-xs text-[#49607e]">Set up two-factor authentication or change credentials.</p>
                 </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#49607e] group-hover:text-[#493ee5] group-hover:translate-x-1 transition-all" />
           </div>

           {/* Danger Zone */}
           <div className="pt-4">
              <h3 className="text-[11px] font-extrabold text-red-600 uppercase tracking-[0.2em] mb-3" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Danger Zone</h3>
              <div className="bg-red-50/50 rounded-2xl p-5 ghost-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <div>
                    <h4 className="text-base font-bold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Delete Account</h4>
                    <p className="text-xs text-[#49607e]">Permanently remove your account. This is irreversible.</p>
                 </div>
                 <button className="px-5 py-2.5 border border-red-200 text-red-600 font-bold text-sm rounded-xl hover:bg-red-600 hover:text-white transition-all" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
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
