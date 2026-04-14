"use client"

import Image from "next/image"
import React from "react"
import { cn } from "@/lib/utils"
import Link from "next/link"

const cardContents = [
  {
    title: "Kiosk Interface",
    description:
      "A distraction-free, high-performance interface designed for physical kiosks and tablet devices.",
  },
  {
    title: "API-First Platform",
    description:
      "Integrate queue management into your existing apps with our robust and well-documented API.",
  },
  {
    title: "Multi-Counter Support",
    description:
      "Design dynamic, responsive layouts for multiple counters and service points. Whether you're managing a single clinic or a massive bank branch, Lineo provides composable primitives that scale beautifully. With real-time load balancing and staff performance tracking, your operations adapt effortlessly to peak hours.",
  },  
  {
    title: "Accessibility First",
    description:
      "Thoughtfully designed to be inclusive, supporting multiple languages and high-contrast modes for all users.",
  },
  {
    title: "Edge Infrastructure",
    description:
      "Built on a global edge network to ensure 99.9% uptime and sub-second notification latency.",
  },
]


const PlusCard: React.FC<{
  className?: string
  title: string
  description: string
}> = ({
  className = "",
  title,
  description,
}) => {
  return (
    <div
      className={cn(
        "relative border border-dashed border-zinc-400 dark:border-zinc-700 rounded-lg p-6 bg-white dark:bg-zinc-950 min-h-[200px]",
        "flex flex-col justify-between",
        className
      )}
    ><Link href="https://ruixen.com/?utm_source=21stdev&utm_medium=button&utm_campaign=ruixen_bento_cards">
      <CornerPlusIcons />
      {/* Content */}
      <div className="relative z-10 space-y-2">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {title}
        </h3>
        <p className="text-gray-700 dark:text-gray-300">{description}</p>
      </div></Link>
    </div>
  )
}

const CornerPlusIcons = () => (
  <>
    <PlusIcon className="absolute -top-3 -left-3" />
    <PlusIcon className="absolute -top-3 -right-3" />
    <PlusIcon className="absolute -bottom-3 -left-3" />
    <PlusIcon className="absolute -bottom-3 -right-3" />
  </>
)

const PlusIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    width={24}
    height={24}
    strokeWidth="1"
    stroke="currentColor"
    className={`dark:text-white text-black size-6 ${className}`}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
  </svg>
)

export default function RuixenBentoCards() {
  return (
    <section className="bg-white dark:bg-black dark:bg-transparent border border-gray-200 dark:border-gray-800">
      <div className="mx-auto container border border-gray-200 dark:border-gray-800 py-12 border-t-0 px-4">
        {/* Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 auto-rows-auto gap-4">
          <PlusCard {...cardContents[0]} className="lg:col-span-3 lg:row-span-2" />
          <PlusCard {...cardContents[1]} className="lg:col-span-2 lg:row-span-2" />
          <PlusCard {...cardContents[2]} className="lg:col-span-4 lg:row-span-1" />
          <PlusCard {...cardContents[3]} className="lg:col-span-2 lg:row-span-1" />
          <PlusCard {...cardContents[4]} className="lg:col-span-2 lg:row-span-1" />
        </div>

        {/* Section Footer Heading */}
        <div className="max-w-2xl ml-auto text-right px-4 mt-6 lg:-mt-20">
          <h2 className="text-4xl md:text-6xl font-bold text-black dark:text-white mb-4">
            Built for performance. Designed for flexibility.
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Ruixen UI gives you the tools to build beautiful, high-performing websites with lightning speed. Each component is thoughtfully designed to be flexible, reusable, and accessible.
          </p>
        </div>
      </div>
    </section>
  )
}
