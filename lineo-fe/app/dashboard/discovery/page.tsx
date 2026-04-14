'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Map as MapIcon, 
  Navigation, 
  Building2, 
  Landmark, 
  HeartPulse, 
  ShoppingBag,
  Star,
  Clock,
  MapPin,
  ChevronRight,
  Filter,
  Layers,
  Zap,
  ArrowLeft,
  Calendar
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function DiscoveryPage() {
  const router = useRouter();
  const [coords, setCoords] = useState({ lat: 28.6139, lng: 77.2090 });
  const [activeCategory, setActiveCategory] = useState('all');
  const [nearbyOrgs, setNearbyOrgs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInstitution, setSelectedInstitution] = useState<any>(null);

  const handleJoinQueue = async (queueKey: string) => {
    if (!queueKey) return;
    
    // VERIFY LIVE GPS BEFORE JOINING
    let liveLat = coords.lat;
    let liveLon = coords.lng;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        liveLat = pos.coords.latitude;
        liveLon = pos.coords.longitude;
        setCoords({ lat: liveLat, lng: liveLon });
      });
    }

    const promise = api.post("/queue/join", {
      queue_key: queueKey,
      user_lat: liveLat,
      user_lon: liveLon
    });

    toast.promise(promise, {
      loading: 'Securing your spot in the interactive queue...',
      success: () => {
        setTimeout(() => router.push('/dashboard'), 1500);
        return 'Spot Secured! Redirecting to live dashboard...';
      },
      error: 'Unable to join queue. The institution may be at capacity.'
    });
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => console.warn("Location access denied, using default.")
      );
    }
  }, []);

  useEffect(() => {
    fetchNearby();
  }, [coords.lat, coords.lng, activeCategory]);

  const fetchNearby = async () => {
    setIsLoading(true);
    try {
      const categoryParam = activeCategory !== 'all' ? `&type=${activeCategory}` : "";
      const response = await api.get(`/search/nearby?lat=${coords.lat}&lng=${coords.lng}${categoryParam}`);
      setNearbyOrgs(response.data.data || []);
    } catch (err) {
      console.error("Discovery error:", err);
      toast.error("Discovery Engine Offline", {
        description: "Failed to fetch geo-tagged institutions."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const categories = [
    { id: 'all', name: 'All Services', icon: <Layers className="w-4 h-4" /> },
    { id: 'hospital', name: 'Health & Medical', icon: <HeartPulse className="w-4 h-4" /> },
    { id: 'bank', name: 'Banks & Fintech', icon: <Landmark className="w-4 h-4" /> },
    { id: 'it_park', name: 'Tech Hubs', icon: <Building2 className="w-4 h-4" /> },
    { id: 'shopping_mall', name: 'Retail Centers', icon: <ShoppingBag className="w-4 h-4" /> },
  ];

  const filteredOrgs = nearbyOrgs.filter(org => 
    org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-[#f6f9fc]">
      {/* Sidebar Discovery List */}
      <div className="w-[450px] flex-shrink-0 bg-white border-r border-stripe-border flex flex-col shadow-2xl z-20">
        <div className="p-8 border-b border-stripe-border space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-stripe-navy tracking-tight">Discovery Expo</h1>
            <div className="bg-stripe-purple/10 text-stripe-purple px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
              Live Area
            </div>
          </div>

          <div className="relative group">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-stripe-slate transition-colors group-focus-within:text-stripe-purple" />
            </div>
            <input
              type="text"
              placeholder="Search institutions, banks, clinics..."
              className="w-full pl-14 pr-6 py-4 bg-[#f6f9fc] border border-transparent focus:border-stripe-purple/20 focus:bg-white rounded-2xl outline-none transition-all text-sm font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                  activeCategory === cat.id 
                    ? 'bg-stripe-navy text-white border-stripe-navy shadow-lg shadow-stripe-navy/20' 
                    : 'bg-white text-stripe-slate border-stripe-border hover:border-stripe-purple/40 hover:text-stripe-navy'
                }`}
              >
                {cat.icon}
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {isLoading ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} className="h-28 bg-[#f6f9fc] rounded-3xl animate-pulse" />
            ))
          ) : filteredOrgs.length > 0 ? (
            filteredOrgs.map((org, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => setSelectedInstitution(org)}
                className={`p-6 bg-white border rounded-[32px] cursor-pointer transition-all ${
                  selectedInstitution?.key === org.key 
                    ? 'border-stripe-purple ring-4 ring-stripe-purple/5 shadow-stripe-premium' 
                    : 'border-stripe-border hover:border-stripe-purple/30 hover:shadow-lg'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="space-y-1">
                    <h3 className="font-bold text-stripe-navy text-lg line-clamp-1">{org.name}</h3>
                    <div className="flex items-center gap-2 text-stripe-slate text-[11px] font-bold uppercase tracking-wider">
                      <MapPin className="w-3 h-3" />
                      {org.distance ? `${(org.distance/1000).toFixed(1)} km away` : 'Nearby'}
                    </div>
                  </div>
                  <div className="bg-stripe-purple/5 p-3 rounded-2xl text-stripe-purple">
                     {org.type === 'hospital' ? <HeartPulse className="w-5 h-5" /> : <Landmark className="w-5 h-5" />}
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-xs font-bold">
                   <div className="flex items-center gap-1.5 text-amber-500 bg-amber-50 px-2.5 py-1 rounded-lg">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      {org.rating || '4.5'}
                   </div>
                   <div className="flex items-center gap-1.5 text-stripe-slate">
                      <Clock className="w-3.5 h-3.5" />
                      {org.wait_time || '15 mins wait'}
                   </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-20">
               <Building2 className="w-12 h-12 text-stripe-border mx-auto mb-4" />
               <p className="text-stripe-slate font-bold">No results found in this area.</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Map View */}
      <div className="flex-1 relative bg-[#e5e7eb]">
        <iframe
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          src={`https://www.google.com/maps/embed/v1/view?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY?.replace('#', '')}&center=${selectedInstitution?.lat || coords.lat},${selectedInstitution?.lng || coords.lng}&zoom=${selectedInstitution ? 16 : 14}&maptype=roadmap`}
        ></iframe>

        {/* Floating Map Controls */}
        <div className="absolute top-8 right-8 space-y-3">
           <button className="w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center text-stripe-navy hover:text-stripe-purple transition-all border border-stripe-border">
              <Navigation className="w-5 h-5" />
           </button>
           <button className="w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center text-stripe-navy hover:text-stripe-purple transition-all border border-stripe-border">
              <Filter className="w-5 h-5" />
           </button>
        </div>

        {/* Selected Institution Detail Card (Overlay) */}
        <AnimatePresence>
          {selectedInstitution && (
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="absolute bottom-10 left-10 right-10 flex justify-center"
            >
              <div className="bg-white/90 backdrop-blur-xl p-8 rounded-[40px] shadow-3xl border border-white max-w-2xl w-full flex items-center justify-between gap-8">
                 <div className="flex-1 space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-stripe-purple/10 text-stripe-purple rounded-full text-[10px] font-bold uppercase tracking-widest">
                       Highly Rated
                    </div>
                    <div className="space-y-1">
                       <h2 className="text-3xl font-bold text-stripe-navy tracking-tight">{selectedInstitution.name}</h2>
                       <p className="text-stripe-slate text-sm font-medium">{selectedInstitution.address}</p>
                    </div>
                    <div className="flex gap-10 items-center justify-between py-4 border-y border-stripe-border/50">
                       <div className="space-y-1">
                          <p className="text-[10px] font-extrabold text-stripe-slate uppercase tracking-widest">Commute Pulse</p>
                          <div className="flex items-center gap-2">
                             <div className="bg-emerald-500 w-2 h-2 rounded-full animate-pulse"></div>
                             <p className="text-emerald-600 font-bold text-sm">Optimal Route Found</p>
                          </div>
                       </div>
                       <div className="flex gap-8">
                          <div className="space-y-0.5">
                             <p className="text-[10px] font-extrabold text-stripe-slate uppercase tracking-wider">Distance</p>
                             <p className="text-stripe-navy font-bold text-sm">{(selectedInstitution.distance / 1000).toFixed(1)} km</p>
                          </div>
                          <div className="space-y-0.5">
                             <p className="text-[10px] font-extrabold text-stripe-slate uppercase tracking-wider">Est. Travel</p>
                             <p className="text-stripe-navy font-bold text-sm">{Math.ceil((selectedInstitution.distance / 1000) * 3)} mins</p>
                          </div>
                       </div>
                    </div>
                 </div>
                 
                 <div className="flex flex-col gap-3 min-w-[200px]">
                    <button 
                      onClick={() => handleJoinQueue(selectedInstitution.key)}
                      className="bg-stripe-purple text-white px-10 py-5 rounded-3xl font-bold text-sm shadow-xl shadow-stripe-purple/30 hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                    >
                       <Zap className="w-4 h-4" /> Secure Spot
                    </button>
                    <button 
                      onClick={() => router.push('/dashboard/appointments')}
                      className="bg-white border-2 border-stripe-purple text-stripe-purple px-10 py-5 rounded-3xl font-bold text-sm transition-all hover:bg-stripe-purple/5 flex items-center justify-center gap-2"
                    >
                       <Calendar className="w-4 h-4" /> Book Ahead
                    </button>
                    <button 
                      onClick={() => setSelectedInstitution(null)}
                      className="text-stripe-slate font-bold text-xs py-2 hover:text-stripe-navy transition-all"
                    >
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
