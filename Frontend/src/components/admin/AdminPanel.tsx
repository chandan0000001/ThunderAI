import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import type { AdminUser, AdminStats } from '../../types';
import {
  Users,
  ShieldCheck,
  UserPlus,
  Trash2,
  RefreshCw,
  Search,
  Check,
  AlertTriangle,
  RotateCcw,
  Mail,
  Zap,
  Layers,
  X,
  Copy,
} from 'lucide-react';

interface AdminPanelProps {
  currentUserId?: string;
  onClose?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ currentUserId }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<'all' | 'user' | 'admin'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<AdminUser | null>(null);

  // Add User Form State
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'user', age: '' });
  // Invite Form State
  const [inviteData, setInviteData] = useState({ name: '', email: '', role: 'user' });
  const [inviteResult, setInviteResult] = useState<{ email: string; tempPassword?: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const fetchUsersAndStats = async () => {
    try {
      setLoading(true);
      const [usersRes, statsRes] = await Promise.all([
        api.admin.getUsers({
          search: searchQuery || undefined,
          role: selectedRole === 'all' ? undefined : selectedRole,
          page,
        }),
        api.admin.getStats().catch(() => null),
      ]);

      setUsers(usersRes.users || []);
      setTotalPages(usersRes.pages || 1);
      if (statsRes) setStats(statsRes);
    } catch (err: any) {
      console.error('Failed to load admin telemetry:', err);
      showNotice('error', err.message || 'Failed to load telemetry data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndStats();
  }, [searchQuery, selectedRole, page]);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Add User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password.trim()) {
      showNotice('error', 'All fields are required');
      return;
    }

    try {
      setActionLoading('create');
      const res = await api.admin.createUser({
        name: newUser.name.trim(),
        email: newUser.email.trim(),
        password: newUser.password.trim(),
        role: newUser.role,
        age: newUser.age ? Number(newUser.age) : undefined,
      });

      showNotice('success', res.message || 'User successfully created!');
      setAddUserModalOpen(false);
      setNewUser({ name: '', email: '', password: '', role: 'user', age: '' });
      fetchUsersAndStats();
    } catch (err: any) {
      showNotice('error', err.message || 'Failed to create user');
    } finally {
      setActionLoading(null);
    }
  };

  // Invite User
  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteData.email.trim()) {
      showNotice('error', 'Email is required');
      return;
    }

    try {
      setActionLoading('invite');
      const res = await api.admin.inviteUser({
        name: inviteData.name.trim() || undefined,
        email: inviteData.email.trim(),
        role: inviteData.role,
      });

      setInviteResult({
        email: inviteData.email.trim(),
        tempPassword: res.tempPassword,
      });
      showNotice('success', res.message || 'Invite generated successfully!');
      fetchUsersAndStats();
    } catch (err: any) {
      showNotice('error', err.message || 'Failed to invite user');
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle Role
  const handleToggleRole = async (user: AdminUser) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      setActionLoading(user._id);
      await api.admin.updateRole(user._id, newRole);
      showNotice('success', `Updated ${user.name} to ${newRole.toUpperCase()}`);
      setUsers((prev) =>
        prev.map((u) => (u._id === user._id ? { ...u, role: newRole } : u))
      );
      if (stats) {
        setStats({
          ...stats,
          adminCount: stats.adminCount + (newRole === 'admin' ? 1 : -1),
        });
      }
    } catch (err: any) {
      showNotice('error', err.message || 'Failed to update user role');
    } finally {
      setActionLoading(null);
    }
  };

  // Reset Quota
  const handleResetQuota = async (user: AdminUser) => {
    try {
      setActionLoading(`reset-${user._id}`);
      await api.admin.resetQuota(user._id);
      showNotice('success', `Reset sliding token quota for ${user.name}`);
      setUsers((prev) =>
        prev.map((u) => (u._id === user._id ? { ...u, liveTokens: 0 } : u))
      );
    } catch (err: any) {
      showNotice('error', err.message || 'Failed to reset quota');
    } finally {
      setActionLoading(null);
    }
  };

  // Delete User
  const handleDeleteUser = async () => {
    if (!confirmDeleteUser) return;
    if (confirmDeleteUser.role === 'admin') {
      showNotice('error', 'Administrator accounts are protected and cannot be deleted.');
      setConfirmDeleteUser(null);
      return;
    }
    try {
      setActionLoading(`del-${confirmDeleteUser._id}`);
      await api.admin.deleteUser(confirmDeleteUser._id);
      showNotice('success', `Deleted account for ${confirmDeleteUser.email}`);
      setConfirmDeleteUser(null);
      fetchUsersAndStats();
    } catch (err: any) {
      showNotice('error', err.message || 'Failed to delete user');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-mono flex items-center justify-between shadow-xl animate-fadeIn ${
            notification.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/70 border-rose-500/40 text-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {notification.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1 hover:text-white transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Stat Cluster */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border border-white/10 bg-black/40">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider">Total Users</span>
            <Users className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {stats ? stats.totalUsers : users.length}
          </div>
          <span className="text-[10px] font-mono text-emerald-400">● Live Database</span>
        </div>

        <div className="p-4 rounded-2xl border border-white/10 bg-black/40">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider">System Admins</span>
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {stats ? stats.adminCount : users.filter((u) => u.role === 'admin').length}
          </div>
          <span className="text-[10px] font-mono text-amber-400">Unrestricted</span>
        </div>

        <div className="p-4 rounded-2xl border border-white/10 bg-black/40">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider">System Tokens</span>
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {(stats?.totalTokensUsed || 0).toLocaleString()}
          </div>
          <span className="text-[10px] font-mono text-zinc-400">Aggregate Ingestion</span>
        </div>

        <div className="p-4 rounded-2xl border border-white/10 bg-black/40">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider">Total Threads</span>
            <Layers className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {stats ? stats.totalChats : 'Active'}
          </div>
          <span className="text-[10px] font-mono text-blue-400">Context Buffers</span>
        </div>
      </div>

      {/* Control Header: Search, Filters, Add & Invite Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        {/* Search & Role Filter */}
        <div className="flex items-center space-x-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user name or email..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-white/10 bg-black/40 text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-white/30 font-mono"
            />
          </div>

          <div className="flex rounded-xl border border-white/10 bg-black/40 p-0.5 text-xs font-mono">
            {(['all', 'user', 'admin'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setSelectedRole(r)}
                className={`px-2.5 py-1 rounded-lg uppercase text-[10px] transition cursor-pointer ${
                  selectedRole === r
                    ? 'bg-white text-black font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setAddUserModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-white text-black font-mono text-xs font-bold flex items-center space-x-1.5 hover:bg-zinc-200 transition cursor-pointer shadow"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ ADD USER</span>
          </button>

          <button
            onClick={() => {
              setInviteResult(null);
              setInviteModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white font-mono text-xs flex items-center space-x-1.5 transition cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5 text-amber-400" />
            <span>INVITE</span>
          </button>

          <button
            onClick={fetchUsersAndStats}
            disabled={loading}
            className="p-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Users Telemetry Table */}
      <div className="rounded-2xl border border-white/10 bg-black/50 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-zinc-400 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Operator</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Auth Method</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Sliding Window</th>
                <th className="py-3 px-3">Lifetime Tokens</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500 font-mono">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-zinc-400" />
                    Querying MongoDB & Redis telemetry...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-zinc-500 font-mono">
                    No users match current search criteria.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isCurrent = user._id === currentUserId;
                  const isAdmin = user.role === 'admin';
                  const liveTokens = user.liveTokens ?? 0;

                  return (
                    <tr
                      key={user._id}
                      className="hover:bg-white/[0.03] transition-colors group"
                    >
                      {/* Operator Identity */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center font-bold text-white shrink-0">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-white truncate flex items-center space-x-1.5">
                              <span>{user.name}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[8px] font-bold">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-400 truncate">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-3">
                        <button
                          onClick={() => handleToggleRole(user)}
                          disabled={isCurrent || actionLoading === user._id}
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase transition flex items-center space-x-1 cursor-pointer ${
                            isAdmin
                              ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40 hover:bg-amber-400/30'
                              : 'bg-white/10 text-zinc-300 border border-white/10 hover:bg-white/20'
                          } ${isCurrent ? 'opacity-70 cursor-not-allowed' : ''}`}
                          title={isCurrent ? 'Self role toggle blocked' : 'Click to toggle Admin / User role'}
                        >
                          <ShieldCheck className="w-2.5 h-2.5" />
                          <span>{isAdmin ? 'ADMIN' : 'USER'}</span>
                        </button>
                      </td>

                      {/* Auth Method */}
                      <td className="py-3 px-3">
                        {user.authProvider === 'google' ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-bold">
                            <svg className="w-2.5 h-2.5" viewBox="0 0 24 24">
                              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                            </svg>
                            <span>Google</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-white/10 text-[9px] font-bold">
                            <Mail className="w-2.5 h-2.5 text-zinc-400" />
                            <span>Password</span>
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        {user.isVerified ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-bold">
                            VERIFIED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[9px] font-bold">
                            PENDING
                          </span>
                        )}
                      </td>

                      {/* Sliding Window */}
                      <td className="py-3 px-3">
                        {isAdmin ? (
                          <span className="text-emerald-400 font-bold flex items-center space-x-1">
                            <span>∞ UNLIMITED</span>
                          </span>
                        ) : (
                          <div>
                            <span className="text-white font-bold">{liveTokens.toLocaleString()}</span>
                            <span className="text-zinc-500 text-[10px]"> / 10k</span>
                          </div>
                        )}
                      </td>

                      {/* Lifetime Tokens */}
                      <td className="py-3 px-3 text-zinc-300">
                        {(user.usage?.totalTokenUsed || 0).toLocaleString()}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Reset Quota */}
                          {!isAdmin && (
                            <button
                              onClick={() => handleResetQuota(user)}
                              disabled={actionLoading === `reset-${user._id}`}
                              className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white transition cursor-pointer"
                              title="Reset Redis Sliding Token Quota to 0"
                            >
                              <RotateCcw className={`w-3 h-3 ${actionLoading === `reset-${user._id}` ? 'animate-spin' : ''}`} />
                            </button>
                          )}

                          {/* Delete User (Blocked for Admins) */}
                          {!isAdmin ? (
                            <button
                              onClick={() => setConfirmDeleteUser(user)}
                              disabled={isCurrent}
                              className={`p-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 transition cursor-pointer ${
                                isCurrent ? 'opacity-30 cursor-not-allowed' : ''
                              }`}
                              title={isCurrent ? 'Cannot delete own account' : 'Delete user account'}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          ) : (
                            <span
                              className="p-1.5 text-zinc-500 cursor-not-allowed inline-flex items-center"
                              title="Administrator accounts are protected from deletion"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-500/60" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-white/[0.01] text-xs font-mono">
            <span className="text-zinc-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center space-x-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 transition"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ----------------- ADD USER MODAL ----------------- */}
      {addUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0e0f14] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center space-x-2 text-white">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold font-mono uppercase">Add New Operator</h3>
              </div>
              <button
                onClick={() => setAddUserModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-zinc-400 uppercase text-[10px] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="e.g. Alex Hunter"
                  className="w-full px-3 py-2 rounded-xl border border-white/10 bg-black text-white focus:outline-none focus:border-white/30"
                />
              </div>

              <div>
                <label className="block text-zinc-400 uppercase text-[10px] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="operator@company.com"
                  className="w-full px-3 py-2 rounded-xl border border-white/10 bg-black text-white focus:outline-none focus:border-white/30"
                />
              </div>

              <div>
                <label className="block text-zinc-400 uppercase text-[10px] mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Enter strong password..."
                  className="w-full px-3 py-2 rounded-xl border border-white/10 bg-black text-white focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 uppercase text-[10px] mb-1">Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-white/10 bg-black text-white focus:outline-none focus:border-white/30"
                  >
                    <option value="user">User (10k tokens)</option>
                    <option value="admin">System Admin (∞ Unlimited)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 uppercase text-[10px] mb-1">Age (Optional)</label>
                  <input
                    type="number"
                    value={newUser.age}
                    onChange={(e) => setNewUser({ ...newUser, age: e.target.value })}
                    placeholder="25"
                    className="w-full px-3 py-2 rounded-xl border border-white/10 bg-black text-white focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setAddUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-white/10 text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'create'}
                  className="px-4 py-2 rounded-xl bg-white text-black font-bold hover:bg-zinc-200 transition"
                >
                  {actionLoading === 'create' ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- INVITE USER MODAL ----------------- */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0e0f14] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center space-x-2 text-white">
                <Mail className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold font-mono uppercase">Invite Operator</h3>
              </div>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {inviteResult ? (
              <div className="space-y-4 font-mono text-xs">
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 space-y-2">
                  <div className="flex items-center space-x-2 font-bold text-sm">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Invitation Generated!</span>
                  </div>
                  <p className="text-[11px] text-zinc-300">
                    User account for <strong className="text-white">{inviteResult.email}</strong> is ready.
                  </p>
                </div>

                {inviteResult.tempPassword ? (
                  <div className="p-3.5 rounded-xl border border-white/15 bg-black space-y-1.5">
                    <span className="text-[10px] text-zinc-500 uppercase block">Temporary Password</span>
                    <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg">
                      <span className="font-bold text-amber-400">{inviteResult.tempPassword}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(inviteResult.tempPassword || '');
                          setCopiedKey(true);
                          setTimeout(() => setCopiedKey(false), 2000);
                        }}
                        className="p-1 hover:text-white transition"
                        title="Copy password"
                      >
                        {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] text-xs text-zinc-400 leading-relaxed">
                    Access credentials and sign-in instructions have been securely dispatched to the user's email address.
                  </div>
                )}

                <button
                  onClick={() => setInviteModalOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-white text-black font-bold hover:bg-zinc-200 transition"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleInviteUser} className="space-y-3 font-mono text-xs">
                <div>
                  <label className="block text-zinc-400 uppercase text-[10px] mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={inviteData.email}
                    onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                    placeholder="invitee@company.com"
                    className="w-full px-3 py-2 rounded-xl border border-white/10 bg-black text-white focus:outline-none focus:border-white/30"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 uppercase text-[10px] mb-1">Name (Optional)</label>
                  <input
                    type="text"
                    value={inviteData.name}
                    onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
                    placeholder="e.g. Sarah Connor"
                    className="w-full px-3 py-2 rounded-xl border border-white/10 bg-black text-white focus:outline-none focus:border-white/30"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 uppercase text-[10px] mb-1">Assign Role</label>
                  <select
                    value={inviteData.role}
                    onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-white/10 bg-black text-white focus:outline-none focus:border-white/30"
                  >
                    <option value="user">User (Standard 10,000 quota)</option>
                    <option value="admin">Admin (Unlimited tokens & window)</option>
                  </select>
                </div>

                <div className="pt-3 flex items-center justify-end space-x-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setInviteModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-white/10 text-zinc-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading === 'invite'}
                    className="px-4 py-2 rounded-xl bg-white text-black font-bold hover:bg-zinc-200 transition"
                  >
                    {actionLoading === 'invite' ? 'Generating...' : 'Dispatch Invite'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ----------------- DELETE CONFIRMATION MODAL ----------------- */}
      {confirmDeleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl border border-rose-500/30 bg-[#0e0f14] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-2 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold font-mono uppercase">Delete User Account?</h3>
            </div>

            <p className="text-xs font-mono text-zinc-300 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong className="text-white">{confirmDeleteUser.email}</strong>? All their chats,
              telemetry records, and context buffers will be deleted.
            </p>

            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteUser(null)}
                className="px-3.5 py-1.5 rounded-xl border border-white/10 text-zinc-400 hover:text-white text-xs font-mono"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={actionLoading === `del-${confirmDeleteUser._id}`}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-mono text-xs font-bold transition"
              >
                {actionLoading === `del-${confirmDeleteUser._id}` ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
