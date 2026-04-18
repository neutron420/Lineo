"use client";

import React, { useEffect, useState } from "react";
import { Search, CreditCard, ExternalLink, ShieldCheck, Download, Banknote, Building2 } from "lucide-react";
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

interface PaymentTxn {
  id: string;
  organization_id: number;
  organization_name: string;
  amount: number;
  currency: string;
  plan_tier: string;
  status: string;
  timestamp: string;
  receipt_url: string;
}

export default function BillingVaultPage() {
  const [transactions, setTransactions] = useState<PaymentTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTxn, setActiveTxn] = useState<PaymentTxn | null>(null);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/payments");
      setTransactions((res.data?.data || []) as PaymentTxn[]);
    } catch (err) {
      toast.error("Failed to sync the Billing Vault. Database disconnected.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const filteredTxns = (transactions || []).filter(t => 
    t.organization_name.toLowerCase().includes(search.toLowerCase()) || 
    t.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 w-full">
      <Toaster position="top-right" expand={true} richColors />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e5e8eb] pb-6 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Billing & Vault Settings</h1>
          <p className="text-sm text-[#49607e] font-medium mt-1">Audit organizational subscription payments and Razorpay logs.</p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#49607e]" />
          <input
            type="text"
            placeholder="Search Txn ID or Org name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#e5e8eb] rounded-xl text-sm font-medium focus:outline-none focus:border-[#493ee5] focus:ring-1 focus:ring-[#493ee5] transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-transparent shadow-ambient p-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#e5e8eb] bg-[#f7fafd]/50">
                <th className="px-6 py-4 text-xs font-bold text-[#49607e] uppercase tracking-widest">Transaction Ref</th>
                <th className="px-6 py-4 text-xs font-bold text-[#49607e] uppercase tracking-widest">Organization</th>
                <th className="px-6 py-4 text-xs font-bold text-[#49607e] uppercase tracking-widest">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-[#49607e] uppercase tracking-widest">Status / Tier</th>
                <th className="px-6 py-4 text-xs font-bold text-[#49607e] uppercase tracking-widest text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e8eb]">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-32" /></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-5 w-40" />
                      </div>
                    </td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-20" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-24 rounded-full" /></td>
                    <td className="px-6 py-4 flex justify-end"><Skeleton className="h-8 w-32 rounded-lg" /></td>
                  </tr>
                ))
              ) : filteredTxns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[#49607e]">
                     <div className="flex flex-col items-center justify-center">
                       <CreditCard className="h-10 w-10 text-[#49607e]/30 mb-3" />
                       <p className="font-bold">No payments found.</p>
                       <p className="text-xs">Incoming Razorpay transactions will be displayed here.</p>
                     </div>
                  </td>
                </tr>
              ) : filteredTxns.map((txn) => (
                <tr key={txn.id} className="hover:bg-[#f7fafd] transition-colors group">
                  <td className="px-6 py-4 text-xs font-extrabold text-[#49607e] font-mono">{txn.id}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-[#f1f4f7] flex items-center justify-center text-[#181c1e]">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-extrabold text-[#181c1e]">{txn.organization_name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-[#181c1e]">
                     {txn.currency} {txn.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 items-start">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          txn.status === 'SUCCESS' || txn.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' :
                          txn.status === 'PENDING' ? 'bg-amber-50 text-amber-700' :
                          'bg-red-50 text-red-700'
                        }`}>
                          {txn.status}
                        </span>
                        <span className="text-[10px] font-bold text-[#493ee5] uppercase tracking-widest">{txn.plan_tier} Tier</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setActiveTxn(txn)}
                      className="px-4 py-2 bg-[#f1f4f7] text-[#181c1e] hover:bg-[#e5e8eb] shadow-sm font-bold text-xs transition-all rounded-lg uppercase tracking-wider"
                    >
                      Audit Invoice
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!activeTxn} onOpenChange={(open) => !open && setActiveTxn(null)}>
        <DialogContent className="sm:max-w-md bg-white border border-[#e5e8eb] z-[100] custom-scrollbar overflow-y-auto w-full p-0 rounded-3xl overflow-hidden shadow-ambient">
          {activeTxn && (
            <div className="p-6 space-y-6 h-full flex flex-col">
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                   <div className="p-3 bg-emerald-50 rounded-xl">
                      <CreditCard className="h-6 w-6 text-emerald-600" />
                   </div>
                   <DialogTitle className="text-xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                     Payment Invoice
                   </DialogTitle>
                </div>
                <DialogDescription className="text-sm font-medium text-[#49607e] text-left">
                  Transaction record and detailed Razorpay log for auditing.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 flex-1">
                <div className="bg-[#f7fafd] border border-[#e5e8eb] p-6 rounded-3xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                       <Banknote className="h-32 w-32 text-[#493ee5]" />
                    </div>
                    <div className="relative z-10">
                       <p className="text-xs font-bold uppercase tracking-widest text-[#49607e] mb-1">Total Settled</p>
                       <p className="text-4xl font-extrabold tracking-tight mb-4 text-[#493ee5]">{activeTxn.currency} {activeTxn.amount.toLocaleString()}</p>
                       
                       <div className="space-y-2 mt-6 pt-6 border-t border-[#e5e8eb] text-sm font-medium">
                          <div className="flex justify-between">
                             <span className="text-[#49607e]">Organization</span>
                             <span className="font-extrabold text-[#181c1e]">{activeTxn.organization_name}</span>
                          </div>
                          <div className="flex justify-between">
                             <span className="text-[#49607e]">Plan Tier</span>
                             <span className="font-bold uppercase text-[#493ee5] bg-[#493ee5]/10 px-2 py-0.5 rounded">{activeTxn.plan_tier}</span>
                          </div>
                          <div className="flex justify-between">
                             <span className="text-[#49607e]">Date Settled</span>
                             <span className="font-extrabold text-[#181c1e]">{new Date(activeTxn.timestamp).toLocaleDateString()}</span>
                          </div>
                          <div className="flex justify-between items-center">
                             <span className="text-[#49607e]">Txn Gateway ID</span>
                             <span className="font-mono text-xs font-bold text-[#181c1e] bg-white px-2 py-1 rounded shadow-sm border border-[#e5e8eb]">{activeTxn.id}</span>
                          </div>
                       </div>
                    </div>
                </div>

                <div className="space-y-3 pt-4">
                  <p className="text-xs font-bold text-[#181c1e] uppercase tracking-widest border-b border-[#e5e8eb] pb-2">Available Actions</p>
                  
                  <button
                    onClick={() => toast.success("Gateway Receipt Link copied to clipboard")}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-[#e5e8eb] hover:bg-[#f1f4f7] transition-colors text-[#181c1e]"
                  >
                    <span className="flex items-center gap-2 font-bold text-sm"><ExternalLink className="h-4 w-4" /> Go to Gateway Receipt</span>
                  </button>

                  <button
                    onClick={() => toast.success("PDF Generation Scheduled!")}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-[#493ee5] text-white hover:bg-[#3b31ba] transition-colors shadow-ambient"
                  >
                    <span className="flex items-center gap-2 font-bold text-sm"><Download className="h-4 w-4" /> Download Statement PDF</span>
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
