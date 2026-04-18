"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Calendar,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
  FileCheck,
  AlertTriangle
} from "lucide-react";
import api from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Toaster, toast } from "sonner";

type VerificationStatus =
  | "PENDING"
  | "ONLINE_VERIFIED"
  | "FIELD_VISIT_SCHEDULED"
  | "FIELD_VERIFIED"
  | "FULLY_VERIFIED"
  | "REJECTED";

interface VerificationItem {
  id: string; // Lineo uses id for orgs
  name: string;
  email: string;
  city: string | null;
  address: string | null;
  phoneNumber: string | null;
  createdAt: string;
  isVerified: boolean;
  status: VerificationStatus;
  lastVerifiedAt: string | null;
}

const STATUS_LABELS: Record<VerificationStatus, string> = {
  PENDING: "Pending",
  ONLINE_VERIFIED: "Online Verified",
  FIELD_VISIT_SCHEDULED: "Audit Scheduled",
  FIELD_VERIFIED: "Field Verified",
  FULLY_VERIFIED: "Active Protocol",
  REJECTED: "Rejected",
};

const STATUS_STYLES: Record<VerificationStatus, string> = {
  PENDING: "bg-[#f1f4f7] text-[#49607e]",
  ONLINE_VERIFIED: "bg-blue-50 text-blue-700",
  FIELD_VISIT_SCHEDULED: "bg-amber-50 text-amber-700",
  FIELD_VERIFIED: "bg-emerald-50 text-emerald-700",
  FULLY_VERIFIED: "bg-[#493ee5]/10 text-[#493ee5]",
  REJECTED: "bg-red-50 text-red-700",
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function VerificationsPage() {
  const [items, setItems] = useState<VerificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeOrg, setActiveOrg] = useState<VerificationItem | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/verifications");
      let filtered = (res.data?.data || []) as VerificationItem[];
      if (search) filtered = filtered.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.city?.toLowerCase().includes(search.toLowerCase()));
      if (statusFilter !== "all") filtered = filtered.filter(i => i.status === statusFilter);
      setItems(filtered);
    } catch (err) {
      console.error("Failed to fetch verifications:", err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const statusStats = useMemo(() => {
    const list = items || [];
    return {
      pending: list.filter((item) => item.status === "PENDING").length,
      online: list.filter((item) => item.status === "ONLINE_VERIFIED").length,
      fieldScheduled: list.filter((item) => item.status === "FIELD_VISIT_SCHEDULED").length,
      fieldVerified: list.filter((item) => item.status === "FIELD_VERIFIED").length,
      fully: list.filter((item) => item.status === "FULLY_VERIFIED").length,
      rejected: list.filter((item) => item.status === "REJECTED").length,
    };
  }, [items]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setUpdating(true);
    try {
      await api.put(`/admin/verifications/${id}/status`, { status: newStatus });
      toast.success(`Protocol Successful: Status moved to ${newStatus}`);
      // Optimistic update
      setItems(prev => prev.map(item => item.id === id ? { ...item, status: newStatus as VerificationStatus } : item));
      setActiveOrg(null);
    } catch (err) {
      console.error(err);
      toast.error("Protocol Failed. Database unreachable.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      <Toaster position="top-right" expand={true} richColors />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e5e8eb] pb-6 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>System Verifications</h1>
          <p className="text-sm text-[#49607e] font-medium mt-1">
            Global pipeline for auditing and approving new Organizations onto the Grid.
          </p>
        </div>
        <button
          onClick={fetchItems}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white ghost-border rounded-lg text-[#181c1e] hover:bg-[#f7fafd] shadow-sm font-bold text-sm transition-all"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-[#493ee5]" : ""}`} /> Sync Pipeline
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: "Pending Review", value: statusStats.pending, color: "text-[#181c1e]" },
          { label: "Online Audited", value: statusStats.online, color: "text-blue-700" },
          { label: "Field Scheduled", value: statusStats.fieldScheduled, color: "text-amber-700" },
          { label: "Field Verified", value: statusStats.fieldVerified, color: "text-emerald-700" },
          { label: "Grid Active", value: statusStats.fully, color: "text-[#493ee5]" },
          { label: "Quarantined", value: statusStats.rejected, color: "text-red-700" }
        ].map((stat, idx) => (
          <div key={idx} className="bg-white border border-transparent shadow-ambient ghost-border rounded-2xl p-4">
            <p className="text-[10px] text-[#49607e] font-bold uppercase tracking-widest">{stat.label}</p>
            <p className={`text-2xl font-extrabold mt-1 ${stat.color}`} style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-transparent shadow-ambient ghost-border rounded-2xl p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="h-4 w-4 text-[#49607e] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Query Organizations..."
              className="w-full pl-11 pr-4 py-3 bg-[#f1f4f7] border border-transparent rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:border-[#493ee5] transition-colors"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-[#f1f4f7] border border-transparent rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:border-[#493ee5] transition-colors appearance-none min-w-[200px]"
          >
            <option value="all">Active Pipeline</option>
            <option value="PENDING">Pending</option>
            <option value="ONLINE_VERIFIED">Online Verified</option>
            <option value="FIELD_VISIT_SCHEDULED">Audit Scheduled</option>
            <option value="FIELD_VERIFIED">Field Verified</option>
            <option value="FULLY_VERIFIED">Grid Active</option>
            <option value="REJECTED">Quarantined</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
           Array.from({length: 3}).map((_, i) => (
             <div key={i} className="bg-white border border-transparent shadow-ambient ghost-border rounded-3xl p-6 space-y-5 animate-pulse">
                <div className="flex justify-between items-start">
                   <div>
                      <Skeleton className="h-6 w-48 mb-2" />
                      <Skeleton className="h-4 w-32" />
                   </div>
                   <Skeleton className="h-6 w-24 rounded-full" />
                </div>
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
             </div>
           ))
        ) : items.map((item) => (
          <div key={item.id} className="bg-white border border-transparent shadow-ambient ghost-border rounded-3xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-extrabold text-[#181c1e] text-lg leading-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{item.name}</p>
                <p className="text-sm font-medium text-[#49607e] mt-0.5">{item.email}</p>
              </div>
              <span className={`text-[10px] px-3 py-1.5 rounded-full font-bold uppercase tracking-widest ${STATUS_STYLES[item.status]}`}>
                {STATUS_LABELS[item.status]}
              </span>
            </div>

            <div className="space-y-2.5 text-xs font-semibold text-[#49607e] bg-[#f7fafd] p-4 rounded-2xl border border-[#e5e8eb]/50">
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#181c1e]" /> {item.city || "Unmapped Territory"}
              </p>
              <p className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#181c1e]" /> Discovered {formatDate(item.createdAt)}
              </p>
              <p className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#181c1e]" /> Audited: {formatDate(item.lastVerifiedAt)}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setActiveOrg(item)}
                className="flex-1 px-4 py-3 text-center text-xs uppercase tracking-widest font-extrabold bg-[#181c1e] text-white rounded-xl hover:bg-black transition-all shadow-ambient"
              >
                Launch Protocol
              </button>
            </div>
          </div>
        ))}

        {!loading && (items || []).length === 0 && (
          <div className="col-span-full border border-dashed border-[#e5e8eb] rounded-3xl p-16 text-center">
            <Building2 className="h-10 w-10 text-[#49607e]/30 mx-auto mb-4" />
            <p className="text-[#49607e] font-bold text-sm">Target vector empty. No organizations found.</p>
          </div>
        )}
      </div>

      <Dialog open={!!activeOrg} onOpenChange={(open) => !open && setActiveOrg(null)}>
        <DialogContent className="sm:max-w-md bg-white border border-[#e5e8eb] z-[100] custom-scrollbar overflow-y-auto w-full p-0 rounded-3xl overflow-hidden shadow-ambient">
          {activeOrg && (
            <div className="p-6 space-y-6 h-full flex flex-col">
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                   <div className="p-3 bg-[#493ee5]/10 rounded-xl">
                      <Building2 className="h-6 w-6 text-[#493ee5]" />
                   </div>
                   <DialogTitle className="text-xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                     {activeOrg.name}
                   </DialogTitle>
                </div>
                <DialogDescription className="text-sm font-medium text-[#49607e] text-left">
                  Manage verification protocols and clearance levels.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 flex-1">
                <div className="p-4 bg-[#f1f4f7] rounded-2xl border border-transparent">
                   <p className="text-[10px] text-[#49607e] font-bold uppercase tracking-widest mb-1">Current State</p>
                   <span className={`inline-flex px-3 py-1.5 rounded-full font-bold uppercase tracking-widest text-[10px] ${STATUS_STYLES[activeOrg.status]}`}>
                     {STATUS_LABELS[activeOrg.status]}
                   </span>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold text-[#181c1e] uppercase tracking-widest border-b border-[#e5e8eb] pb-2">Available Actions</p>
                  
                  <button
                    onClick={() => handleUpdateStatus(activeOrg.id, 'FIELD_VISIT_SCHEDULED')}
                    disabled={updating}
                    className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-amber-500/20 bg-amber-50 hover:bg-amber-100 transition-colors text-amber-700 disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2 font-bold text-sm"><Calendar className="h-4 w-4" /> Schedule Field Audit</span>
                  </button>

                  <button
                    onClick={() => handleUpdateStatus(activeOrg.id, 'FULLY_VERIFIED')}
                    disabled={updating}
                    className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-[#493ee5]/20 bg-[#493ee5]/5 hover:bg-[#493ee5]/10 transition-colors text-[#493ee5] disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2 font-bold text-sm"><FileCheck className="h-4 w-4" /> Fully Activate on Grid</span>
                  </button>

                  <button
                    onClick={() => handleUpdateStatus(activeOrg.id, 'REJECTED')}
                    disabled={updating}
                    className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-red-500/20 bg-red-50 hover:bg-red-100 transition-colors text-red-700 disabled:opacity-50 mt-8"
                  >
                    <span className="flex items-center gap-2 font-bold text-sm"><AlertTriangle className="h-4 w-4" /> Reject & Quarantine</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


