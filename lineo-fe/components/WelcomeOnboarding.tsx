"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, ChevronRight, Zap, MapPin, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WelcomeOnboarding() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem("onboarding_complete");
    if (!hasSeenOnboarding) {
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const finish = () => {
    localStorage.setItem("onboarding_complete", "true");
    setIsOpen(false);
  };

  const steps = [
    {
      title: "Welcome to Lineo.ai",
      desc: "Your professional queue & appointment manager. Skip the physical line, forever.",
      icon: <Sparkles className="w-8 h-8 text-[#493ee5]" />,
      color: "bg-[#493ee5]/10"
    },
    {
      title: "Live Discovery",
      desc: "Find nearby banks, hospitals, and more. Join queues remotely or book spots in advance.",
      icon: <MapPin className="w-8 h-8 text-emerald-500" />,
      color: "bg-emerald-500/10"
    },
    {
      title: "Smart Commute",
      desc: "We notify you exactly when to leave based on real-time traffic and queue status.",
      icon: <Zap className="w-8 h-8 text-amber-500" />,
      color: "bg-amber-500/10"
    },
    {
      title: "Ready to Start?",
      desc: "Your dashboard is ready. Let's make your time more productive.",
      icon: <Calendar className="w-8 h-8 text-[#635bff]" />,
      color: "bg-[#635bff]/10"
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#181c1e]/60 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="w-full max-w-[440px] bg-white rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col items-center text-center p-10 space-y-8"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#493ee5]/5 rounded-full blur-3xl -mr-20 -mt-20" />
            
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8 flex flex-col items-center"
              >
                <div className={`w-20 h-20 ${steps[step].color} rounded-[28px] flex items-center justify-center shadow-sm`}>
                   {steps[step].icon}
                </div>
                
                <div className="space-y-3">
                  <h2 className="text-3xl font-black text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                    {steps[step].title}
                  </h2>
                  <p className="text-[#49607e] font-medium leading-relaxed max-w-[280px]">
                    {steps[step].desc}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Dots */}
            <div className="flex gap-2">
              {steps.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? "w-8 bg-[#493ee5]" : "w-1.5 bg-[#e5e8eb]"}`} />
              ))}
            </div>

            <div className="flex flex-col gap-3 w-full pt-4">
              <Button 
                onClick={() => step < steps.length - 1 ? setStep(step + 1) : finish()}
                className="h-14 bg-[#493ee5] hover:bg-[#3d33c4] text-white rounded-[22px] font-black text-sm uppercase tracking-widest shadow-xl group"
              >
                {step === steps.length - 1 ? "Get Started" : "Continue"}
                <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              
              <button 
                onClick={finish}
                className="text-[11px] font-black text-[#49607e] uppercase tracking-widest hover:text-[#181c1e] transition-colors"
              >
                Skip Guide
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
