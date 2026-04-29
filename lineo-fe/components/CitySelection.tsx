"use client";

import React, { useState, useMemo, useEffect } from "react";
import { 
  Search, 
  MapPin, 
  Navigation, 
  X, 
  Check, 
  ChevronRight,
  TrendingUp,
  Map
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLocation } from "@/context/LocationContext";
import { toast } from "sonner";

// ━━━ Custom City Landmark Icons (SVG) ━━━
const CityLandmark = ({ name }: { name: string }) => {
  switch (name) {
    case "Mumbai":
      return (
        <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-[#493ee5]">
          <path d="M4 18H20M6 18V10H18V18M10 10V8C10 6.89543 10.8954 6 12 6C13.1046 6 14 6.89543 14 8V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M8 10V14H16V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      );
    case "Delhi":
      return (
        <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-[#493ee5]">
          <path d="M4 20H20M7 20V12L12 6L17 12V20M12 12V20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case "Bengaluru":
      return (
        <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-[#493ee5]">
          <path d="M3 20H21M5 20V8H9V20M11 20V4H13V20M15 20V6H19V20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      );
    case "Hyderabad":
      return (
        <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-[#493ee5]">
          <path d="M6 20V6M18 20V6M6 8H18M9 6V4M15 6V4M6 16H18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="6" cy="5" r="1" fill="currentColor"/>
          <circle cx="18" cy="5" r="1" fill="currentColor"/>
        </svg>
      );
    case "Kolkata":
      return (
        <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-[#493ee5]">
          <path d="M3 16C3 16 6 10 12 10C18 10 21 16 21 16M4 20H20M6 20V16M18 20V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      );
    default:
      return <MapPin className="w-8 h-8 text-[#493ee5]/40" />;
  }
};

const POPULAR_CITIES = [
  { name: "Mumbai" },
  { name: "Delhi" },
  { name: "Bengaluru" },
  { name: "Hyderabad" },
  { name: "Ahmedabad" },
  { name: "Pune" },
  { name: "Chennai" },
  { name: "Kolkata" },
  { name: "Gurugram" },
  { name: "Noida" },
];

const ALL_CITIES = [
  "Agartala", "Agra", "Ahmedabad", "Aizawl", "Ajmer", "Akola", "Aligarh", "Allahabad", "Alwar", "Ambala", 
  "Amravati", "Amritsar", "Anand", "Anantapur", "Arrah", "Asansol", "Aurangabad", "Avadi", "Bareilly", 
  "Belgaum", "Bengaluru", "Bhagalpur", "Bharatpur", "Bhavnagar", "Bhilai", "Bhilwara", "Bhiwandi", "Bhopal", 
  "Bhubaneswar", "Bikaner", "Bilaspur", "Bokaro", "Chandigarh", "Chennai", "Coimbatore", "Cuttack", "Darbhanga", 
  "Davanagere", "Dehradun", "Delhi", "Dewas", "Dhanbad", "Dhule", "Durgapur", "Erode", "Faridabad", "Firozabad", 
  "Gandhinagar", "Gaya", "Ghaziabad", "Gopalpur", "Gorakhpur", "Gulbarga", "Guntur", "Gurugram", "Guwahati", 
  "Gwalior", "Hapur", "Howrah", "Hubli-Dharwad", "Hyderabad", "Ichalkaranji", "Imphal", "Indore", "Jabalpur", 
  "Jaipur", "Jalandhar", "Jalgaon", "Jalna", "Jammu", "Jamnagar", "Jamshedpur", "Jhansi", "Jodhpur", "Junagadh", 
  "Kakinada", "Kalyan-Dombivli", "Kanpur", "Karnal", "Kochi", "Kolhapur", "Kolkata", "Kollam", "Korba", "Kota", 
  "Kozhikode", "Kurnool", "Latur", "Lucknow", "Ludhiana", "Madurai", "Maheshtala", "Malegaon", "Mangalore", 
  "Mathura", "Meerut", "Mira-Bhayandar", "Moradabad", "Mumbai", "Muzaffarnagar", "Muzaffarpur", "Mysuru", 
  "Nadiad", "Nagpur", "Nanded", "Nashik", "Navi Mumbai", "Nellore", "Nizamabad", "Noida", "Ozhukarai", 
  "Pali", "Panchkula", "Panihati", "Panipat", "Parbhani", "Patiala", "Patna", "Pimpri-Chinchwad", "Puducherry", 
  "Pune", "Purnia", "Raichur", "Raipur", "Rajahmundry", "Rajkot", "Rampur", "Ranchi", "Ratlam", "Rewa", 
  "Rohtak", "Rourkela", "Sagar", "Saharanpur", "Salem", "Sangli", "Satara", "Shimla", "Shivamogga", "Sikar", 
  "Siliguri", "Solapur", "Sonipat", "Srinagar", "Surat", "Thane", "Thanjavur", "Thiruvananthapuram", "Thoothukudi", 
  "Thrissur", "Tiruchirappalli", "Tirunelveli", "Tirupati", "Tiruppur", "Tumakuru", "Udaipur", "Ujjain", 
  "Ulhasnagar", "Vadodara", "Varanasi", "Vasai-Virar", "Vellore", "Vijayawada", "Visakhapatnam", "Warangal", "Yamunanagar"
];

export function CitySelection() {
  const { city, setCity, refreshLocation, isLoading: locationLoading } = useLocation();
  const [search, setSearch] = useState("");
  const [isVisible, setIsVisible] = useState(false);

  // Sync isVisible with city state
  useEffect(() => {
    if (!city) setIsVisible(true);
    else setIsVisible(false);
  }, [city]);

  const filteredCities = useMemo(() => {
    if (!search) return [];
    return ALL_CITIES.filter(c => c.toLowerCase().includes(search.toLowerCase())).slice(0, 8);
  }, [search]);

  const handleSelect = (selectedCity: string) => {
    setCity(selectedCity);
    setIsVisible(false);
  };

  const handleAutoDetect = async () => {
    try {
      await refreshLocation();
      // City will be auto-set in context
    } catch (err) {
      toast.error("Could not detect location. Please select manually.");
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#f8fafc]">
      {/* ━━━ Header ━━━ */}
      <div className="bg-white px-5 pt-10 pb-4 shadow-sm border-b border-[#e5e8eb] shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-[#493ee5]/10 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-[#493ee5]" />
             </div>
             <h1 className="text-lg font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Select City</h1>
          </div>
          {city && (
            <button 
              onClick={() => setIsVisible(false)}
              className="p-2 bg-[#f1f4f7] rounded-full hover:bg-red-50 hover:text-red-500 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Compact Search Bar */}
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#49607e]" />
          <input
            type="text"
            placeholder="Search for your city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-3 bg-[#f1f4f7] border-2 border-transparent focus:bg-white focus:border-[#493ee5]/20 rounded-xl text-sm font-bold outline-none transition-all placeholder:text-[#49607e]/50"
          />
          {search && (
            <button 
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#49607e]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Auto Detect Button */}
        <button
          onClick={handleAutoDetect}
          disabled={locationLoading}
          className="mt-4 flex items-center gap-2 text-[#493ee5] font-extrabold text-[11px] uppercase tracking-wider group"
        >
          <div className="relative flex items-center justify-center w-5 h-5">
             <Navigation className={cn("w-4 h-4 transition-transform group-active:scale-90", locationLoading && "animate-pulse")} />
             {!locationLoading && <div className="absolute inset-0 bg-[#493ee5]/20 rounded-full animate-ping" />}
          </div>
          {locationLoading ? "Detecting..." : "Auto Detect My Location"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8 pb-10">
        {search ? (
          /* ━━ Search Results ━━ */
          <div className="space-y-2">
            <h2 className="text-[10px] font-black text-[#49607e] uppercase tracking-[0.2em] mb-4">Search Results</h2>
            {filteredCities.map(c => (
              <button
                key={c}
                onClick={() => handleSelect(c)}
                className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-[#e5e8eb] hover:border-[#493ee5]/30 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-[#49607e] group-hover:text-[#493ee5]" />
                  <span className="text-sm font-bold text-[#181c1e]">{c}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[#e5e8eb] group-hover:text-[#493ee5]" />
              </button>
            ))}
            {filteredCities.length === 0 && (
              <div className="py-20 text-center opacity-40">
                <Map className="w-12 h-12 mx-auto mb-4" />
                <p className="font-bold text-sm">No cities found for &quot;{search}&quot;</p>
              </div>
            )}
          </div>
        ) : (
          /* ━━ Popular Cities Grid ━━ */
          <div className="space-y-10">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-4 h-4 text-[#493ee5]" />
                <h2 className="text-[10px] font-black text-[#49607e] uppercase tracking-[0.2em]">Popular Cities</h2>
              </div>
              <div className="grid grid-cols-4 gap-y-8 gap-x-4">
                {POPULAR_CITIES.map(c => (
                  <button
                    key={c.name}
                    onClick={() => handleSelect(c.name)}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-white border border-[#e5e8eb] shadow-sm flex items-center justify-center text-xl group-hover:border-[#493ee5]/30 group-hover:bg-[#493ee5]/5 group-active:scale-95 transition-all">
                      <CityLandmark name={c.name} />
                    </div>
                    <span className="text-[10px] font-bold text-[#181c1e] text-center leading-tight group-hover:text-[#493ee5] transition-colors">{c.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Select Section */}
            <div>
              <h2 className="text-[10px] font-black text-[#49607e] uppercase tracking-[0.2em] mb-6">All Cities (Quick Access)</h2>
              <div className="grid grid-cols-2 gap-3">
                {["Ludhiana", "Patna", "Surat", "Indore", "Jaipur", "Lucknow"].map(c => (
                  <button
                    key={c}
                    onClick={() => handleSelect(c)}
                    className="flex items-center justify-between p-4 bg-white rounded-xl border border-[#e5e8eb] text-xs font-bold text-[#181c1e] hover:border-[#493ee5]/20 active:bg-[#f1f4f7] transition-all"
                  >
                    {c}
                    <Check className="w-3.5 h-3.5 text-[#493ee5]" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
