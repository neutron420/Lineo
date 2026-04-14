"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
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

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) setUser(JSON.parse(userData));
  }, []);

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-light text-stripe-navy tracking-tight">Settings</h1>
          <p className="text-stripe-slate text-lg font-light">Manage your account preferences and security configuration.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* Navigation Tabs (Vertical) */}
        <div className="lg:col-span-1 space-y-1">
           <SettingsNavItem icon={<User className="w-4 h-4" />} title="Profile" active />
           <SettingsNavItem icon={<Shield className="w-4 h-4" />} title="Security" />
           <SettingsNavItem icon={<Bell className="w-4 h-4" />} title="Notifications" />
           <SettingsNavItem icon={<CreditCard className="w-4 h-4" />} title="Billing" />
           <div className="pt-6">
              <SettingsNavItem icon={<UserPlus className="w-4 h-4" />} title="Refer & Earn" highlight />
           </div>
        </div>

        {/* Setting Content */}
        <div className="lg:col-span-3 space-y-8">
           {/* Profile Section */}
           <div className="stripe-card p-10 bg-white">
              <div className="flex items-center gap-8 mb-12">
                 <div className="relative group">
                    <div className="w-24 h-24 bg-stripe-purple rounded-3xl flex items-center justify-center text-white text-3xl font-bold font-display shadow-xl shadow-stripe-purple/30 group-hover:scale-105 transition-transform duration-300">
                       {user?.username?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <button className="absolute -bottom-2 -right-2 w-8 h-8 bg-white border border-stripe-border rounded-full flex items-center justify-center text-stripe-slate hover:text-stripe-purple shadow-sm hover:scale-110 transition-all">
                       <Camera className="w-4 h-4" />
                    </button>
                 </div>
                 <div>
                    <h3 className="text-2xl font-medium text-stripe-navy mb-1">{user?.username || "Quest User"}</h3>
                    <p className="text-stripe-slate text-[15px]">{user?.email || "quest@lineo.ai"}</p>
                    <div className="flex gap-2 mt-4">
                       <span className="px-3 py-1 bg-stripe-purple/10 text-stripe-purple text-[11px] font-bold uppercase rounded-full tracking-widest">Premium Plan</span>
                       <span className="px-3 py-1 bg-stripe-border/30 text-stripe-slate text-[11px] font-bold uppercase rounded-full tracking-widest">Active since 2024</span>
                    </div>
                 </div>
              </div>

              <div className="space-y-6 pt-6 border-t border-stripe-border">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputField label="Full Name" placeholder="R.K Singh" defaultValue={user?.username} />
                    <InputField label="Email Address" placeholder="rk@example.com" defaultValue={user?.email} icon={<Mail className="w-4 h-4" />} />
                    <InputField label="Phone Number" placeholder="+91 98765 43210" icon={<Smartphone className="w-4 h-4" />} />
                    <InputField label="Timezone" placeholder="UTC+5:30 (IST)" icon={<Globe className="w-4 h-4" />} />
                 </div>
                 
                 <div className="pt-6 flex justify-end gap-3">
                    <button className="px-6 py-2.5 bg-[#f6f9fc] text-stripe-navy font-medium rounded-xl hover:bg-stripe-border transition-all">
                       Discard
                    </button>
                    <button className="stripe-btn-primary px-8">
                       Save Changes
                    </button>
                 </div>
              </div>
           </div>

           {/* Security Quick Link */}
           <div className="stripe-card p-8 bg-white flex items-center justify-between group cursor-pointer hover:border-stripe-purple/30 transition-all">
              <div className="flex items-center gap-6">
                 <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all duration-300">
                    <Lock className="w-6 h-6" />
                 </div>
                 <div>
                    <h4 className="text-lg font-medium text-stripe-navy">Password & Authentication</h4>
                    <p className="text-sm text-stripe-slate">Set up two-factor authentication or change your security credentials.</p>
                 </div>
              </div>
              <ChevronRight className="w-6 h-6 text-stripe-slate group-hover:text-stripe-purple group-hover:translate-x-1 transition-all" />
           </div>

           {/* Danger Zone */}
           <div className="pt-8">
              <h3 className="text-sm font-bold text-red-600 uppercase tracking-widest mb-4">Danger Zone</h3>
              <div className="stripe-card p-8 bg-red-50/30 border-red-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
                 <div>
                    <h4 className="text-lg font-medium text-stripe-navy">Delete Account</h4>
                    <p className="text-sm text-stripe-slate">Permanently remove your account and all associated data. This action is irreversible.</p>
                 </div>
                 <button className="px-6 py-3 border border-red-200 text-red-600 font-bold rounded-xl hover:bg-red-600 hover:text-white transition-all">
                    Deactivate Account
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function SettingsNavItem({ icon, title, active, highlight }: any) {
  return (
    <button className={cn(
       "flex items-center gap-3 w-full px-5 py-3.5 rounded-xl transition-all duration-200 group text-left",
       active ? "bg-white text-stripe-purple shadow-sidebar-pill font-medium" : "text-stripe-slate hover:bg-white/50 hover:text-stripe-navy",
       highlight && "bg-stripe-purple text-white shadow-xl shadow-stripe-purple/30 hover:bg-stripe-purpleHover hover:scale-[1.02]"
    )}>
       <div className={cn(
         "transition-transform duration-300",
         active ? "text-stripe-purple" : "text-stripe-slate group-hover:text-stripe-navy",
         highlight && "text-white"
       )}>{icon}</div>
       <span className="text-[15px]">{title}</span>
    </button>
  );
}

function InputField({ label, placeholder, icon, defaultValue }: any) {
  return (
    <div className="space-y-2">
       <label className="text-xs font-bold text-stripe-slate uppercase tracking-wider pl-1">{label}</label>
       <div className="relative group">
          {icon && <div className="absolute left-4 top-1/2 -translate-y-1/2 text-stripe-slate group-focus-within:text-stripe-purple transition-colors">{icon}</div>}
          <input 
            type="text" 
            placeholder={placeholder} 
            defaultValue={defaultValue}
            className={cn(
               "w-full py-3 bg-[#f6f9fc] border border-transparent rounded-xl text-[15px] focus:bg-white focus:border-stripe-purple/20 focus:ring-4 focus:ring-stripe-purple/5 outline-none transition-all",
               icon ? "pl-12 pr-4" : "px-4"
            )}
          />
       </div>
    </div>
  );
}
