"use client";

import React, { useEffect, useState } from "react";
import { Search, Zap, ExternalLink, Download, User as UserIcon, Filter } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Toaster, toast } from "sonner";
import api from "@/lib/api";

interface UserPaymentTxn {
  id: string;
  user_id: number;
  user_name: string;
  user_email: string;
  amount: number;
  currency: string;
  plan_tier: string;
  status: string;
  timestamp: string;
  receipt_url: string;
}

export default function UserPaymentsPage() {
  const [transactions, setTransactions] = useState<UserPaymentTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [activeTxn, setActiveTxn] = useState<UserPaymentTxn | null>(null);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/payments/users");
      setTransactions((res.data?.data || []) as UserPaymentTxn[]);
    } catch (err) {
      toast.error("Failed to sync Consumer Billing records.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const filteredTxns = (transactions || []).filter(t => {
    const matchesSearch = t.user_name.toLowerCase().includes(search.toLowerCase()) || 
                         t.user_email.toLowerCase().includes(search.toLowerCase()) ||
                         t.id.toLowerCase().includes(search.toLowerCase());
    const matchesPlan = planFilter === "all" || t.plan_tier.toLowerCase() === planFilter.toLowerCase();
    return matchesSearch && matchesPlan;
  });

  return (
    <div className="space-y-6 w-full">
      <Toaster position="top-right" expand={true} richColors />
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-[#e5e8eb] pb-6 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Consumer Billing Audit</h1>
          <p className="text-sm text-[#49607e] font-medium mt-1">Monitor end-user subscription revenue and account tiers.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full xl:max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#49607e]" />
            <input
              type="text"
              placeholder="Search User, Email or Txn..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#e5e8eb] rounded-xl text-sm font-medium focus:outline-none focus:border-[#493ee5] focus:ring-1 focus:ring-[#493ee5] transition-all"
            />
          </div>
          <div className="relative sm:w-48">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#49607e]" />
            <select
              value={planFilter}
              onChange={e => setPlanFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#e5e8eb] rounded-xl text-sm font-medium appearance-none focus:outline-none focus:border-[#493ee5] transition-all cursor-pointer"
            >
              <option value="all">All Plans</option>
              <option value="plus">Plus</option>
              <option value="unlimited">Unlimited</option>
              <option value="basic">Basic</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-transparent shadow-ambient overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#e5e8eb] bg-[#f7fafd]/50">
                <th className="px-6 py-4 text-xs font-bold text-[#49607e] uppercase tracking-widest">Subscriber</th>
                <th className="px-6 py-4 text-xs font-bold text-[#49607e] uppercase tracking-widest">Plan Details</th>
                <th className="px-6 py-4 text-xs font-bold text-[#49607e] uppercase tracking-widest">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-[#49607e] uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-[#49607e] uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e8eb]">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-20" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-16" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-24 rounded-full" /></td>
                    <td className="px-6 py-4 flex justify-end"><Skeleton className="h-8 w-24 rounded-lg" /></td>
                  </tr>
                ))
              ) : filteredTxns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                     <div className="flex flex-col items-center justify-center opacity-50">
                       <Zap className="h-12 w-12 text-[#49607e] mb-4" />
                       <p className="font-bold text-[#181c1e]">No revenue matching filters</p>
                       <p className="text-sm text-[#49607e]">Adjust your search or filter to see results.</p>
                     </div>
                  </td>
                </tr>
              ) : filteredTxns.map((txn) => (
                <tr key={txn.id} className="hover:bg-[#f7fafd]/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-[#f1f4f7] flex items-center justify-center text-[#493ee5] group-hover:scale-110 transition-transform">
                        <UserIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-extrabold text-[#181c1e]">{txn.user_name}</p>
                        <p className="text-xs font-semibold text-[#49607e]">{txn.user_email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                        txn.plan_tier === 'unlimited' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                        txn.plan_tier === 'plus' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        'bg-slate-50 text-slate-600 border border-slate-200'
                     }`}>
                        {txn.plan_tier}
                     </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-[#181c1e]">
                     {txn.currency} {txn.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      txn.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' :
                      txn.status === 'PENDING' ? 'bg-amber-50 text-amber-700' :
                      'bg-red-50 text-red-700'
                    }`}>
                      {txn.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setActiveTxn(txn)}
                      className="px-3 py-1.5 bg-[#f1f4f7] text-[#181c1e] hover:bg-[#493ee5] hover:text-white font-bold text-[10px] transition-all rounded-lg uppercase tracking-wider h-9"
                    >
                      Audit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!activeTxn} onOpenChange={(open) => !open && setActiveTxn(null)}>
        <DialogContent className="sm:max-w-md bg-white border border-[#e5e8eb] z-[100] rounded-3xl shadow-ambient p-0 overflow-hidden">
          {activeTxn && (
            <div className="flex flex-col">
              <div className="p-6 bg-[#f7fafd] border-b border-[#e5e8eb]">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                       <div className="p-3 bg-white rounded-2xl shadow-sm border border-[#e5e8eb]">
                          <Zap className="h-6 w-6 text-[#493ee5]" />
                       </div>
                       <div>
                          <DialogTitle className="text-xl font-extrabold text-[#181c1e] tracking-tight">
                            Subscription Audit
                          </DialogTitle>
                          <DialogDescription className="text-xs font-semibold text-[#49607e]">
                            Transaction Reference: {activeTxn.id}
                          </DialogDescription>
                       </div>
                    </div>
                </DialogHeader>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-[#f8fafc] rounded-2xl border border-[#e5e8eb]">
                       <p className="text-[10px] font-bold text-[#49607e] uppercase tracking-widest mb-1">Total Amount</p>
                       <p className="text-xl font-black text-[#181c1e]">{activeTxn.currency} {activeTxn.amount}</p>
                    </div>
                    <div className="p-4 bg-[#f8fafc] rounded-2xl border border-[#e5e8eb]">
                       <p className="text-[10px] font-bold text-[#49607e] uppercase tracking-widest mb-1">Plan Tier</p>
                       <p className="text-xl font-black text-[#493ee5] uppercase">{activeTxn.plan_tier}</p>
                    </div>
                </div>

                <div className="space-y-3">
                   <div className="flex justify-between items-center text-sm">
                      <span className="text-[#49607e] font-medium">Customer Name</span>
                      <span className="text-[#181c1e] font-extrabold">{activeTxn.user_name}</span>
                   </div>
                   <div className="flex justify-between items-center text-sm">
                      <span className="text-[#49607e] font-medium">Email Address</span>
                      <span className="text-[#181c1e] font-extrabold">{activeTxn.user_email}</span>
                   </div>
                   <div className="flex justify-between items-center text-sm">
                      <span className="text-[#49607e] font-medium">Settled On</span>
                      <span className="text-[#181c1e] font-extrabold">{new Date(activeTxn.timestamp).toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between items-center text-sm">
                      <span className="text-[#49607e] font-medium">Payment Status</span>
                      <span className="font-black text-emerald-600 uppercase text-xs">{activeTxn.status}</span>
                   </div>
                </div>

                <div className="flex flex-col gap-2 pt-4">
                  <button
                    onClick={() => window.open(activeTxn.receipt_url, '_blank')}
                    className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl bg-[#181c1e] text-white hover:bg-black transition-all font-bold text-sm"
                  >
                    <ExternalLink className="h-4 w-4" /> View Gateway Receipt
                  </button>
                  <button
                    className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl bg-white border border-[#e5e8eb] text-[#49607e] hover:bg-[#f1f4f7] transition-all font-bold text-sm"
                  >
                    <Download className="h-4 w-4" /> Download PDF Invoice
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
