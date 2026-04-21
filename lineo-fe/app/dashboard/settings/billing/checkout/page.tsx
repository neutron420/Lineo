'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  ShieldCheck, 
  ArrowLeft, 
  Zap, 
  ChevronRight, 
  CreditCard, 
  Info,
  CheckCircle2,
  Crown,
  Lock,
  Calendar,
  IndianRupee,
  ArrowRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Sparkles } from '@/components/ui/sparkles';

interface PlanDetail {
  id: string;
  name: string;
  priceMonthly: number;
  priceAnnually: number;
}

const plans: Record<string, PlanDetail> = {
  plus: { id: 'plus', name: 'Plus Membership', priceMonthly: 299, priceAnnually: 2999 },
  unlimited: { id: 'unlimited', name: 'Unlimited Membership', priceMonthly: 899, priceAnnually: 8999 }
};

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [currentUser, setUser] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const planId = searchParams.get('plan') || 'plus';
  const cycle = (searchParams.get('cycle') as 'monthly' | 'annually') || 'annually';
  const plan = plans[planId];

  useEffect(() => {
    const data = sessionStorage.getItem('user');
    if (data) setUser(JSON.parse(data));
  }, []);

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
           <Info className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold">Invalid Selection</h2>
        <Button onClick={() => router.back()}>Return to Billing</Button>
      </div>
    );
  }

  const basePrice = cycle === 'monthly' ? plan.priceMonthly : Math.floor(plan.priceMonthly * 12);
  const totalAmount = cycle === 'monthly' ? plan.priceMonthly : plan.priceAnnually;
  const savings = basePrice - totalAmount;

  const handleFinalPayment = async () => {
    setIsProcessing(true);
    try {
      const amountInPaise = totalAmount * 100;
      const orderResp = await api.post('/payments/razorpay/order', {
        amount: amountInPaise,
        currency: 'INR',
        receipt: `rcpt_chkout_${Date.now()}`
      });

      const orderData = orderResp.data.data;

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Lineo.ai",
        description: `Upgrade to ${plan.name} (${cycle})`,
        order_id: orderData.id,
        handler: async function () {
          try {
            await api.post('/user/upgrade', { tier: plan.id });
            const updatedUser = { ...currentUser, subscription_tier: plan.id };
            sessionStorage.setItem('user', JSON.stringify(updatedUser));
            toast.success("Payment Verified", { description: `You are now a ${plan.name} member!` });
            router.push('/dashboard/history');
          } catch {
            toast.error("Process Unsynchronized", { description: "Please contact support with Order ID." });
          }
        },
        prefill: { name: currentUser?.username, email: currentUser?.email },
        theme: { color: "#493ee5" }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch {
      toast.error("Gateway Offline", { description: "Unable to reach payment servers." });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-24 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      {/* Back Header */}
      <div className="flex items-center justify-between border-b border-[#e5e8eb] pb-6 px-4 md:px-0">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm font-bold text-[#49607e] hover:text-[#493ee5] transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Plans
        </button>
        <div className="flex items-center gap-2 text-xs font-black text-[#49607e] uppercase tracking-widest">
           <Lock className="w-3.5 h-3.5" /> Secure Transaction
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left Column: Form & Payment Methods (7 Cols) */}
        <div className="lg:col-span-8 space-y-10">
           <div className="space-y-4">
             <h1 className="text-4xl font-black text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Payment.</h1>
             <p className="text-[#49607e] font-medium leading-relaxed">
               Select your preferred method and verify details.
             </p>
           </div>

           {/* Payment Method Cards */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PaymentCard 
                name="Razorpay (UPI / Cards)" 
                expiry="Fastest & Most Secure" 
                icon={<img src="https://razorpay.com/favicon.png" className="h-6" alt="Razorpay" />} 
                selected={true}
                onClick={() => {}}
              />
              <PaymentCard 
                name="Visa ending in 7658" 
                expiry="Expiry 10/2026" 
                icon={<img src="https://img.icons8.com/color/48/000000/visa.png" className="w-12 h-8 object-contain" alt="Visa" />} 
                onClick={() => toast.info("Gateway Redirect", { description: "The system doesn't support Visa for now. Please use Razorpay." })}
              />
              <PaymentCard 
                name="Mastercard ending in 8489" 
                expiry="Expiry 10/2026" 
                icon={<img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" className="h-6" alt="Mastercard" />} 
                onClick={() => toast.info("Gateway Redirect", { description: "The system doesn't support Mastercard for now. Please use Razorpay." })}
              />
              <PaymentCard 
                name="Amazon Pay" 
                expiry="Select inside Razorpay" 
                icon={<img src="https://upload.wikimedia.org/wikipedia/commons/2/29/Amazon_Pay_logo.svg" className="h-4" alt="Amazon Pay" />} 
                onClick={() => toast.info("Integrated", { description: "Select Amazon Pay in the Razorpay portal." })}
              />
           </div>

           {/* Divider */}
           <div className="flex items-center gap-4 py-4">
              <div className="h-px bg-slate-100 flex-1" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">or add new payment method</span>
              <div className="h-px bg-slate-100 flex-1" />
           </div>

           {/* Billing Form */}
           <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Full name (as displayed on Card)*</label>
                    <input type="text" placeholder="John Doe" className="w-full bg-white border border-[#e2e8f0] rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-slate-950 outline-none transition-all placeholder:text-slate-300" />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Card Number*</label>
                    <input type="text" placeholder="xxxx xxxx xxxx xxxx" className="w-full bg-white border border-[#e2e8f0] rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-slate-950 outline-none transition-all placeholder:text-slate-300" />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Card expiration*</label>
                    <input type="text" placeholder="MM/YY" className="w-full bg-white border border-[#e2e8f0] rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-slate-950 outline-none transition-all placeholder:text-slate-300" />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">CVV*</label>
                    <input type="text" placeholder="123" className="w-full bg-white border border-[#e2e8f0] rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-slate-950 outline-none transition-all placeholder:text-slate-300" />
                 </div>
              </div>
              
              <div className="pt-4 space-y-4">
                 <Button 
                   onClick={handleFinalPayment}
                   disabled={isProcessing}
                   className="w-full h-12 bg-black text-white hover:bg-slate-800 transition-all rounded-lg text-sm font-bold shadow-sm"
                 >
                    {isProcessing ? "Processing..." : "Pay Now"}
                 </Button>
                 
                 <p className="text-[10px] text-center text-slate-400 font-medium tracking-tight">
                    Payment processed by <span className="underline cursor-help">Razorpay</span> for <span className="font-bold underline cursor-help text-slate-500">Lineo Membership</span> - United States Of America 
                 </p>
                 
                 <div className="flex flex-col items-center pt-2">
                    <ul className="text-[9px] text-[#493ee5] font-black uppercase tracking-[0.2em] space-y-1 text-center opacity-80 transition-all">
                       <li className="flex items-center justify-center gap-2">
                          <div className="w-1.5 h-1.5 bg-[#493ee5] rounded-full" /> 
                          The system only supports Razorpay for now
                       </li>
                       <li className="flex items-center justify-center gap-2">
                          <div className="w-1.5 h-1.5 bg-[#493ee5] rounded-full" /> 
                          Universal Bridge active for all local vectors
                       </li>
                    </ul>
                 </div>
              </div>
           </div>
        </div>

        {/* Right Column: Order Summary (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
           <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="space-y-6">
                 <div className="flex justify-between items-center bg-[#f8fafc] p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                          <IndianRupee className="w-5 h-5 text-white" />
                       </div>
                       <div>
                          <p className="text-sm font-bold text-slate-900 leading-none">{plan.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{cycle}</p>
                       </div>
                    </div>
                    <span className="text-sm font-black text-slate-900">₹{totalAmount}</span>
                 </div>

                 <div className="space-y-3 px-1">
                    <div className="flex justify-between items-center">
                       <span className="text-xs text-slate-400 font-medium">Original price</span>
                       <span className="text-xs text-slate-800 font-bold">₹{basePrice}.00</span>
                    </div>
                    {savings > 0 && (
                      <div className="flex justify-between items-center text-emerald-600">
                         <span className="text-xs font-medium">Savings</span>
                         <span className="text-xs font-bold">-₹{savings}.00</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                       <span className="text-xs text-slate-400 font-medium">Store pickup</span>
                       <span className="text-xs text-slate-800 font-bold">₹99</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-xs text-slate-400 font-medium">Tax</span>
                       <span className="text-xs text-slate-800 font-bold">₹799</span>
                    </div>
                 </div>
                 
                 <div className="pt-5 border-t border-slate-100 flex justify-between items-center px-1">
                    <span className="text-lg font-bold text-slate-900">Total</span>
                    <span className="text-xl font-black text-slate-900 opacity-90">₹{totalAmount}.00</span>
                 </div>
              </div>
           </div>

           {/* Free Shipping Badge */}
           <div className="bg-[#f8fafc] border border-slate-100 p-6 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                 <ShieldCheck className="w-5 h-5" /> <span>Free Shipping</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                You have 3 months to try free shipping and exclusive Genius offers.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}

function PaymentCard({ name, expiry, icon, onClick, selected }: { name: string, expiry: string, icon: React.ReactNode, onClick: () => void, selected?: boolean }) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "p-6 bg-white border rounded-xl transition-all cursor-pointer flex items-start justify-between relative group",
        selected ? "border-slate-300 shadow-sm ring-1 ring-slate-100" : "border-slate-200 hover:border-slate-300"
      )}
    >
       <div className="space-y-1">
          <div className="flex items-center gap-3">
             <div className={cn(
               "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
               selected ? "border-slate-900" : "border-slate-300"
             )}>
                {selected && <div className="w-2 h-2 bg-slate-900 rounded-full" />}
             </div>
             <p className="text-[13px] font-bold text-slate-800 tracking-tight">{name}</p>
          </div>
          <p className="text-[11px] text-slate-400 font-medium ml-7">{expiry}</p>
          <div className="flex gap-4 ml-7 pt-4 text-[10px] font-bold text-slate-400">
             <span className="hover:text-slate-900 transition-colors">Delete</span>
             <span className="hover:text-slate-900 transition-colors">Edit</span>
          </div>
       </div>
       <div className="shrink-0 pt-1">
          {icon}
       </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-20 animate-pulse">Initializing Secure Tunnel...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
