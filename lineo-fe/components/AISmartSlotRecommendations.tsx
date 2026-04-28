"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Clock, CheckCircle2, Trophy, Zap, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

interface RecommendedSlot {
  slot_id: string;
  datetime: string;
  label: string;
  score: number;
  badge: string;
  reason: string;
}

interface RecommendationResponse {
  recommended_slots: RecommendedSlot[];
  explanation: string;
}

interface AISmartSlotRecommendationsProps {
  orgId: string;
  onSelect: (datetime: string) => void;
  selectedDateTime?: string;
}

export function AISmartSlotRecommendations({ orgId, onSelect, selectedDateTime }: AISmartSlotRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<RecommendedSlot[]>([]);
  const [explanation, setExplanation] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!orgId) return;

    const fetchRecommendations = async () => {
      setIsLoading(true);
      try {
        const today = new Date().toISOString().split('T')[0];
        const resp = await api.get(`/appointments/recommend?org_id=${orgId}&date=${today}`);
        const data = resp.data.data as RecommendationResponse;
        setRecommendations(data.recommended_slots || []);
        setExplanation(data.explanation || "");
      } catch (err) {
        console.error("Failed to fetch AI recommendations", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendations();
  }, [orgId]);

  if (!orgId) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#493ee5]/10 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[#493ee5]" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#181c1e] flex items-center gap-2">
              AI Smart Recommendations
            </h4>
            <p className="text-[10px] text-[#49607e] font-medium uppercase tracking-wider">Powered by Lineo Brain</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : recommendations.length > 0 ? (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {recommendations.map((slot, i) => {
              const isSelected = selectedDateTime?.includes(slot.datetime.split('T')[1].substring(0, 5));
              return (
                <motion.div
                  key={slot.slot_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => onSelect(slot.datetime)}
                  className={cn(
                    "p-4 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden group",
                    isSelected 
                      ? "bg-[#493ee5]/5 border-[#493ee5] shadow-lg" 
                      : "bg-white border-[#f1f4f7] hover:border-[#493ee5]/30 hover:shadow-md"
                  )}
                >
                  <div className="flex items-start justify-between relative z-10">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[#181c1e]">{slot.label}</span>
                        {slot.badge && (
                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1",
                            slot.badge.includes("🏆") ? "bg-amber-50 text-amber-600 border border-amber-100" : "bg-blue-50 text-blue-600 border border-blue-100"
                          )}>
                            {slot.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#49607e] font-medium leading-relaxed max-w-[280px]">
                        {slot.reason}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-[10px] font-black text-[#493ee5] uppercase tracking-tighter">
                        Score: {(slot.score * 100).toFixed(0)}%
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-[#493ee5]" />}
                    </div>
                  </div>
                  
                  {/* Subtle Background Pattern */}
                  <div className="absolute top-0 right-0 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                    {slot.badge.includes("🏆") ? <Trophy className="w-16 h-16" /> : <Zap className="w-16 h-16" />}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          
          {explanation && (
             <p className="text-[10px] text-[#49607e] font-medium italic text-center px-4">
               &ldquo;{explanation}&rdquo;
             </p>
          )}
        </div>
      ) : (
        <div className="p-8 text-center bg-[#f1f4f7] rounded-2xl border border-dashed border-[#e5e8eb]">
          <Calendar className="w-8 h-8 text-[#49607e]/30 mx-auto mb-2" />
          <p className="text-xs font-bold text-[#49607e]">No smart recommendations available for this date.</p>
        </div>
      )}
    </div>
  );
}
