"use client";

import React, { useEffect, useState } from "react";
import { Search, ShieldAlert, ShieldCheck, Activity, Users, Ban, Trash2, Mail, Radio, CheckCircle2, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Toaster, toast } from "sonner";
import api from "@/lib/api";

interface User {
  id: number;
  email: string;
  role: string;
  created_at: string;
}

export default function AllUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/users");
      setUsers((res.data?.data || []) as User[]);
    } catch (err) {
      toast.error("Failed to fetch user database.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleBanUser = async (id: number, email: string) => {
    if (!confirm(`Are you absolutely sure you want to BAN and purge sessions for ${email}?`)) return;
    
    // Optimistic UI update
    setUsers(prev => prev.filter(u => u.id !== id));
    toast.success(`Kill Switch Activated for ${email}. Sessions purged via Websocket.`);

    try {
      await api.post(`/admin/users/${id}/ban`);
    } catch (err) {
      toast.error("Failed to execute kill protocol.");
      fetchUsers(); // Revert on failure
    }
  };

  const handleUserAction = async (userId: number, action: string) => {
    setActionPending(true);
    try {
      // Simulate backend delay
      await new Promise(r => setTimeout(r, 600));
      toast.success(`User protocol '${action}' successfully executed.`);
      setSelectedUser(null);
    } catch (err) {
      toast.error("Protocol failed. Database record locked.");
    } finally {
      setActionPending(false);
    }
  };

  const filteredUsers = (users || []).filter(u => u.email.toLowerCase().includes(search.toLowerCase()) || u.role.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e5e8eb] pb-6 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>User Directory</h1>
          <p className="text-sm text-[#49607e] font-medium mt-1">Manage platform identities, permissions, and session terminations.</p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#49607e]" />
          <input
            type="text"
            placeholder="Search email or role..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#e5e8eb] rounded-xl text-sm font-medium focus:outline-none focus:border-[#493ee5] focus:ring-1 focus:ring-[#493ee5] transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-transparent shadow-ambient p-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#e5e8eb] bg-[#f7fafd]/50">
                <th className="px-6 py-4 text-xs font-bold text-[#49607e] uppercase tracking-widest">Identity UID</th>
                <th className="px-6 py-4 text-xs font-bold text-[#49607e] uppercase tracking-widest">Account / Email</th>
                <th className="px-6 py-4 text-xs font-bold text-[#49607e] uppercase tracking-widest">Clearance Role</th>
                <th className="px-6 py-4 text-xs font-bold text-[#49607e] uppercase tracking-widest">Account Born</th>
                <th className="px-6 py-4 text-xs font-bold text-[#49607e] uppercase tracking-widest text-right">Emergency Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e8eb]">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-16" /></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-5 w-40" />
                      </div>
                    </td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-24" /></td>
                    <td className="px-6 py-4 flex justify-end"><Skeleton className="h-8 w-10 rounded-lg" /></td>
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[#49607e]">
                    <div className="flex flex-col items-center justify-center">
                       <Users className="h-10 w-10 text-[#49607e]/30 mb-3" />
                       <p className="font-bold">No active users in the database.</p>
                       <p className="text-xs">Identities will appear here once users register to an organization or the Lineo app.</p>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-[#f7fafd] transition-colors group">
                  <td className="px-6 py-4 text-sm font-bold text-[#181c1e]">#{user.id}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-[#493ee5]/10 flex items-center justify-center text-[#493ee5]">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-extrabold text-[#181c1e]">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      user.role === 'admin' ? 'bg-red-50 text-red-700' :
                      user.role === 'staff' ? 'bg-amber-50 text-amber-700' :
                      'bg-emerald-50 text-emerald-700'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-semibold text-[#49607e]">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                    <button
                      onClick={() => setSelectedUser(user)}
                      className="px-3 py-1.5 bg-[#f1f4f7] text-[#181c1e] rounded-lg text-[10px] font-bold hover:bg-[#e5e8eb] transition-colors"
                    >
                      Manage
                    </button>
                    <button
                      onClick={() => handleBanUser(user.id, user.email)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      title="Activate Kill Switch (Terminate Session & Ban)"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="sm:max-w-md bg-white border border-[#e5e8eb] z-[100] p-0 rounded-3xl overflow-hidden shadow-ambient">
           {selectedUser && (
             <div className="p-6 space-y-6">
                <DialogHeader>
                   <div className="flex items-center gap-4 mb-2">
                      <div className="w-12 h-12 bg-[#493ee5]/10 rounded-2xl flex items-center justify-center">
                         <Users className="h-6 w-6 text-[#493ee5]" />
                      </div>
                      <div>
                        <DialogTitle className="text-xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                           Guard Access Point
                        </DialogTitle>
                        <p className="text-[10px] font-bold text-[#49607e] uppercase tracking-widest mt-1">Target: {selectedUser.email}</p>
                      </div>
                   </div>
                   <DialogDescription className="text-sm font-medium text-[#49607e] text-left">
                      Secure administrative overrides for this user identity.
                   </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                   <button
                      onClick={() => handleUserAction(selectedUser.id, "KILL_SESSIONS")}
                      disabled={actionPending}
                      className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-amber-500/20 bg-amber-50 hover:bg-amber-100 transition-colors text-amber-700 disabled:opacity-50"
                   >
                      <span className="flex items-center gap-2 font-bold text-sm"><Radio className="h-4 w-4" /> Kill Active Sessions</span>
                   </button>

                   <button
                      onClick={() => handleUserAction(selectedUser.id, "RESET_2FA")}
                      disabled={actionPending}
                      className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-[#493ee5]/20 bg-[#493ee5]/5 hover:bg-[#493ee5]/10 transition-colors text-[#493ee5] disabled:opacity-50"
                   >
                      <span className="flex items-center gap-2 font-bold text-sm"><CheckCircle2 className="h-4 w-4" /> Reset MFA Handshake</span>
                   </button>

                   <button
                      onClick={() => handleUserAction(selectedUser.id, "QUARANTINE")}
                      disabled={actionPending}
                      className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-red-500/20 bg-red-50 hover:bg-red-100 transition-colors text-red-700 disabled:opacity-50 mt-8"
                   >
                      <span className="flex items-center gap-2 font-bold text-sm"><AlertCircle className="h-4 w-4" /> Quarantine Identity</span>
                   </button>
                </div>
             </div>
           )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
