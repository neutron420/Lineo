"use client";

import React, { useState, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Building2, 
  UserPlus, 
  Mail, 
  Shield, 
  Trash2, 
  CheckCircle2, 
  Loader2,
  Lock,
  Settings as SettingsIcon,
  Users,
  X,
  User as UserIcon
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { toast } from "sonner";

interface StaffMember {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface Organization {
  id: number;
  name: string;
  org_type: string;
  address: string;
  pincode: string;
  state: string;
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as "profile" | "team") || "profile";
  const [activeTab, setActiveTab] = useState<"profile" | "team">(initialTab);
  const [org, setOrg] = useState<Organization | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({ username: "", email: "", password: "" });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const orgResp = await api.get("/org/my");
      setOrg(orgResp.data.data);
      setStaff([
        { id: 1, username: "admin_root", email: "admin@lineo.hq", role: "ADMIN" },
        { id: 2, username: "desk_operator_1", email: "op1@lineo.hq", role: "STAFF" },
      ]);
    } catch (err) {
      toast.error("Failed to load global configuration data");
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async () => {
    if (!newStaff.username || !newStaff.email || !newStaff.password) {
      toast.error("Required fields logically empty.");
      return;
    }
    setIsUpdating(true);
    try {
      await api.post("/admin/staff", newStaff);
      toast.success("New operative recruited successfully!");
      setShowAddStaff(false);
      setNewStaff({ username: "", email: "", password: "" });
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Recruitment protocol failed.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="w-10 h-10 text-[#493ee5] animate-spin" /></div>;

  return (
    <div className="max-w-[1200px] mx-auto space-y-8">
      <div>
         <h1 className="text-4xl font-black text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
           Global Config
         </h1>
         <p className="text-[#49607e] text-sm font-medium mt-1">Manage personnel and organizational parameters.</p>
      </div>

      <div className="flex gap-2 p-1.5 bg-white border border-[#e5e8eb] rounded-2xl w-fit shadow-sm">
         <button onClick={() => setActiveTab("profile")} className={cn("px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all", activeTab === "profile" ? "bg-[#181c1e] text-white shadow-lg" : "text-[#49607e] hover:bg-slate-50")}>Org Profile</button>
         <button onClick={() => setActiveTab("team")} className={cn("px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all", activeTab === "team" ? "bg-[#181c1e] text-white shadow-lg" : "text-[#49607e] hover:bg-slate-50")}>Personnel</button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "profile" ? (
          <motion.div key="profile" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
             <div className="lg:col-span-8 bg-white border border-[#e5e8eb] rounded-[32px] p-10 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <InputField label="Name" icon={Building2} value={org?.name || ""} />
                   <InputField label="Type" icon={SettingsIcon} value={org?.org_type || ""} />
                   <InputField label="Physical Map" icon={Building2} value={org?.address || ""} className="md:col-span-2" />
                </div>
             </div>
             <div className="lg:col-span-4 bg-[#181c1e] text-white rounded-[32px] p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10"><Shield className="w-24 h-24" /></div>
                <h3 className="text-xl font-black mb-6">Status: OPERATIONAL</h3>
                <div className="space-y-4">
                   <div className="flex items-center gap-3"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /><span className="text-[10px] font-black uppercase tracking-widest">Core Integrity: 100%</span></div>
                   <div className="flex items-center gap-3"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /><span className="text-[10px] font-black uppercase tracking-widest">Protocol Sync: Active</span></div>
                </div>
             </div>
          </motion.div>
        ) : (
          <motion.div key="team" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-[#e5e8eb] rounded-[32px] p-8 shadow-sm">
             <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-[#181c1e]">Active Personnel</h3>
                <button onClick={() => setShowAddStaff(true)} className="bg-[#493ee5] text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2"><UserPlus className="w-4 h-4" /> RECRUIT</button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {staff.map(member => (
                   <div key={member.id} className="p-6 bg-[#f7fafd] border border-transparent rounded-[28px] hover:border-[#e5e8eb] hover:bg-white hover:shadow-xl transition-all group">
                      <div className="flex items-center justify-between mb-4">
                         <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[#493ee5] border border-[#e5e8eb] font-black">{member.username[0].toUpperCase()}</div>
                         <span className="text-[8px] font-black uppercase bg-[#493ee5] text-white px-2 py-1 rounded-full">{member.role}</span>
                      </div>
                      <h4 className="font-extrabold text-[#181c1e]">{member.username}</h4>
                      <p className="text-xs text-[#49607e] mb-6">{member.email}</p>
                      <button className="w-full py-3 bg-white border border-[#e5e8eb] rounded-xl text-[10px] font-black text-[#49607e] hover:bg-[#181c1e] hover:text-white transition-all">MANAGE ACCESS</button>
                   </div>
                ))}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddStaff && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/5 backdrop-blur-xl">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-white border border-[#e5e8eb] rounded-[40px] shadow-2xl p-10 relative">
                 <button onClick={() => setShowAddStaff(false)} className="absolute top-8 right-8 p-2 text-slate-400 hover:bg-slate-50 rounded-full"><X className="w-5 h-5" /></button>
                 <div className="space-y-6">
                    <h2 className="text-2xl font-black text-[#181c1e] text-center">Recruit Operative</h2>
                    <div className="space-y-4">
                       <InputField label="Agent Username" icon={UserIcon} placeholder="agent_alpha" value={newStaff.username} onChange={(v:any) => setNewStaff(prev => ({ ...prev, username: v }))} />
                       <InputField label="Official Email" icon={Mail} placeholder="agent@org.hq" value={newStaff.email} onChange={(v:any) => setNewStaff(prev => ({ ...prev, email: v }))} />
                       <InputField label="Access Password" type="password" icon={Lock} placeholder="••••••••" value={newStaff.password} onChange={(v:any) => setNewStaff(prev => ({ ...prev, password: v }))} />
                    </div>
                    <button onClick={handleAddStaff} disabled={isUpdating} className="w-full bg-[#181c1e] text-white py-5 rounded-[24px] font-black text-[10px] uppercase tracking-widest shadow-2xl hover:bg-black transition-all">
                       {isUpdating ? "SYNCING..." : "COMMIT RECRUITMENT"}
                    </button>
                 </div>
              </motion.div>
           </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function OrgSettingsPage() {
  return (
    <Suspense fallback={<div className="flex h-[70vh] items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-[#493ee5]" /></div>}>
      <SettingsContent />
    </Suspense>
  );
}

function InputField({ label, type = "text", placeholder, icon: Icon, value, onChange, className }: any) {
  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-[10px] font-black uppercase tracking-widest text-[#49607e] flex items-center gap-2 ml-1">
        <Icon className="w-3.5 h-3.5" /> {label}
      </label>
      <input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange?.(e.target.value)} className="w-full px-5 py-4 bg-[#f7fafd] border border-[#e5e8eb] rounded-2xl outline-none focus:bg-white focus:border-[#493ee5] transition-all font-bold text-[#181c1e] text-sm" />
    </div>
  );
}
