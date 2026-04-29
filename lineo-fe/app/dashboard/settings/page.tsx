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
  ArrowRight,
  Maximize2,
  X,
  Loader2,
  Check,
  UserIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";
import api from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera as CameraIcon } from "lucide-react";

interface UserProfile {
  id?: number;
  username: string;
  email: string;
  phone_number?: string;
  timezone?: string;
  subscription_tier?: string;
  daily_joins?: number;
  daily_appts?: number;
  avatar_url?: string;
  created_at?: string;
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("Profile");
  
  // Form state
  const [isUploading, setIsUploading] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  
  const [passwordData, setPasswordData] = useState({
    old_password: "",
    new_password: "",
    confirm_password: ""
  });
  
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    phone_number: "",
    timezone: "",
    avatar_url: ""
  });

  useEffect(() => {
    const userData = sessionStorage.getItem("user");
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setFormData({
          username: parsedUser.username || "",
          email: parsedUser.email || "",
          phone_number: parsedUser.phone_number || "",
          timezone: parsedUser.timezone || "UTC+5:30 (IST)",
          avatar_url: parsedUser.avatar_url || ""
        });
      } catch (e) {
        console.error("Failed to parse user data", e);
      }
    }
    setMounted(true);
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      // Logic to update profile
      const response = await api.put("/users/profile", formData);
      if (response.data?.success) {
        toast.success("Profile updated successfully!");
        // Update session storage
        const updatedUser = { ...user, ...formData };
        sessionStorage.setItem("user", JSON.stringify(updatedUser));
        setUser(updatedUser as UserProfile);
      } else {
        toast.error(response.data?.message || "Failed to update profile");
      }
    } catch (err: any) {
      console.error("Update failed:", err);
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement> | Blob) => {
    let file: File | Blob | undefined;
    if ("target" in e) {
      file = e.target.files?.[0];
    } else {
      file = e;
    }
    
    if (!file) return;

    setIsUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file instanceof File ? file : new File([file], "camera-capture.jpg", { type: "image/jpeg" }));
      const res = await api.post("/upload", formDataUpload, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      const newUrl = res.data.data.url;
      
      // Update locally
      setFormData(prev => ({ ...prev, avatar_url: newUrl }));
      
      // Update on backend
      await api.put("/users/profile", { avatar_url: newUrl });
      
      // Update session storage
      const updatedUser = { ...user, avatar_url: newUrl };
      sessionStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser as UserProfile);
      
      // Notify other components (Header)
      window.dispatchEvent(new Event("user-updated"));
      
      setShowCheck(true);
      setTimeout(() => setShowCheck(false), 3000);
      toast.success("Profile picture updated!");
      setIsCameraOpen(false);
    } catch (err: any) {
      console.error("Upload failed", err);
      const msg = err.response?.data?.message || "Failed to upload avatar";
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await api.post("/users/change-password", {
        old_password: passwordData.old_password,
        new_password: passwordData.new_password
      });
      toast.success("Password updated successfully!");
      setIsPasswordModalOpen(false);
      setPasswordData({ old_password: "", new_password: "", confirm_password: "" });
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    setLoading(true);
    try {
      await api.delete("/users/deactivate");
      toast.success("Account deactivated");
      sessionStorage.clear();
      window.location.href = "/user/login";
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to deactivate account");
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      toast.error("Camera access denied or not available");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          handleAvatarUpload(blob);
          stopCamera();
        }
      }, "image/jpeg", 0.9);
    }
  };

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
           <SettingsNavItem icon={<User className="w-4 h-4" />} title="Profile" active={activeTab === "Profile"} onClick={() => setActiveTab("Profile")} />
           <SettingsNavItem icon={<Shield className="w-4 h-4" />} title="Security" active={activeTab === "Security"} onClick={() => setActiveTab("Security")} />
           <SettingsNavItem icon={<Bell className="w-4 h-4" />} title="Notifications" active={activeTab === "Notifications"} onClick={() => setActiveTab("Notifications")} />
           <SettingsNavItem icon={<CreditCard className="w-4 h-4" />} title="Billing" active={activeTab === "Billing"} onClick={() => setActiveTab("Billing")} />
           <div className="lg:pt-4">
              <SettingsNavItem icon={<UserPlus className="w-4 h-4" />} title="Refer & Earn" highlight />
           </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-6">
           {activeTab === "Profile" && (
             <>
               {/* ── Subscription & Limits Card ── */}
               {/* ... (Existing code for Subscription card) */}
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
                        <div 
                          className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center text-white text-xl md:text-2xl font-extrabold shadow-neobrutal group-hover:scale-105 transition-transform overflow-hidden cursor-pointer" 
                          style={{ background: 'linear-gradient(135deg, #493ee5, #635bff)', fontFamily: 'var(--font-manrope), sans-serif' }}
                          onClick={() => setIsPreviewOpen(true)}
                        >
                           {formData.avatar_url ? (
                             <img src={formData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                           ) : (
                             user?.username?.charAt(0).toUpperCase() || "U"
                           )}
                           <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Maximize2 className="w-6 h-6 text-white" />
                           </div>
                        </div>
                         <div className="absolute -bottom-1.5 -right-1.5 flex gap-1">
                            <label className="w-7 h-7 bg-white rounded-full flex items-center justify-center text-[#49607e] hover:text-[#493ee5] shadow-sm ghost-border hover:scale-110 transition-all cursor-pointer overflow-hidden">
                               <input type="file" className="hidden" onChange={handleAvatarUpload} accept="image/*" />
                               {isUploading ? (
                                 <Loader2 className="w-3.5 h-3.5 text-[#493ee5] animate-spin" />
                               ) : showCheck ? (
                                 <Check className="w-3.5 h-3.5 text-green-500 animate-bounce" />
                               ) : (
                                 <UserIcon className="w-3.5 h-3.5" />
                               )}
                            </label>
                            <button 
                              onClick={startCamera}
                              className="w-7 h-7 bg-[#493ee5] rounded-full flex items-center justify-center text-white shadow-sm hover:scale-110 transition-all"
                            >
                               <Camera className="w-3.5 h-3.5" />
                            </button>
                         </div>
                      </div>

                      {/* Camera Capture Modal */}
                      <Dialog open={isCameraOpen} onOpenChange={(open) => !open && stopCamera()}>
                        <DialogContent className="max-w-[95vw] sm:max-w-md p-0 overflow-hidden bg-black rounded-3xl border-none">
                          <div className="relative aspect-[3/4] w-full bg-black flex items-center justify-center">
                             <video 
                               ref={videoRef} 
                               autoPlay 
                               playsInline 
                               className="w-full h-full object-cover"
                             />
                             <canvas ref={canvasRef} className="hidden" />
                             
                             <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-8">
                                <button 
                                  onClick={stopCamera}
                                  className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20"
                                >
                                   <X className="w-6 h-6" />
                                </button>
                                <button 
                                  onClick={capturePhoto}
                                  className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-2xl scale-100 active:scale-90 transition-transform"
                                >
                                   <div className="w-16 h-16 rounded-full border-4 border-black/5" />
                                </button>
                                <div className="w-12 h-12" /> {/* Spacer */}
                             </div>
                             
                             <div className="absolute top-6 left-0 right-0 text-center">
                                <span className="px-4 py-1.5 bg-black/40 backdrop-blur-md rounded-full text-white text-xs font-bold uppercase tracking-widest border border-white/10">
                                   Camera Preview
                                </span>
                             </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                     {/* Avatar Full View Modal */}
                     <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                       <DialogContent className="max-w-[90vw] sm:max-w-md p-0 overflow-hidden bg-transparent border-none shadow-none">
                         <div className="relative aspect-square w-full rounded-3xl overflow-hidden bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-2xl">
                            {formData.avatar_url ? (
                              <img src={formData.avatar_url} alt="Full view" className="w-full h-full object-contain" />
                            ) : (
                              <div className="text-white text-8xl font-black opacity-20">{user?.username?.charAt(0).toUpperCase()}</div>
                            )}
                            <button 
                              onClick={() => setIsPreviewOpen(false)}
                              className="absolute top-4 right-4 w-10 h-10 bg-black/40 text-white rounded-full flex items-center justify-center hover:bg-black/60 transition-colors"
                            >
                              <X className="w-5 h-5" />
                            </button>
                         </div>
                       </DialogContent>
                     </Dialog>

                     <div>
                        <h3 className="text-lg md:text-xl font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{user?.username || "Quest User"}</h3>
                        <p className="text-[#49607e] text-sm font-medium">{user?.email || "quest@lineo.ai"}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                           <span className="px-2.5 py-0.5 bg-[#493ee5]/10 text-[#493ee5] text-[10px] font-bold uppercase rounded-full tracking-widest" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{tier.label}</span>
                           <span className="px-2.5 py-0.5 bg-[#f1f4f7] text-[#49607e] text-[10px] font-bold uppercase rounded-full tracking-widest">Active since {user?.created_at ? new Date(user.created_at).getFullYear() : '2024'}</span>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-5 pt-5 border-t border-[#e5e8eb]">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputField 
                          label="Full Name" 
                          placeholder="Your Name" 
                          value={formData.username} 
                          onChange={(val) => setFormData({...formData, username: val})} 
                        />
                        <InputField 
                          label="Email Address" 
                          placeholder="email@example.com" 
                          value={formData.email} 
                          onChange={(val) => setFormData({...formData, email: val})} 
                          icon={<Mail className="w-3.5 h-3.5" />} 
                        />
                        <PhoneInputField 
                          label="Phone Number" 
                          value={formData.phone_number} 
                          onChange={(val) => setFormData({...formData, phone_number: val})} 
                        />
                        <InputField 
                          label="Timezone" 
                          placeholder="UTC+5:30 (IST)" 
                          value={formData.timezone} 
                          onChange={(val) => setFormData({...formData, timezone: val})} 
                          icon={<Globe className="w-3.5 h-3.5" />} 
                        />
                     </div>
                     
                     <div className="pt-4 flex flex-col sm:flex-row justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          className="h-10 px-5 rounded-xl text-sm font-bold text-[#49607e] bg-[#f1f4f7] hover:bg-[#e5e8eb]" 
                          style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
                          onClick={() => {
                            if (user) {
                              setFormData({
                                username: user.username || "",
                                email: user.email || "",
                                phone_number: user.phone_number || "",
                                timezone: user.timezone || "UTC+5:30 (IST)",
                                avatar_url: user.avatar_url || ""
                              });
                            }
                          }}
                        >
                           Discard
                        </Button>
                        <Button 
                          onClick={handleSave} 
                          disabled={loading}
                          className="kinetic-btn-primary h-10 px-6 text-sm"
                        >
                           {loading ? "Saving..." : "Save Changes"}
                        </Button>
                     </div>
                  </div>
               </div>

               {/* Security Link Quick Access */}
               <div onClick={() => setActiveTab("Security")} className="bg-white rounded-2xl p-4 md:p-5 ghost-border flex items-center justify-between group cursor-pointer hover:shadow-ambient transition-all">
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
             </>
           )}

           {activeTab === "Security" && (
             <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="bg-white rounded-2xl p-6 ghost-border">
                   <h3 className="text-lg font-extrabold text-[#181c1e] mb-6" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Security Settings</h3>
                   <div className="space-y-4">
                      <div className="p-4 rounded-xl border border-[#e5e8eb] flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <Lock className="w-5 h-5 text-[#493ee5]" />
                            <div>
                               <p className="text-sm font-bold text-[#181c1e]">Two-Factor Authentication</p>
                               <p className="text-xs text-[#49607e]">Add an extra layer of security to your account.</p>
                            </div>
                         </div>
                         <Button variant="outline" className="text-xs font-bold h-8 rounded-lg">Enable</Button>
                      </div>
                      <div className="p-4 rounded-xl border border-[#e5e8eb] flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <Shield className="w-5 h-5 text-[#493ee5]" />
                            <div>
                               <p className="text-sm font-bold text-[#181c1e]">Change Password</p>
                               <p className="text-xs text-[#49607e]">Last changed 3 months ago.</p>
                            </div>
                         </div>
                         <Button 
                           variant="outline" 
                           className="text-xs font-bold h-8 rounded-lg"
                           onClick={() => setIsPasswordModalOpen(true)}
                         >
                            Update
                         </Button>
                      </div>
                   </div>
                </div>

                {/* Change Password Modal */}
                <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
                  <DialogContent className="max-w-md p-6 rounded-3xl">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-extrabold" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Change Password</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                       <InputField 
                         label="Current Password" 
                         type="password" 
                         placeholder="••••••••"
                         value={passwordData.old_password} 
                         onChange={(v) => setPasswordData({...passwordData, old_password: v})} 
                       />
                       <InputField 
                         label="New Password" 
                         type="password" 
                         placeholder="••••••••"
                         value={passwordData.new_password} 
                         onChange={(v) => setPasswordData({...passwordData, new_password: v})} 
                       />
                       <InputField 
                         label="Confirm New Password" 
                         type="password" 
                         placeholder="••••••••"
                         value={passwordData.confirm_password} 
                         onChange={(v) => setPasswordData({...passwordData, confirm_password: v})} 
                       />
                       <Button 
                         onClick={handleChangePassword} 
                         disabled={loading}
                         className="kinetic-btn-primary w-full h-12 mt-2"
                       >
                         {loading ? "Updating..." : "Update Password"}
                       </Button>
                    </div>
                  </DialogContent>
                </Dialog>
             </div>
           )}

           {activeTab === "Notifications" && (
             <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="bg-white rounded-2xl p-6 ghost-border">
                   <h3 className="text-lg font-extrabold text-[#181c1e] mb-6" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Notification Preferences</h3>
                   <div className="space-y-6">
                      <NotificationToggle title="Email Notifications" description="Receive updates about your queue status via email." enabled />
                      <NotificationToggle 
                        title="Push Notifications" 
                        description="Get real-time alerts on your browser or mobile device." 
                        enabled={false} 
                        onChange={async (enabled) => {
                          if (enabled) {
                            const { initPushNotifications } = await import("@/lib/push");
                            await initPushNotifications();
                          }
                        }}
                      />
                      <NotificationToggle title="SMS Alerts" description="Important queue and appointment reminders via SMS." />
                   </div>
                </div>
             </div>
           )}

           {activeTab === "Billing" && (
              <div className="py-12 text-center bg-white rounded-3xl ghost-border">
                <CreditCard className="w-12 h-12 text-[#493ee5]/20 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-[#181c1e]">Billing Details</h3>
                <p className="text-sm text-[#49607e] mb-6">Redirecting to our secure payment portal...</p>
                <Link href="/dashboard/settings/billing" className="text-[#493ee5] font-black text-xs uppercase tracking-widest hover:underline">Click here if not redirected</Link>
              </div>
           )}

           {/* Danger Zone */}
           <div className="pt-4">
              <h3 className="text-[11px] font-extrabold text-red-600 uppercase tracking-[0.2em] mb-3" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Danger Zone</h3>
              <div className="bg-red-50/50 rounded-2xl p-4 md:p-5 ghost-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <div>
                    <h4 className="text-sm md:text-base font-bold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Delete Account</h4>
                    <p className="text-xs text-[#49607e]">Permanently remove your account. This is irreversible.</p>
                 </div>
                 <button 
                   onClick={() => setIsDeactivateModalOpen(true)}
                   className="px-5 py-2.5 border border-red-200 text-red-600 font-bold text-sm rounded-xl hover:bg-red-600 hover:text-white transition-all shrink-0" 
                   style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
                 >
                    Deactivate Account
                 </button>
              </div>

              {/* Deactivate Confirmation Modal */}
              <Dialog open={isDeactivateModalOpen} onOpenChange={setIsDeactivateModalOpen}>
                  <DialogContent className="max-w-sm p-6 rounded-3xl">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-extrabold text-red-600" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Are you sure?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-[#49607e] font-medium py-2">
                      This action will permanently delete your account and all associated data. This cannot be undone.
                    </p>
                    <div className="flex gap-3 mt-4">
                       <Button variant="ghost" className="flex-1" onClick={() => setIsDeactivateModalOpen(false)}>Cancel</Button>
                       <Button variant="destructive" className="flex-1 font-bold" onClick={handleDeactivate} disabled={loading}>
                          {loading ? "Deleting..." : "Yes, Delete"}
                       </Button>
                    </div>
                  </DialogContent>
               </Dialog>
           </div>
        </div>
      </div>
    </div>
  );
}

function SettingsNavItem({ 
  icon, 
  title, 
  active, 
  highlight,
  onClick 
}: { 
  icon: React.ReactNode, 
  title: string, 
  active?: boolean, 
  highlight?: boolean,
  onClick?: () => void 
}) {
  return (
    <button 
      onClick={onClick}
      className={cn(
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

function NotificationToggle({ title, description, enabled = false, onChange }: { title: string, description: string, enabled?: boolean, onChange?: (enabled: boolean) => void }) {
  const [isOn, setIsOn] = useState(enabled);
  return (
    <div className="flex items-center justify-between">
       <div>
          <p className="text-sm font-bold text-[#181c1e]">{title}</p>
          <p className="text-xs text-[#49607e]">{description}</p>
       </div>
       <button 
         onClick={() => {
           const next = !isOn;
           setIsOn(next);
           onChange?.(next);
         }}
         className={cn(
           "w-10 h-5 rounded-full transition-colors relative",
           isOn ? "bg-[#493ee5]" : "bg-[#e5e8eb]"
         )}
       >
          <div className={cn(
            "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
            isOn ? "right-1" : "left-1"
          )} />
       </button>
    </div>
  );
}

function InputField({ label, placeholder, icon, value, onChange, type = "text" }: { label: string, placeholder: string, icon?: React.ReactNode, value?: string, onChange?: (val: string) => void, type?: string }) {
  return (
    <div className="space-y-1.5">
       <label className="text-[11px] font-extrabold text-[#49607e] uppercase tracking-[0.15em] pl-0.5" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{label}</label>
       <div className="relative group">
          {icon && <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#49607e] group-focus-within:text-[#493ee5] transition-colors">{icon}</div>}
          <input 
            type={type} 
            placeholder={placeholder} 
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            className={cn(
               "w-full py-3 bg-[#f1f4f7] rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#493ee5]/10 outline-none transition-all",
               icon ? "pl-10 pr-4" : "px-4"
            )}
          />
       </div>
    </div>
  );
}

function PhoneInputField({ label, value, onChange }: { label: string, value: string, onChange: (val: string) => void }) {
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (value) {
      if (value.startsWith("+")) {
        const parts = value.split(" ");
        if (parts.length > 1) {
          setCountryCode(parts[0]);
          setPhone(parts.slice(1).join(""));
        } else {
          // Fallback if no space
          setPhone(value);
        }
      } else {
        setPhone(value);
      }
    }
  }, [value]);

  const countries = [
    { code: "+91", flag: "🇮🇳", name: "India" },
    { code: "+1", flag: "🇺🇸", name: "USA" },
    { code: "+44", flag: "🇬🇧", name: "UK" },
    { code: "+971", flag: "🇦🇪", name: "UAE" },
  ];

  return (
    <div className="space-y-1.5">
       <label className="text-[11px] font-extrabold text-[#49607e] uppercase tracking-[0.15em] pl-0.5" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{label}</label>
       <div className="flex gap-2">
          <div className="relative shrink-0">
            <select 
              value={countryCode}
              onChange={(e) => {
                setCountryCode(e.target.value);
                onChange(`${e.target.value} ${phone}`);
              }}
              className="h-[46px] pl-3 pr-8 bg-[#f1f4f7] rounded-xl text-sm font-bold appearance-none outline-none focus:ring-2 focus:ring-[#493ee5]/10"
            >
              {countries.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#49607e]">
               <ChevronRight className="w-3.5 h-3.5 rotate-90" />
            </div>
          </div>
          <div className="relative flex-1 group">
             <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#49607e] group-focus-within:text-[#493ee5] transition-colors" />
             <input 
               type="tel" 
               placeholder="00000 00000" 
               value={phone}
               onChange={(e) => {
                 const val = e.target.value.replace(/\D/g, "");
                 setPhone(val);
                 onChange(`${countryCode} ${val}`);
               }}
               className="w-full h-[46px] pl-10 pr-4 bg-[#f1f4f7] rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#493ee5]/10 outline-none transition-all"
             />
          </div>
       </div>
    </div>
  );
}
