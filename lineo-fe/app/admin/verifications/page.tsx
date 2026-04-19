"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Calendar,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  FileCheck,
  AlertTriangle,
  ExternalLink,
  Phone,
  User,
  Image as ImageIcon,
  Compass
} from "lucide-react";
import api from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster, toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

type VerificationStatus =
  | "PENDING"
  | "FULLY_VERIFIED"
  | "REJECTED";

interface VerificationItem {
  id: string;
  name: string;
  owner_name: string;
  owner_phone: string;
  address: string | null;
  pincode: string;
  state: string;
  createdAt: string;
  isVerified: boolean;
  status: VerificationStatus;
  office_img: string;
  cert_pdf: string;
  ptax_pdf: string;
  lat: number;
  lng: number;
}

const STATUS_LABELS: Record<VerificationStatus, string> = {
  PENDING: "Pending",
  FULLY_VERIFIED: "Grid Active",
  REJECTED: "Rejected",
};

const STATUS_STYLES: Record<VerificationStatus, string> = {
  PENDING: "bg-[#f1f4f7] text-[#49607e]",
  FULLY_VERIFIED: "bg-[#493ee5]/10 text-[#493ee5]",
  REJECTED: "bg-red-50 text-red-700",
};

export default function VerificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<VerificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/verifications");
      let filtered = (res.data?.data || []) as VerificationItem[];
      if (search) filtered = filtered.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.state?.toLowerCase().includes(search.toLowerCase()));
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
      fully: list.filter((item) => item.status === "FULLY_VERIFIED").length,
      rejected: list.filter((item) => item.status === "REJECTED").length,
    };
  }, [items]);

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
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#e5e8eb] rounded-lg text-[#181c1e] hover:bg-[#f7fafd] shadow-sm font-bold text-sm transition-all"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-[#493ee5]" : ""}`} /> Sync Pipeline
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard label="Pending Review" value={statusStats.pending} color="text-[#181c1e]" bg="bg-white" />
          <StatCard label="Grid Active" value={statusStats.fully} color="text-[#493ee5]" bg="bg-[#493ee5]/5" />
          <StatCard label="Quarantined" value={statusStats.rejected} color="text-red-700" bg="bg-red-50" />
      </div>

      <div className="bg-white border border-[#e5e8eb] rounded-2xl p-4 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="h-4 w-4 text-[#49607e] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Query Institutions..."
              className="w-full pl-11 pr-4 py-3 bg-[#f7fafd] border border-transparent rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:border-[#493ee5] transition-colors"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-[#f7fafd] border border-transparent rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:border-[#493ee5] transition-colors appearance-none min-w-[200px]"
          >
            <option value="all">Active Pipeline</option>
            <option value="PENDING">Pending</option>
            <option value="FULLY_VERIFIED">Grid Active</option>
            <option value="REJECTED">Quarantined</option>
          </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
           Array.from({length: 3}).map((_, i) => (
             <Skeleton key={i} className="h-64 rounded-3xl" />
           ))
        ) : items.map((item) => (
          <div key={item.id} className="bg-white border border-[#e5e8eb] shadow-sm rounded-3xl p-6 space-y-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-extrabold text-[#181c1e] text-lg leading-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{item.name}</p>
                  {item.status === 'FULLY_VERIFIED' && (
                    <ShieldCheck className="h-4 w-4 text-[#493ee5]" />
                  )}
                </div>
                <p className="text-xs font-bold text-[#49607e] mt-1 uppercase tracking-wider">{item.owner_name}</p>
              </div>
              <span className={`text-[10px] px-3 py-1.5 rounded-full font-black uppercase tracking-widest ${STATUS_STYLES[item.status]}`}>
                {STATUS_LABELS[item.status]}
              </span>
            </div>

            <div className="space-y-3 text-xs font-bold text-[#49607e] bg-[#f7fafd] p-5 rounded-2xl border border-[#e5e8eb]/50">
              <p className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-[#493ee5]" /> {item.state}, {item.pincode}
              </p>
              <p className="flex items-center gap-3">
                 <Building2 className="h-4 w-4 text-[#493ee5]" /> {item.address}
              </p>
              <p className="flex items-center gap-3">
                 <Phone className="h-4 w-4 text-[#493ee5]" /> {item.owner_phone}
              </p>
            </div>

            <button
              onClick={() => router.push(`/admin/verifications/${item.id}`)}
              className="w-full px-4 py-4 text-center text-[10px] uppercase tracking-[0.2em] font-black bg-[#181c1e] text-white rounded-2xl hover:bg-black transition-all shadow-lg active:scale-95"
            >
              Inspect Protocol
            </button>
          </div>
        ))}

        {!loading && items.length === 0 && (
          <div className="col-span-full border-2 border-dashed border-[#e5e8eb] rounded-[32px] p-20 text-center">
            <Building2 className="h-12 w-12 text-[#49607e]/20 mx-auto mb-4" />
            <p className="text-[#49607e] font-black text-sm uppercase tracking-widest">No matching vectors found.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, bg }: any) {
  return (
    <div className={cn("border border-[#e5e8eb] rounded-[24px] p-6 shadow-sm", bg)}>
      <p className="text-[10px] text-[#49607e] font-black uppercase tracking-[0.2em] mb-1">{label}</p>
      <p className={cn("text-4xl font-black tracking-tighter", color)} style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{value}</p>
    </div>
  );
}
