"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Check, 
  Zap, 
  Building2, 
  Users, 
  BarChart3, 
  Clock, 
  ShieldCheck, 
  Crown,
  Rocket,
  Globe,
  Loader2,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Constants ──────────────────────────────────────

const TIERS = [
  {
    level: 0,
    name: "Starter",
    price: 0,
    target: "Perfect for local shops",
    icon: <Users className="w-5 h-5" />,
    color: "slate",
    features: [
      "2 Queues (Active)",
      "50 Daily Tickets",
      "7 Days History",
      "Basic Analytics",
      "Community Support"
    ]
  },
  {
    level: 1,
    name: "Standard",
    price: 999,
    target: "Growth for small clinics",
    icon: <Rocket className="w-5 h-5" />,
    color: "blue",
    features: [
      "5 Queues (Active)",
      "250 Daily Tickets",
      "30 Days History",
      "SMS Notifications (50/mo)",
      "Standard Analytics",
      "Email Support"
    ],
    recommended: true
  },
  {
    level: 2,
    name: "Pro",
    price: 2499,
    target: "Banks & Medium Hospitals",
    icon: <Zap className="w-5 h-5" />,
    color: "indigo",
    features: [
      "15 Queues (Active)",
      "1,000 Daily Tickets",
      "90 Days History",
      "SMS Notifications (500/mo)",
      "VIP Priority Access",
      "Advanced Pulse Dashboard",
      "Priority Support"
    ]
  },
  {
    level: 3,
    name: "Scale",
    price: 5999,
    target: "Multi-location chains",
    icon: <Globe className="w-5 h-5" />,
    color: "purple",
    features: [
      "50 Queues (Active)",
      "5,000 Daily Tickets",
      "1 Year History",
      "Unlimited SMS",
      "Custom QR Branding",
      "API Access",
      "24/7 Phone Support"
    ]
  },
  {
    level: 4,
    name: "Enterprise",
    price: 12999,
    target: "Large Institutions",
    icon: <Crown className="w-5 h-5" />,
    color: "gold",
    features: [
      "Unlimited Queues",
      "Unlimited Daily Tickets",
      "Infinite History",
      "Smart Commuter Sync",
      "Dedicated Manager",
      "White-label Branding",
      "Custom SLAs"
    ]
  }
];

// ─────────────────────────────────────────────────────

export default function BillingPage() {
  const [org, setOrg] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<number | null>(null);

  useEffect(() => {
    fetchOrgStatus();
  }, []);

  const fetchOrgStatus = async () => {
    try {
      const resp = await api.get("/org/settings/profile"); // Assuming this profile exists
      setOrg(resp.data.data);
    } catch (err) {
      console.error("Failed to fetch org status", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = async (tier: any) => {
    if (tier.level <= (org?.subscription_tier || 0)) {
      toast.info("Active Tier", { description: "You are already on this or a higher plan." });
      return;
    }

    setIsProcessing(tier.level);
    
    // Simulate Razorpay Handshake
    toast.info(`Initiating Protocol: ${tier.name}`, { 
      description: `Connecting to Razorpay for ${tier.name} Tier...` 
    });

    try {
      // In a real app: 
      // 1. const order = await api.post("/payment/create-order", { tier: tier.level });
      // 2. Open Razorpay Checkout with order.id
      
      setTimeout(async () => {
        // Simulate Success Callback
        try {
          await api.post("/org/billing/upgrade", { 
            tier_level: tier.level,
            payment_id: "pay_simulated_" + Math.random().toString(36).substring(7)
          });
          
          toast.success("Tier Pulse Activated!", { 
            description: `Successfully upgraded to ${tier.name} Plan.` 
          });
          fetchOrgStatus();
        } catch (err) {
          toast.error("Upgrade Sync Failed", { description: "Payment verified but DB update failed." });
        } finally {
          setIsProcessing(null);
        }
      }, 2000);

    } catch (err) {
      toast.error("Payment Handshake Error", { description: "Razorpay portal is unreachable." });
      setIsProcessing(null);
    }
  };

	

  if (isLoading) {
    return (
      <div className="space-y-12 pb-20 w-full">
        {/* Header Skeleton */}
        <div className="text-center space-y-4 pt-10 flex flex-col items-center">
          <Skeleton className="h-8 w-48 rounded-full" />
          <Skeleton className="h-12 w-96 rounded-2xl" />
          <Skeleton className="h-4 w-128 rounded-lg" />
        </div>

        {/* Current Plan Skeleton */}
        <div className="p-6 bg-white/50 rounded-3xl border border-slate-100 flex items-center justify-between gap-6">
           <div className="flex items-center gap-5">
              <Skeleton className="w-14 h-14 rounded-2xl" />
              <div className="space-y-2">
                 <Skeleton className="h-6 w-40" />
                 <Skeleton className="h-4 w-24" />
              </div>
           </div>
           <div className="flex gap-8">
              <Skeleton className="h-12 w-24 rounded-xl" />
              <Skeleton className="h-12 w-24 rounded-xl" />
           </div>
        </div>

        {/* Pricing Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map((v) => (
            <div key={v} className="bg-white border border-slate-100 rounded-[32px] p-8 space-y-8 h-[600px]">
               <Skeleton className="w-12 h-12 rounded-xl" />
               <div className="space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-4 w-2/3" />
               </div>
               <div className="space-y-4 mt-8">
                  {[1, 2, 3, 4, 5].map((s) => <Skeleton key={s} className="h-3 w-full" />)}
               </div>
               <Skeleton className="h-14 w-full rounded-2xl mt-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20 w-full">
      {/* Header Section */}
      <div className="text-center space-y-4 pt-10">
        <Badge variant="outline" className="bg-[#493ee5]/5 text-[#493ee5] border-[#493ee5]/20 px-4 py-1.5 rounded-full font-bold">
          <ShieldCheck className="w-3.5 h-3.5 mr-2" /> Tier Expansion Center
        </Badge>
        <h1 className="text-4xl md:text-5xl font-black text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
          Scale your institutional <span className="text-[#493ee5]">pulse.</span>
        </h1>
        <p className="text-[#49607e] max-w-2xl mx-auto text-lg font-medium">
          Choose a plan that fits your current volume. Upgrade instantly to unlock higher queue limits and real-time telemetry.
        </p>
      </div>

      {/* Current Plan Status */}
      <div className="glass-panel rounded-3xl p-6 ghost-border flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#493ee5]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-[#493ee5] rounded-2xl flex items-center justify-center text-white shadow-neobrutal">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{org?.name || "Institution Node"}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold text-[#49607e] uppercase tracking-widest">Active Plan:</span>
              <Badge className="bg-[#181c1e] text-white capitalize">{org?.subscription_status || "starter"}</Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-8">
           <div className="text-center md:text-right">
              <p className="text-xs font-bold text-[#49607e] uppercase tracking-widest mb-1">Queue Limit</p>
              <p className="text-2xl font-black text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                 {org?.max_queues || 2} <span className="text-sm font-medium text-[#49607e]/60">units</span>
              </p>
           </div>
           <div className="text-center md:text-right">
              <p className="text-xs font-bold text-[#49607e] uppercase tracking-widest mb-1">Daily Tickets</p>
              <p className="text-2xl font-black text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                 {org?.daily_ticket_limit || 50} <span className="text-sm font-medium text-[#49607e]/60">spots</span>
              </p>
           </div>
        </div>
      </div>

      {/* Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {TIERS.map((tier, idx) => {
          const isCurrent = (org?.subscription_tier ?? 0) === tier.level;
          const isLower = (org?.subscription_tier ?? 0) > tier.level;

          return (
            <motion.div
              key={tier.level}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -5 }}
              className="h-full"
            >
              <Card className={cn(
                "h-full flex flex-col rounded-3xl overflow-hidden transition-all duration-300 border-[1.5px]",
                tier.recommended ? "border-[#493ee5] shadow-ambient ring-4 ring-[#493ee5]/5" : "border-slate-200/60 shadow-sm hover:shadow-md",
                isCurrent && "border-green-500 bg-green-50/10"
              )}>
                {tier.recommended && (
                  <div className="bg-[#493ee5] text-white py-1.5 text-center text-xs font-black uppercase tracking-[2px]">
                    Most Productive
                  </div>
                )}
                
                <CardHeader className="p-8">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center mb-6",
                    tier.color === 'slate' && "bg-slate-100 text-slate-600",
                    tier.color === 'blue' && "bg-blue-50 text-blue-600",
                    tier.color === 'indigo' && "bg-indigo-50 text-indigo-600",
                    tier.color === 'purple' && "bg-purple-50 text-purple-600",
                    tier.color === 'gold' && "bg-amber-50 text-amber-600",
                  )}>
                    {tier.icon}
                  </div>
                  <CardTitle className="text-2xl font-black">{tier.name}</CardTitle>
                  <CardDescription className="font-medium">{tier.target}</CardDescription>
                  <div className="mt-8 flex items-baseline">
                    <span className="text-4xl font-black text-[#181c1e]">₹{tier.price.toLocaleString()}</span>
                    <span className="text-[#49607e] font-bold ml-1">/mo</span>
                  </div>
                </CardHeader>

                <CardContent className="p-8 pt-0 flex-1">
                  <div className="space-y-4">
                    {tier.features.map((feature, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-3">
                        <div className="mt-1 bg-green-100 p-0.5 rounded-full">
                          <Check className="w-3 h-3 text-green-700" />
                        </div>
                        <span className="text-sm font-semibold text-[#49607e]">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>

                <CardFooter className="p-8 bg-slate-50/50 border-t border-slate-100">
                  <Button 
                    className={cn(
                      "w-full h-12 rounded-xl text-sm font-bold shadow-neobrutal transition-all",
                      isCurrent ? "bg-green-600 hover:bg-green-700 pointer-events-none" : 
                      isLower ? "bg-slate-200 text-slate-500 pointer-events-none shadow-none" :
                      tier.recommended ? "kinetic-btn-primary" : "bg-[#181c1e] hover:bg-[#2c3336] text-white"
                    )}
                    onClick={() => handleUpgrade(tier)}
                    disabled={isProcessing === tier.level || isCurrent || isLower}
                  >
                    {isProcessing === tier.level ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : isCurrent ? (
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4" /> Current Plan
                      </div>
                    ) : isLower ? (
                      "Legacy Plan"
                    ) : (
                      `Select ${tier.name}`
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Trust Badge */}
      <div className="text-center pt-8">
        <div className="inline-flex items-center gap-6 text-[#49607e]/60 grayscale opacity-70">
           <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">PCI Compliant</span>
           </div>
           <div className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Instant Upgrade</span>
           </div>
           <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Secure Protocol</span>
           </div>
        </div>
      </div>
    </div>
  );
}
