"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, MessageSquare, AlertCircle, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("bug");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    try {
      await api.post("/feedback", {
        message,
        category,
        priority: category === "bug" ? "high" : "low"
      });
      toast.success("Feedback Received", { 
        description: "Thank you for helping us improve Lineo!" 
      });
      setMessage("");
      onClose();
    } catch {
      toast.error("Submission Failed", { 
        description: "Please try again later or check your connection." 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#181c1e]/40 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-6 right-6 w-full max-w-[400px] bg-white rounded-[32px] shadow-2xl z-[101] overflow-hidden border border-[#e5e8eb]"
          >
            <div className="p-6 bg-[#493ee5] text-white relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Report an Issue</h3>
                    <p className="text-white/60 text-[10px] uppercase font-black tracking-widest">Help us evolve Lineo</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-white">
              <div className="space-y-3">
                <p className="text-xs font-bold text-[#49607e] uppercase tracking-widest">What&apos;s the context?</p>
                <div className="grid grid-cols-2 gap-3">
                  {["bug", "suggestion"].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${
                        category === cat 
                          ? "bg-[#493ee5]/5 border-[#493ee5] text-[#493ee5] shadow-sm" 
                          : "bg-[#f1f4f7] border-transparent text-[#49607e] hover:bg-white hover:border-[#e5e8eb]"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#49607e] uppercase tracking-widest">Description</label>
                <textarea
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what's happening or what you'd like to see..."
                  className="w-full h-32 p-4 bg-[#f1f4f7] rounded-2xl text-sm font-medium resize-none outline-none focus:bg-white focus:ring-4 focus:ring-[#493ee5]/5 border border-transparent focus:border-[#493ee5]/20 transition-all placeholder:text-[#49607e]/40"
                />
              </div>

              <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                  Bug reports include basic system metadata to help our engineers solve the issue faster.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !message.trim()}
                className="w-full py-4 bg-[#493ee5] text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-[#3d33c4] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Feedback
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
