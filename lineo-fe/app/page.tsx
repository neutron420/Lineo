"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Zap, Star, Sparkles as SparklesIcon, LayoutGrid } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles";
import { Features as FeaturesSection } from "@/components/features-8";
import RuixenBentoCards from "@/components/ruixen-bento-cards";
import { CreativePricing } from "@/components/ui/creative-pricing";
import { LogoCloud } from "@/components/logo-cloud-2";
import Testimonials from "@/components/testimonials";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden selection:bg-stripe-purple/20 selection:text-stripe-purple text-left">
      {/* 🏛️ Sticky Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-md border-b border-stripe-border/50 transition-all">
        <nav className="max-w-[1080px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-medium tracking-tight text-stripe-navy lowercase hover:opacity-80 transition-opacity">
              <span className="text-stripe-purple">lineo</span>.ai
            </Link>
            
            <div className="hidden md:flex items-center gap-6">
              <NavLink href="#features">Features</NavLink>
              <NavLink href="#solutions">Solutions</NavLink>
              <NavLink href="#pricing">Pricing</NavLink>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login" className="text-[14px] font-normal text-stripe-navy hover:text-stripe-purple transition-colors">
              Sign in
            </Link>
            <Link href="/register" className="stripe-btn-primary px-4 py-1.5 text-sm">
              Start now
            </Link>
          </div>
        </nav>
      </header>

      {/* 🚀 Hero Section */}
      <main className="relative pt-32 pb-24 overflow-hidden">
        {/* ✨ Sparkles Background */}
        <div className="absolute inset-0 z-0 h-full w-full">
          <Sparkles
            id="hero-sparkles"
            background="transparent"
            minSize={0.6}
            size={1.4}
            density={100}
            className="w-full h-full"
            color="#635bff"
          />
        </div>

        <div className="max-w-[1080px] mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <h1 className="text-[56px] leading-[1.03] tracking-stripe-hero text-stripe-navy mb-8 font-medium">
                In-person waiting, reimagined.
              </h1>
              <p className="text-[18px] text-stripe-slate leading-relaxed mb-10 max-w-[440px]">
                The world&apos;s most advanced queue management system for hospitals, banks, and retailers. Scale your operations, eliminate wait times, and delight your customers.
              </p>

              <div className="flex items-center gap-4">
                <Link href="/register" className="stripe-btn-primary group flex items-center gap-2 pr-4">
                  Start now <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link href="/solutions" className="stripe-btn-ghost group flex items-center gap-2 pr-4 text-stripe-navy">
                  Connect sales <ArrowRight className="w-4 h-4 text-stripe-slate group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </motion.div>

            {/* 📸 Dashboard Preview Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: 50 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
              className="relative"
            >
              <div className="stripe-card relative z-10 p-6 min-h-[400px] bg-white text-left">
                <div className="flex items-center justify-between mb-8 border-b border-stripe-border pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-stripe bg-stripe-brandDark flex items-center justify-center text-white">
                      <LayoutGrid className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-stripe-navy">City Care Hospital</h3>
                      <p className="text-xs text-stripe-slate">Reception Queue</p>
                    </div>
                  </div>
                  <span className="bg-stripe-green/10 text-stripe-greenDark text-[10px] px-2 py-0.5 rounded-stripe font-normal border border-stripe-green/20">
                    Active
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <StatCard label="Avg. Wait Time" value="4m 12s" trend="-12%" />
                  <StatCard label="Total Served" value="1,245" trend="+5%" />
                </div>

                <div className="space-y-3">
                  <QueueEntry token="T-5A9" name="Arjun Singh" status="Serving" />
                  <QueueEntry token="T-5B0" name="Rahul Mehta" status="Waiting" />
                  <QueueEntry token="T-5B1" name="Sneha Kapur" status="Waiting" />
                </div>
              </div>
              
              {/* Decorative Gradients (Stripe Style) */}
              <div className="absolute -top-20 -right-20 w-[400px] h-[400px] bg-stripe-purple/10 blur-[100px] -z-10 rounded-full" />
              <div className="absolute -bottom-20 -left-20 w-[300px] h-[300px] bg-stripe-magenta/10 blur-[100px] -z-10 rounded-full" />
            </motion.div>
          </div>
          <div className="max-w-[800px] mx-auto mt-20">
            <LogoCloud />
          </div>
        </div>
      </main>

      {/* 🚀 Trust Bar (Alternative place for grid cloud) */}
      <section className="bg-white border-y border-stripe-border/50">
        <div className="max-w-[1080px] mx-auto">
          {/* LogoCloud 2 is self-contained as a grid */}
        </div>
      </section>

      {/* 💎 Feature Grid (Upgraded) */}
      <FeaturesSection />

      {/* 🧩 Bento Showcases */}
      <section id="solutions" className="py-24 bg-white text-left">
        <div className="max-w-[1080px] mx-auto px-6">
          <div className="mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-stripe-navy mb-4 font-medium">Powerful from every angle</h2>
            <p className="text-stripe-slate text-lg">Detailed features that set us apart from traditional systems.</p>
          </div>
          <RuixenBentoCards />
        </div>
      </section>

      {/* 💬 Client Testimonials */}
      <Testimonials />

      {/* 💰 Creative Pricing Section */}
      <section id="pricing" className="py-24 bg-zinc-50/50 text-left">
        <CreativePricing 
          tag="Fair Pricing"
          title="Plans for every scale"
          description="From solo clinics to national banking networks."
          tiers={[
            {
              name: "Clinic Starter",
              price: 29,
              description: "Perfect for local clinics and small offices.",
              features: ["2 active counters", "SMS notifications", "Basic analytics", "Email support"],
              color: "blue",
              icon: <Zap className="w-6 h-6" />
            },
            {
              name: "Bank Pro",
              price: 99,
              description: "Advanced features for busy branches.",
              features: ["10 active counters", "Kiosk mode support", "Advanced reporting", "Priority support"],
              popular: true,
              color: "amber",
              icon: <Star className="w-6 h-6" />
            },
            {
              name: "Enterprise",
              price: 299,
              description: "Full fleet management for large networks.",
              features: ["Unlimited counters", "API access", "Custom branding", "24/7 dedicated support"],
              color: "purple",
              icon: <SparklesIcon className="w-6 h-6" />
            }
          ]}
        />
      </section>


      {/* 🏁 Footer */}
      <footer className="bg-white border-t border-stripe-border py-16 text-left">
        <div className="max-w-[1080px] mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-16">
            <div className="col-span-2">
              <Link href="/" className="text-xl font-medium tracking-tight text-stripe-navy lowercase mb-4 block">
                <span className="text-stripe-purple">lineo</span>.ai
              </Link>
              <p className="text-stripe-slate text-sm max-w-[240px]">
                The world&apos;s most advanced queue management platform. Built for performance, designed for people.
              </p>
            </div>
            <div>
              <h4 className="text-[13px] font-medium uppercase tracking-wider text-stripe-navy mb-4">Product</h4>
              <ul className="space-y-2 text-left">
                <li><FooterLink href="#">Features</FooterLink></li>
                <li><FooterLink href="#">Integrations</FooterLink></li>
                <li><FooterLink href="#">Solutions</FooterLink></li>
                <li><FooterLink href="#">Pricing</FooterLink></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[13px] font-medium uppercase tracking-wider text-stripe-navy mb-4">Company</h4>
              <ul className="space-y-2 text-left">
                <li><FooterLink href="#">About</FooterLink></li>
                <li><FooterLink href="#">Customers</FooterLink></li>
                <li><FooterLink href="#">Careers</FooterLink></li>
                <li><FooterLink href="#">Contact</FooterLink></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[13px] font-medium uppercase tracking-wider text-stripe-navy mb-4">Legal</h4>
              <ul className="space-y-2 text-left">
                <li><FooterLink href="#">Privacy</FooterLink></li>
                <li><FooterLink href="#">Terms</FooterLink></li>
                <li><FooterLink href="#">Security</FooterLink></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-stripe-border flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-stripe-slate">
            <p>© 2026 Lineo. All rights reserved.</p>
            <div className="flex gap-6">
              <Link href="#" className="hover:text-stripe-navy transition-colors">Twitter</Link>
              <Link href="#" className="hover:text-stripe-navy transition-colors">LinkedIn</Link>
              <Link href="#" className="hover:text-stripe-navy transition-colors">GitHub</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-[14px] font-normal text-stripe-navy/70 hover:text-stripe-navy transition-all relative group">
      {children}
      <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-stripe-purple transition-all group-hover:w-full"></span>
    </Link>
  );
}

function StatCard({ label, value, trend }: { label: string; value: string; trend: string }) {
  return (
    <div className="p-4 bg-stripe-border/20 rounded-stripe text-left">
      <p className="text-xs text-stripe-slate mb-1">{label}</p>
      <div className="flex items-end justify-between">
        <span className="text-lg font-normal tabular">{value}</span>
        <span className={`text-[10px] ${trend.startsWith('-') ? 'text-stripe-green' : 'text-stripe-ruby'}`}>
          {trend}
        </span>
      </div>
    </div>
  );
}

function QueueEntry({ token, name, status }: { token: string; name: string; status: string }) {
  return (
    <div className="flex items-center justify-between p-3 border border-stripe-border/50 rounded-stripe hover:bg-stripe-border/10 transition-colors text-left">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium tabular text-stripe-purple bg-stripe-purple/10 px-1.5 py-0.5 rounded-stripe">{token}</span>
        <span className="text-sm text-stripe-navy">{name}</span>
      </div>
      <span className={`text-[11px] ${status === 'Serving' ? 'text-stripe-purple' : 'text-stripe-slate'}`}>
        {status}
      </span>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm text-stripe-slate hover:text-stripe-navy transition-colors">
      {children}
    </Link>
  );
}
