'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Zap, 
  Check, 
  Shield, 
  Crown, 
  ArrowRight, 
  Sparkles, 
  Timer, 
  Users, 
  Bell,
  CreditCard,
  Rocket
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { toast } from 'sonner';

import { PricingComponent, PriceTier, BillingCycle } from '@/components/pricing-card';

const plans: [PriceTier, PriceTier, PriceTier] = [
  {
    id: 'starter',
    name: 'Basic',
    description: 'Perfect for occasional visits and individual needs.',
    priceMonthly: 0,
    priceAnnually: 0,
    isPopular: false,
    buttonLabel: 'Current Plan',
    features: [
      { name: '3 Queue Joins / Day', isIncluded: true },
      { name: '2 Appointments / Day', isIncluded: true },
      { name: 'Standard SMS Alerts', isIncluded: true },
      { name: 'Email Support', isIncluded: true },
      { name: 'Priority VIP Passes', isIncluded: false },
      { name: 'Concierge Support', isIncluded: false },
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    description: 'Boost your access for regular institutional visits.',
    priceMonthly: 299,
    priceAnnually: 2999, // ~₹249/mo
    isPopular: true,
    buttonLabel: 'Upgrade to Plus',
    features: [
      { name: '15 Queue Joins / Day', isIncluded: true },
      { name: '10 Appointments / Day', isIncluded: true },
      { name: 'Real-time Commute Alerts', isIncluded: true },
      { name: 'Priority Notifications', isIncluded: true },
      { name: '3 VIP Priority Passes/mo', isIncluded: true },
      { name: 'Concierge Support', isIncluded: false },
    ],
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    description: 'Absolute power with zero limits and VIP status.',
    priceMonthly: 899,
    priceAnnually: 8999, // ~₹749/mo
    isPopular: false,
    buttonLabel: 'Go Unlimited',
    features: [
      { name: 'Unlimited Daily Joins', isIncluded: true },
      { name: 'Unlimited Appointments', isIncluded: true },
      { name: 'Permanent VIP Status', isIncluded: true },
      { name: 'Early Access features', isIncluded: true },
      { name: 'Real-time Commute Alerts', isIncluded: true },
      { name: '24/7 Concierge Support', isIncluded: true },
    ],
  },
];

export default function BillingPage() {
  const router = useRouter();
  const [currentUser, setUser] = useState<any>(null);
  const [cycle, setCycle] = useState<BillingCycle>('annually');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  useEffect(() => {
    const data = sessionStorage.getItem('user');
    if (data) setUser(JSON.parse(data));
  }, []);

  const handlePlanSelect = (planId: string, currentCycle: BillingCycle) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan || currentUser?.subscription_tier === planId) return;
    if (planId === 'starter') return;

    // Navigate to Checkout Page
    router.push(`/dashboard/settings/billing/checkout?plan=${planId}&cycle=${currentCycle}`);
  };

  return (
    <div className="w-full space-y-12 pb-20 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      {/* Header Section */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8 border-b border-[#e5e8eb] pb-12">
        <div className="space-y-4 flex-1">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 bg-[#493ee5]/5 text-[#493ee5] rounded-full text-[10px] font-black uppercase tracking-widest border border-[#493ee5]/10"
          >
            <Sparkles className="w-3 h-3" /> Membership Ecosystem
          </motion.div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-black text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
            Elevate your <span className="text-[#493ee5]">Access.</span>
          </h1>
          <p className="text-[#49607e] text-base md:text-xl font-medium leading-relaxed max-w-xl">
            Choose the plan that matches your daily movement. Instant activation upon checkout.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#f8fafc] p-2 rounded-[28px] border border-[#e2e8f0] shadow-sm">
           <div className="flex items-center gap-4 px-4 py-2 bg-white rounded-[22px] border border-[#e2e8f0] shadow-sm">
             <div className="w-10 h-10 rounded-xl bg-[#493ee5]/5 flex items-center justify-center text-[#493ee5]">
                <Crown className="w-5 h-5" />
             </div>
             <div>
                <p className="text-[9px] font-black text-[#64748b] uppercase tracking-widest">Active Plan</p>
                <p className="text-sm font-black text-[#1e293b] capitalize">{currentUser?.subscription_tier || 'Basic'}</p>
             </div>
           </div>
        </div>
      </div>

      {/* New Pricing Component */}
      <div className="-mt-8">
        <PricingComponent
          plans={plans}
          billingCycle={cycle}
          onCycleChange={setCycle}
          onPlanSelect={handlePlanSelect}
        />
      </div>

      {/* Security & Support Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-10">
         <MetricBox 
          icon={<Shield className="w-5 h-5" />} 
          title="Bank Grade Security" 
          desc="PCI-DSS compliant transactions processed securely via Razorpay encryption." 
         />
         <MetricBox 
          icon={<CreditCard className="w-5 h-5" />} 
          title="Flexible Payments" 
          desc="Support for UPI, Net Banking, and all major cards with instant activation." 
         />
         <MetricBox 
          icon={<Rocket className="w-5 h-5" />} 
          title="Scale Mid-Month" 
          desc="Limits update the millisecond your transaction is verified by our network." 
         />
      </div>
    </div>
  );
}

function MetricBox({ icon, title, desc }: { icon: React.ReactNode; title: string, desc: string }) {
  return (
    <div className="p-4 md:p-6 bg-white rounded-2xl border border-[#e5e8eb] hover:shadow-sm transition-all space-y-3">
       <div className="w-10 h-10 bg-[#f1f4f7] rounded-xl flex items-center justify-center text-[#493ee5]">
          {icon}
       </div>
       <div>
          <h4 className="text-sm font-black text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{title}</h4>
          <p className="text-xs text-[#49607e] font-medium leading-relaxed mt-1">{desc}</p>
       </div>
    </div>
  );
}
