"use client";

import { useState } from "react";
import {
  Settings,
  Bell,
  Shield,
  Database,
  Mail,
  Globe,
  Save,
  RefreshCw,
  Check,
  Moon,
  Sun,
  Smartphone,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import api from "@/lib/api";
import { Toaster, toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect } from "react";

interface SettingsSection {
  id: string;
  label: string;
  icon: typeof Settings;
}

const SECTIONS: SettingsSection[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "system", label: "System", icon: Database },
];

export default function SystemSettingsPage() {
  const [activeSection, setActiveSection] = useState("general");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Fake fetch for skeleton consistency
  useEffect(() => {
    const t = setTimeout(() => setInitialLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  // General settings
  const [siteName, setSiteName] = useState("Lineo Enterprise");
  const [siteDescription, setSiteDescription] = useState("Global Queue Management System");
  const [contactEmail, setContactEmail] = useState("root@lineo.ai");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [theme, setTheme] = useState("light");

  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [newDonationAlert, setNewDonationAlert] = useState(true); // Terminal Alerts
  const [newUserAlert, setNewUserAlert] = useState(true);
  const [expiryAlert, setExpiryAlert] = useState(true);

  // Security settings
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("30");
  const [ipWhitelist, setIpWhitelist] = useState("");

  // System settings
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [maxUploadSize, setMaxUploadSize] = useState("10");
  const [dataRetention, setDataRetention] = useState("365");

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/admin/system/config", {
         siteName, siteDescription, contactEmail, timezone, theme,
         emailNotifications, pushNotifications, twoFactorAuth, maintenanceMode, debugMode
      });
      setSaved(true);
      toast.success("System configurations securely committed to cluster variables.");
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
      toast.error("Failed to commit settings configuration.");
    } finally {
      setSaving(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="space-y-6 w-full animate-pulse">
        <div className="flex justify-between items-center border-b border-[#e5e8eb] pb-6 mb-6">
           <div>
              <Skeleton className="h-8 w-64 mb-2 rounded-lg" />
              <Skeleton className="h-4 w-48 rounded-md" />
           </div>
           <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        <div className="flex flex-col lg:flex-row gap-8">
           <Skeleton className="lg:w-64 h-64 rounded-2xl shrink-0" />
           <div className="flex-1 space-y-6">
              <Skeleton className="h-40 rounded-3xl w-full" />
              <Skeleton className="h-40 rounded-3xl w-full" />
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <Toaster position="top-right" expand={true} richColors />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e5e8eb] pb-6 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>System Preferences</h1>
          <p className="text-[#49607e] text-sm font-medium mt-1">Manage global configurations for Lineo.sys</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#181c1e] text-white rounded-xl hover:bg-black disabled:opacity-50 transition-all font-bold text-sm shadow-ambient border border-white/10"
        >
          {saving ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Writing to Block..." : saved ? "Changes Saved!" : "Commit Changes"}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <div className="lg:w-64 shrink-0">
          <div className="bg-white rounded-2xl shadow-ambient p-3 border border-transparent ghost-border">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${
                  activeSection === section.id
                    ? "bg-[#181c1e] text-white shadow-md font-bold"
                    : "text-[#49607e] font-medium hover:bg-[#f1f4f7] hover:text-[#181c1e]"
                }`}
                style={activeSection === section.id ? { fontFamily: 'var(--font-manrope), sans-serif' } : {}}
              >
                <section.icon className={`h-5 w-5 ${activeSection === section.id ? "text-white" : "text-[#49607e]"}`} />
                {section.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* General Settings */}
          {activeSection === "general" && (
            <div className="bg-white rounded-3xl border border-transparent ghost-border p-6 lg:p-8 space-y-8 shadow-ambient">
              <div>
                <h2 className="text-xl font-extrabold text-[#181c1e] tracking-tight mb-1" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>General Specifications</h2>
                <p className="text-sm text-[#49607e] font-medium">Configure primary cluster attributes</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-[#49607e] uppercase tracking-widest mb-2">Cluster Name</label>
                  <input
                    type="text"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    className="w-full px-4 py-3 bg-[#f1f4f7] border border-transparent rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:border-[#493ee5] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#49607e] uppercase tracking-widest mb-2">Mission Directive</label>
                  <textarea
                    value={siteDescription}
                    onChange={(e) => setSiteDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 bg-[#f1f4f7] border border-transparent rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:border-[#493ee5] transition-colors resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#49607e] uppercase tracking-widest mb-2">Emergency Root Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#49607e]" />
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-[#f1f4f7] border border-transparent rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:border-[#493ee5] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#49607e] uppercase tracking-widest mb-2">Chronology Sync (Timezone)</label>
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#49607e]" />
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-[#f1f4f7] border border-transparent rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:border-[#493ee5] transition-colors appearance-none"
                    >
                      <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">America/New_York (EST)</option>
                      <option value="Europe/London">Europe/London (GMT)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#49607e] uppercase tracking-widest mb-2">Interface Aesthetic</label>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setTheme("light")}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 rounded-xl transition-all ${
                        theme === "light"
                          ? "border-[#493ee5] bg-[#493ee5]/5 text-[#493ee5] font-bold"
                          : "border-[#e5e8eb] text-[#49607e] hover:bg-[#f1f4f7] font-medium"
                      }`}
                    >
                      <Sun className="h-5 w-5" /> Standard Light
                    </button>
                    <button
                      onClick={() => setTheme("dark")}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 rounded-xl transition-all ${
                        theme === "dark"
                          ? "border-[#493ee5] bg-[#493ee5]/5 text-[#493ee5] font-bold"
                          : "border-[#e5e8eb] text-[#49607e] hover:bg-[#f1f4f7] font-medium"
                      }`}
                    >
                      <Moon className="h-5 w-5" /> Stealth Dark
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notification Settings */}
          {activeSection === "notifications" && (
            <div className="bg-white rounded-3xl border border-transparent ghost-border p-6 lg:p-8 space-y-8 shadow-ambient">
              <div>
                <h2 className="text-xl font-extrabold text-[#181c1e] tracking-tight mb-1" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Telemetry Operations</h2>
                <p className="text-sm text-[#49607e] font-medium">Direct notification protocols</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-5 bg-[#f7fafd] rounded-2xl border border-transparent hover:border-[#e5e8eb] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100/50 rounded-xl">
                      <Mail className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#181c1e]">Off-Site Intercepts (Email)</p>
                      <p className="text-xs text-[#49607e] font-medium mt-0.5">Push high-level reports to inbox</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEmailNotifications(!emailNotifications)}
                    className={`relative w-14 h-7 rounded-full transition-colors ${
                      emailNotifications ? "bg-[#493ee5]" : "bg-[#e5e8eb]"
                    }`}
                  >
                    <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-md ${emailNotifications ? "left-8" : "left-1"}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-5 bg-[#f7fafd] rounded-2xl border border-transparent hover:border-[#e5e8eb] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-100/50 rounded-xl">
                      <Smartphone className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#181c1e]">Real-time Push Hooks</p>
                      <p className="text-xs text-[#49607e] font-medium mt-0.5">Stream live alerts to this browser</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPushNotifications(!pushNotifications)}
                    className={`relative w-14 h-7 rounded-full transition-colors ${
                      pushNotifications ? "bg-[#493ee5]" : "bg-[#e5e8eb]"
                    }`}
                  >
                    <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-md ${pushNotifications ? "left-8" : "left-1"}`} />
                  </button>
                </div>

                <div className="pt-6">
                  <p className="text-xs font-bold text-[#49607e] uppercase tracking-widest mb-4">Event Subscriptions</p>
                  <div className="space-y-4 max-w-sm">
                    {[
                      { label: "New Organization Verification Requests", value: newDonationAlert, setter: setNewDonationAlert },
                      { label: "System Security Breaches", value: newUserAlert, setter: setNewUserAlert },
                      { label: "High Volume Overloads", value: expiryAlert, setter: setExpiryAlert },
                    ].map((item) => (
                      <label key={item.label} className="flex items-center justify-between cursor-pointer group">
                        <span className="text-sm font-medium text-[#181c1e] group-hover:text-[#493ee5] transition-colors">{item.label}</span>
                        <input
                          type="checkbox"
                          checked={item.value}
                          onChange={(e) => item.setter(e.target.checked)}
                          className="w-5 h-5 rounded-md border-gray-300 text-[#493ee5] focus:ring-[#493ee5]"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Settings */}
          {activeSection === "security" && (
            <div className="bg-white rounded-3xl border border-transparent ghost-border p-6 lg:p-8 space-y-8 shadow-ambient">
              <div>
                <h2 className="text-xl font-extrabold text-[#181c1e] tracking-tight mb-1" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Cybersecurity Policies</h2>
                <p className="text-sm text-[#49607e] font-medium">Firewalls and authentication blocks</p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-5 bg-[#f7fafd] rounded-2xl border border-transparent hover:border-[#e5e8eb] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-100/50 rounded-xl">
                      <Lock className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#181c1e]">Two-Factor Integrity (2FA)</p>
                      <p className="text-xs text-[#49607e] font-medium mt-0.5">Require device handshake on login</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setTwoFactorAuth(!twoFactorAuth)}
                    className={`relative w-14 h-7 rounded-full transition-colors ${
                      twoFactorAuth ? "bg-green-500" : "bg-[#e5e8eb]"
                    }`}
                  >
                    <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-md ${twoFactorAuth ? "left-8" : "left-1"}`} />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#49607e] uppercase tracking-widest mb-2">Idle Drop (Minutes)</label>
                  <select
                    value={sessionTimeout}
                    onChange={(e) => setSessionTimeout(e.target.value)}
                    className="w-full px-4 py-3 bg-[#f1f4f7] border border-transparent rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:border-[#493ee5] transition-colors"
                  >
                    <option value="15">15 minutes limit</option>
                    <option value="30">30 minutes limit</option>
                    <option value="60">1 hour limit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#49607e] uppercase tracking-widest mb-2">IP Allowlist Base</label>
                  <textarea
                    value={ipWhitelist}
                    onChange={(e) => setIpWhitelist(e.target.value)}
                    placeholder="e.g. 192.168.1.1 (leave blank for dynamic)"
                    rows={3}
                    className="w-full px-4 py-3 bg-[#f1f4f7] border border-transparent rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:border-[#493ee5] transition-colors resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#49607e] uppercase tracking-widest mb-2">Cycle Root Sequence</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#49607e]" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Overwrite password..."
                      className="w-full pl-11 pr-11 py-3 bg-[#f1f4f7] border border-transparent rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:border-[#493ee5] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#49607e]"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* System Settings */}
          {activeSection === "system" && (
            <div className="bg-white rounded-3xl border border-transparent ghost-border p-6 lg:p-8 space-y-8 shadow-ambient">
              <div>
                <h2 className="text-xl font-extrabold text-[#181c1e] tracking-tight mb-1" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Architecture Controls</h2>
                <p className="text-sm text-[#49607e] font-medium">Direct server and database manipulation</p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-5 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-100 rounded-xl">
                      <Settings className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#181c1e]">Maintenance Hardline</p>
                      <p className="text-xs text-[#49607e] font-medium mt-0.5">Disconnect all tenant websockets</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setMaintenanceMode(!maintenanceMode)}
                    className={`relative w-14 h-7 rounded-full transition-colors ${
                      maintenanceMode ? "bg-amber-500" : "bg-[#e5e8eb]"
                    }`}
                  >
                    <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-md ${maintenanceMode ? "left-8" : "left-1"}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-5 bg-[#f7fafd] rounded-2xl border border-transparent hover:border-[#e5e8eb] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-100/50 rounded-xl">
                      <Database className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#181c1e]">Verbose Stack Trace</p>
                      <p className="text-xs text-[#49607e] font-medium mt-0.5">Expose raw DB errors to logs</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDebugMode(!debugMode)}
                    className={`relative w-14 h-7 rounded-full transition-colors ${
                      debugMode ? "bg-red-500" : "bg-[#e5e8eb]"
                    }`}
                  >
                    <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-md ${debugMode ? "left-8" : "left-1"}`} />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#49607e] uppercase tracking-widest mb-2">Asset Allocation Limit</label>
                  <select
                    value={maxUploadSize}
                    onChange={(e) => setMaxUploadSize(e.target.value)}
                    className="w-full px-4 py-3 bg-[#f1f4f7] border border-transparent rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:border-[#493ee5] transition-colors"
                  >
                    <option value="5">5 MB Chunking</option>
                    <option value="10">10 MB Chunking</option>
                    <option value="25">25 MB Pipeline</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#49607e] uppercase tracking-widest mb-2">Log Rotation Base</label>
                  <select
                    value={dataRetention}
                    onChange={(e) => setDataRetention(e.target.value)}
                    className="w-full px-4 py-3 bg-[#f1f4f7] border border-transparent rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:border-[#493ee5] transition-colors"
                  >
                    <option value="90">90 Days Wipe</option>
                    <option value="180">180 Days Archive</option>
                    <option value="365">365 Days Retention</option>
                    <option value="0">Eternal Memory</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
