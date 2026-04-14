"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Heart, Landmark, Building2 } from "lucide-react";

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState("user");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 2000);
  };

  return (
    <div className="min-h-screen bg-stripe-border/10 flex flex-col items-center justify-center p-6 selection:bg-stripe-purple/20 selection:text-stripe-purple">
      <Link href="/" className="mb-10 text-stripe-slate hover:text-stripe-navy transition-colors flex items-center gap-2 group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to QueueLess
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="stripe-card w-full max-w-[500px] p-10 bg-white"
      >
        <div className="mb-10 text-center">
          <h1 className="text-[26px] tracking-stripe-tight mb-2 text-stripe-navy">Get started.</h1>
          <p className="text-[15px] text-stripe-slate">Choose your account type to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-3 gap-3 mb-8">
            <RoleCard 
              label="Standard" 
              active={selectedRole === 'user'} 
              icon={<Building2 className="w-4 h-4" />}
              onClick={() => setSelectedRole('user')} 
            />
            <RoleCard 
              label="Agent" 
              active={selectedRole === 'agent'} 
              icon={<Heart className="w-4 h-4" />}
              onClick={() => setSelectedRole('agent')} 
            />
            <RoleCard 
              label="Admin" 
              active={selectedRole === 'admin'} 
              icon={<Landmark className="w-4 h-4" />}
              onClick={() => setSelectedRole('admin')} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-normal text-stripe-label">Username</label>
              <input type="text" placeholder="johndoe" className="stripe-input" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-normal text-stripe-label">Full Name</label>
              <input type="text" placeholder="John Doe" className="stripe-input" required />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-normal text-stripe-label">Email address</label>
            <input type="email" placeholder="name@company.com" className="stripe-input" required />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-normal text-stripe-label">Password</label>
            <input type="password" placeholder="••••••••" className="stripe-input" required />
          </div>

          <p className="text-[13px] text-stripe-slate/60 leading-snug">
            By clicking "Create account", you agree to our Terms of Service and Privacy Policy. No credit card required.
          </p>

          <button
            type="submit"
            disabled={isLoading}
            className="stripe-btn-primary w-full flex items-center justify-center gap-2 py-3"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create an account"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-stripe-border text-center">
          <p className="text-sm text-stripe-slate">
            Already have an account?{" "}
            <Link href="/login" className="text-stripe-purple font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function RoleCard({ label, active, onClick, icon }: { label: string; active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-3 rounded-stripe border flex flex-col items-center gap-2 transition-all ${
        active 
          ? 'border-stripe-purple bg-stripe-purple/5 ring-1 ring-stripe-purple text-stripe-purple' 
          : 'border-stripe-border bg-white text-stripe-slate hover:border-stripe-slate/30'
      }`}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
