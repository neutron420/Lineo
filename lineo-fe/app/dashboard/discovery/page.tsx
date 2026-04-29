'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Navigation, 
  Building2, 
  Landmark, 
  HeartPulse, 
  ShoppingBag,
  Star,
  Clock,
  MapPin,
  Filter,
  Layers,
  Zap,
  Calendar,
  Loader2,
  Share2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useLocation } from '@/context/LocationContext';

interface Organization {
  name: string;
  key?: string;
  address?: string;
  type?: string;
  rating?: number;
  wait_time?: string;
  distance: number;
  lat: number;
  lng: number;
}

export default function DiscoveryPage() {
  const router = useRouter();
  const { coords, refreshLocation, isLoading: locationLoading } = useLocation();
  const [activeCategory, setActiveCategory] = useState('all');
  const [nearbyOrgs, setNearbyOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInstitution, setSelectedInstitution] = useState<Organization | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchNearby = useCallback(async () => {
    if (!coords.lat || !coords.lng) return;
    setIsLoading(true);
    try {
      const categoryParam = activeCategory !== 'all' ? `&type=${activeCategory}` : "";
      const response = await api.get(`/search/nearby?lat=${coords.lat}&lng=${coords.lng}&radius=40000${categoryParam}`);
      
      const data = response.data.data || [];
      if (data.length === 0) {
        // High-Fidelity Mock Data for Preview
        setNearbyOrgs([
          { name: "Apollo Main Hospital", address: "Sarita Vihar, Delhi", type: "hospital", rating: 4.8, wait_time: "12 mins", distance: 1200, lat: 28.5392, lng: 77.2831, key: "hosp_1" },
          { name: "HDFC Strategic Branch", address: "CP, New Delhi", type: "bank", rating: 4.5, wait_time: "8 mins", distance: 3400, lat: 28.6304, lng: 77.2177, key: "bank_1" },
          { name: "Metro Tech Park", address: "Noida Sector 62", type: "it_park", rating: 4.9, wait_time: "15 mins", distance: 8900, lat: 28.6273, lng: 77.3725, key: "tech_1" },
        ]);
      } else {
        setNearbyOrgs(data);
      }
      setHasFetched(true);
    } catch (err) {
      console.error("Discovery error:", err);
      // Fallback on error too
      setNearbyOrgs([
        { name: "Apollo Main Hospital", address: "Sarita Vihar, Delhi", type: "hospital", rating: 4.8, wait_time: "12 mins", distance: 1200, lat: 28.5392, lng: 77.2831, key: "hosp_1" },
        { name: "HDFC Strategic Branch", address: "CP, New Delhi", type: "bank", rating: 4.5, wait_time: "8 mins", distance: 3400, lat: 28.6304, lng: 77.2177, key: "bank_1" },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [coords.lat, coords.lng, activeCategory, hasFetched]);

  const [isJoining, setIsJoining] = useState(false);

  const handleJoinQueue = async (queueKey: string) => {
    if (!queueKey || isJoining) return;
    setIsJoining(true);

    const promise = api.post("/queue/join", {
      queue_key: queueKey,
      user_lat: coords.lat,
      user_lon: coords.lng
    });

    toast.promise(promise, {
      loading: 'Securing your spot...',
      success: () => {
        // Optimistic redirect
        window.dispatchEvent(new Event("userSync"));
        router.prefetch('/dashboard');
        setTimeout(() => router.push('/dashboard'), 1000);
        return 'Spot Secured! Pulsing to dashboard...';
      },
      error: (err) => {
        setIsJoining(false);
        return err.response?.data?.message || 'Unable to join queue at this time.';
      }
    });
  };

  useEffect(() => { fetchNearby(); }, [fetchNearby]);

  const categories = [
    { id: 'all', name: 'All', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'hospital', name: 'Hospital', icon: <HeartPulse className="w-3.5 h-3.5" /> },
    { id: 'bank', name: 'Bank', icon: <Landmark className="w-3.5 h-3.5" /> },
    { id: 'it_park', name: 'Tech', icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: 'shopping_mall', name: 'Retail', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
  ];

  const filteredOrgs = nearbyOrgs.filter(org => 
    org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );


  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-96px)] overflow-hidden rounded-2xl">
      {/* Sidebar Discovery List */}
      <div className="w-full md:w-[420px] flex-shrink-0 bg-white flex flex-col z-20 ghost-border rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none max-h-[55vh] md:max-h-none">
        <div className="p-2 md:p-6 space-y-1.5 md:space-y-6 border-b border-[#e5e8eb]">
          <div className="flex items-center justify-between">
            <h1 className="text-lg md:text-xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Discover</h1>
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-1.5 md:p-2 bg-[#f1f4f7] text-[#49607e] rounded-lg hover:bg-[#493ee5]/5 hover:text-[#493ee5] transition-all"
              >
                <Share2 className="w-3.5 h-3.5" />
              </motion.button>
              <span className="bg-[#493ee5]/10 text-[#493ee5] px-2 py-0.5 md:px-2.5 md:py-1 rounded-full text-[9px] font-bold uppercase tracking-widest" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                Live
              </span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-[#49607e] group-focus-within:text-[#493ee5] transition-colors" />
            <input
              type="text"
              placeholder="Search institutions..."
              className="w-full pl-9 md:pl-10 pr-4 py-2 md:py-2.5 bg-[#f1f4f7] border border-transparent focus:bg-white focus:border-[#493ee5]/15 focus:ring-4 focus:ring-[#493ee5]/5 rounded-xl outline-none transition-all text-xs md:text-sm font-medium placeholder:text-[#49607e]/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Combined Tabs + Category Filter Row */}
          <div className="flex items-center gap-1.5 md:gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            {/* View Switcher */}
            <div className="flex p-0.5 bg-[#f1f4f7] rounded-lg shrink-0">
               <button className="py-1 px-2.5 md:py-1.5 md:px-3 bg-white text-[#493ee5] shadow-sm rounded-md text-[10px] md:text-[11px] font-bold transition-all" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                 Nearby
               </button>
               <button className="py-1 px-2.5 md:py-1.5 md:px-3 text-[#49607e] hover:text-[#181c1e] text-[10px] md:text-[11px] font-bold transition-all" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                 History
               </button>
            </div>

            <div className="w-px h-4 bg-[#e5e8eb] shrink-0" />

            {/* Category Filters */}
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-[11px] font-bold transition-all whitespace-nowrap border shrink-0",
                  activeCategory === cat.id 
                    ? 'bg-white border-[#e5e8eb] text-[#493ee5] shadow-[0_2px_8px_rgba(0,0,0,0.04)]' 
                    : 'bg-transparent border-transparent text-[#49607e] hover:text-[#181c1e]'
                )}
                style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
              >
                {activeCategory === cat.id && <span className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-[#493ee5]" />}
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2">
          {isLoading ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} className="h-24 bg-[#f1f4f7] rounded-xl animate-pulse" />
            ))
          ) : filteredOrgs.length > 0 ? (
            filteredOrgs.map((org, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                onClick={() => setSelectedInstitution(org)}
                className={cn(
                  "p-4 bg-white rounded-xl cursor-pointer transition-all",
                  selectedInstitution?.key === org.key 
                    ? 'ring-2 ring-[#493ee5] shadow-ambient bg-[#493ee5]/[0.02]' 
                    : 'ghost-border hover:shadow-ambient'
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="space-y-0.5">
                    <h3 className="font-bold text-[#181c1e] text-sm line-clamp-1" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{org.name}</h3>
                    <div className="flex items-center gap-1.5 text-[#49607e] text-[10px] font-bold uppercase tracking-wider">
                      <MapPin className="w-3 h-3" />
                      {org.distance ? `${(org.distance/1000).toFixed(1)} km away` : 'Nearby'}
                    </div>
                  </div>
                  <div className="bg-[#f1f4f7] p-2 rounded-lg text-[#493ee5]">
                     {org.type === 'hospital' ? <HeartPulse className="w-4 h-4" /> : <Landmark className="w-4 h-4" />}
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-[11px] font-bold">
                   <div className="flex items-center gap-1 text-amber-500 bg-amber-50 px-2 py-0.5 rounded-md">
                      <Star className="w-3 h-3 fill-current" />
                      {org.rating || '4.5'}
                   </div>
                   <div className="flex items-center gap-1 text-[#49607e]">
                      <Clock className="w-3 h-3" />
                      {org.wait_time || '15 mins'}
                   </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-16">
               <Building2 className="w-10 h-10 text-[#e5e8eb] mx-auto mb-3" />
               <p className="text-[#49607e] font-bold text-sm">No results found.</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Map View */}
      <div className="flex-1 relative bg-[#e5e8eb] rounded-b-2xl md:rounded-r-2xl md:rounded-bl-none overflow-hidden min-h-[250px]">
        <iframe
          width="100%"
          height="100%"
          title="Discovery Map"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          src={selectedInstitution
            ? `https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY?.replace('#', '')}&q=${selectedInstitution.lat},${selectedInstitution.lng}&zoom=16`
            : `https://www.google.com/maps/embed/v1/view?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY?.replace('#', '')}&center=${coords.lat},${coords.lng}&zoom=14&maptype=roadmap`
          }
        />

        {/* Map Controls — Desktop */}
        <div className="absolute top-4 md:top-6 right-4 md:right-6 space-y-2">
           <motion.button 
             whileTap={{ scale: 0.9 }}
             onClick={async () => {
               await refreshLocation();
               setSelectedInstitution(null);
             }}
             className={cn(
               "w-10 h-10 bg-white rounded-xl shadow-ambient flex items-center justify-center transition-all ghost-border",
               locationLoading ? "text-[#493ee5] animate-pulse" : "text-[#181c1e] hover:text-[#493ee5]"
             )}
           >
             {locationLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
           </motion.button>
           <button className="w-10 h-10 bg-white rounded-xl shadow-ambient flex items-center justify-center text-[#181c1e] hover:text-[#493ee5] transition-all ghost-border">
              <Filter className="w-4 h-4" />
           </button>
        </div>

        {/* Floating "My Location" — Mobile Only */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.1 }}
          onClick={async () => {
            await refreshLocation();
            setSelectedInstitution(null);
          }}
          className={cn(
            "md:hidden absolute bottom-6 right-6 z-30 flex items-center justify-center w-12 h-12 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border transition-all",
            locationLoading 
              ? "bg-[#493ee5] text-white border-[#493ee5] animate-pulse" 
              : "bg-white text-[#493ee5] border-[#e5e8eb] active:bg-[#493ee5] active:text-white"
          )}
        >
          {locationLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Navigation className="w-5 h-5 fill-current" />
          )}
        </motion.button>

        {/* Selected Institution Overlay */}
        <AnimatePresence>
          {selectedInstitution && (
            <motion.div
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 80 }}
              className="absolute bottom-6 left-6 right-6 flex justify-center"
            >
              <div className="glass-panel p-4 md:p-6 rounded-2xl shadow-ambient max-w-xl w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 md:gap-6">
                 <div className="flex-1 space-y-2 md:space-y-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#493ee5]/10 text-[#493ee5] rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                       Highly Rated
                    </span>
                    <div>
                       <h2 className="text-xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>{selectedInstitution.name}</h2>
                       <p className="text-[#49607e] text-xs font-medium mt-0.5">{selectedInstitution.address}</p>
                    </div>
                    <div className="flex gap-6 items-center text-xs">
                       <div>
                          <p className="text-[10px] font-bold text-[#49607e] uppercase tracking-wider">Distance</p>
                          <p className="text-[#181c1e] font-bold">{(selectedInstitution.distance / 1000).toFixed(1)} km</p>
                       </div>
                       <div>
                          <p className="text-[10px] font-bold text-[#49607e] uppercase tracking-wider">Est. Travel</p>
                          <p className="text-[#181c1e] font-bold">{Math.ceil((selectedInstitution.distance / 1000) * 3)} mins</p>
                       </div>
                    </div>
                 </div>
                 
                 <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto sm:min-w-[150px]">
                    {selectedInstitution.key && (
                      <Button onClick={() => handleJoinQueue(selectedInstitution.key!)} className="kinetic-btn-primary h-11 text-sm gap-2">
                         <Zap className="w-4 h-4" /> Secure Spot
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => router.push('/dashboard/appointments')} className="h-10 text-[#493ee5] hover:bg-[#493ee5]/5 rounded-xl text-sm font-bold gap-2" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                       <Calendar className="w-4 h-4" /> Book Ahead
                    </Button>
                    <button onClick={() => setSelectedInstitution(null)} className="text-[#49607e] font-bold text-[11px] py-1 hover:text-[#181c1e] transition-all">
                       Dismiss
                    </button>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
