"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Navigation, Search, X, Shield, Map as MapIcon } from "lucide-react";
import { useLocation } from "@/context/LocationContext";

export default function LocationRequestModal() {
  const { refreshLocation, address } = useLocation();
  const [show, setShow] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Show modal if location is default/detecting and not already prompted this session
    const hasPrompted = sessionStorage.getItem("location_prompted");
    if (!hasPrompted && address === "Detecting Location...") {
      const timer = setTimeout(() => setShow(true), 1500); // Wait a bit for effect
      return () => clearTimeout(timer);
    }
  }, [address]);

  const handleGrant = async () => {
    sessionStorage.setItem("location_prompted", "true");
    await refreshLocation();
    setShow(false);
  };

  const handleManual = () => {
    setManualMode(true);
  };

  const handleClose = () => {
    sessionStorage.setItem("location_prompted", "true");
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-stripe-navy/20 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-[440px] bg-white rounded-[32px] shadow-2xl overflow-hidden relative"
          >
            <button 
              onClick={handleClose}
              className="absolute top-6 right-6 p-2 text-stripe-slate hover:bg-stripe-border/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-10">
              <div className="mb-8">
                <div className="w-16 h-16 bg-stripe-purple/10 rounded-[22px] flex items-center justify-center mb-6">
                  <Navigation className="w-8 h-8 text-stripe-purple animate-pulse" />
                </div>
                <h2 className="text-2xl font-semibold text-stripe-navy tracking-tight mb-2">Explore institutions nearby</h2>
                <p className="text-sm text-stripe-slate leading-relaxed">
                  To provide the most accurate queue times and nearby services, Lineo needs to synchronize with your physical location.
                </p>
              </div>

              {!manualMode ? (
                <div className="space-y-4">
                  <button 
                    onClick={handleGrant}
                    className="w-full bg-stripe-purple text-white py-4 rounded-stripe font-medium hover:bg-stripe-purpleDark transition-all flex items-center justify-center gap-3 shadow-lg shadow-stripe-purple/20"
                  >
                    <MapPin className="w-4 h-4" /> Grant location access
                  </button>
                  <button 
                    onClick={handleManual}
                    className="w-full bg-white border border-stripe-border text-stripe-navy py-4 rounded-stripe font-medium hover:bg-stripe-border/10 transition-all flex items-center justify-center gap-3"
                  >
                    <Search className="w-4 h-4" /> Search manually
                  </button>
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stripe-slate" />
                    <input 
                      type="text"
                      placeholder="Enter city or pincode"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-stripe-border/10 border border-stripe-border rounded-stripe outline-none focus:border-stripe-purple focus:bg-white transition-all text-sm font-medium"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setManualMode(false)}
                      className="px-6 py-4 bg-stripe-border/20 text-stripe-navy rounded-stripe font-medium hover:bg-stripe-border/30 transition-all text-sm"
                    >
                      Back
                    </button>
                    <button 
                      className="flex-1 bg-stripe-navy text-white py-4 rounded-stripe font-medium hover:bg-black transition-all text-sm shadow-xl"
                    >
                      Locate
                    </button>
                  </div>
                </motion.div>
              )}

              <div className="mt-8 pt-8 border-t border-stripe-border flex items-center justify-center gap-6 opacity-40">
                <div className="flex items-center gap-1.5 grayscale">
                  <Shield className="w-3 h-3" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Encrypted</span>
                </div>
                <div className="flex items-center gap-1.5 grayscale">
                  <MapIcon className="w-3 h-3" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Anonymous</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
