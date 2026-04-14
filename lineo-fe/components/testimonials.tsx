"use client"

import React from "react"
import { motion } from "framer-motion"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

const testimonials = [
  {
    name: "Dr. Sarah Chen",
    role: "Chief of Surgery, Metro General",
    content: "Lineo has transformed our outpatient workflow. Wait times are down by 40%, and patient satisfaction has never been higher.",
    avatar: "SC",
    color: "blue"
  },
  {
    name: "James Wilson",
    role: "Operations Manager, Global Bank",
    content: "The real-time analytics allowed us to optimize counter staff during peak hours. A game-changer for branch efficiency.",
    avatar: "JW",
    color: "purple"
  },
  {
    name: "Elena Rodriguez",
    role: "Retail Director, FashionHub",
    content: "The SMS notification system means our customers can shop while they wait. Our secondary revenue has increased significantly.",
    avatar: "ER",
    color: "pink"
  }
]

export default function Testimonials() {
  return (
    <section className="py-24 bg-white relative overflow-hidden">
      <div className="max-w-[1080px] mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-stripe-navy mb-4 font-medium">Trusted by industry leaders</h2>
          <p className="text-stripe-slate text-lg max-w-[600px] mx-auto">See how Lineo is helping businesses worldwide modernize their customer experience.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                "p-8 rounded-stripe border border-stripe-border bg-white shadow-stripe-sm",
                "hover:shadow-stripe-md transition-all duration-300 group"
              )}
            >
              <div className="flex gap-1 mb-6 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-current" />
                ))}
              </div>
              <p className="text-stripe-navy text-lg mb-8 italic">"{t.content}"</p>
              <div className="flex items-center gap-4 mt-auto">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-white font-medium",
                  t.color === 'blue' ? 'bg-stripe-purple' : t.color === 'purple' ? 'bg-stripe-navy' : 'bg-stripe-ruby'
                )}>
                  {t.avatar}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-stripe-navy">{t.name}</h4>
                  <p className="text-xs text-stripe-slate">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
