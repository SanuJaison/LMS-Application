'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Eye,
  Plus,
  X,
  Loader2,
  ChevronDown,
  Columns3,
} from 'lucide-react';
import {
  fetchResourceList,
  createResourceItem,
} from '../../services/api';

export interface WalletItem {
  _id?: string;
  id?: string;
  employee: string;
  balance: number;
  currency?: string;
  createdAt?: string;
}

interface WalletsViewProps {
  showToast?: (type: 'success' | 'danger', message: string) => void;
}

export default function WalletsView({ showToast }: WalletsViewProps) {
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [perPage, setPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sortField, setSortField] = useState<'employee' | 'balance' | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Modals state
  const [viewWallet, setViewWallet] = useState<WalletItem | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [formEmployee, setFormEmployee] = useState<string>('');
  const [formBalance, setFormBalance] = useState<number>(0);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchResourceList('wallets');
      setWallets(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to load wallets:', err);
      showToast?.('danger', 'Failed to load wallets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter & Sort (preserves MongoDB order by default: Aslam, Devika, Arya, Sona, Roji, Test, Devika)
  const sortedWallets = useMemo(() => {
    if (!sortField) {
      return wallets;
    }

    return [...wallets].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'balance') {
        cmp = (a.balance || 0) - (b.balance || 0);
      } else {
        cmp = (a.employee || '').localeCompare(b.employee || '');
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [wallets, sortField, sortAsc]);

  // Pagination
  const paginatedWallets = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return sortedWallets.slice(start, start + perPage);
  }, [sortedWallets, currentPage, perPage]);

  const handleSort = (field: 'employee' | 'balance') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Handle Create Wallet
  const handleSaveWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmployee.trim()) {
      showToast?.('danger', 'Employee name is required.');
      return;
    }

    setIsSaving(true);
    try {
      await createResourceItem('wallets', {
        employee: formEmployee.trim(),
        balance: Number(formBalance) || 0,
        currency: 'INR',
      });
      showToast?.('success', 'Wallet created successfully!');
      setCreateModalOpen(false);
      setFormEmployee('');
      setFormBalance(0);
      await loadData();
    } catch {
      showToast?.('danger', 'Failed to create wallet.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Breadcrumb & Heading matching Screenshot 4 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span>Wallets</span>
            <span className="text-slate-500">&gt;</span>
            <span className="text-slate-300">List</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Wallets</h1>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#09929e] hover:bg-[#08818c] text-white text-[13px] font-semibold rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
        >
          <span>New wallet</span>
        </button>
      </div>

      {/* Main Table Container */}
      <div className="bg-[#0b1322] border border-[#1b263b] rounded-xl overflow-hidden shadow-xl">
        {/* Card toolbar matching Screenshot 4 (right aligned columns toggle) */}
        <div className="p-3 px-6 flex items-center justify-end border-b border-[#1b263b]">
          <button
            className="p-1.5 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
            title="Columns"
          >
            <Columns3 className="w-4 h-4" />
          </button>
        </div>

        {/* Table matching Screenshot 4 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1c283f] bg-[#0c1322] text-slate-300 font-semibold text-[13px]">
                <th
                  onClick={() => handleSort('employee')}
                  className="py-3.5 px-6 cursor-pointer hover:text-white select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Employee</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('balance')}
                  className="py-3.5 px-6 cursor-pointer hover:text-white select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Balance</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-6 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#172236] text-[13px]">
              {loading ? (
                <tr>
                  <td colSpan={3} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-[#09929e]" />
                      <span>Loading wallets...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedWallets.length > 0 ? (
                paginatedWallets.map((item, idx) => (
                  <tr key={item._id || item.id || idx} className="hover:bg-[#131c2e]/60 transition text-slate-200">
                    <td className="py-3.5 px-6 font-normal text-white">{item.employee}</td>
                    <td className="py-3.5 px-6 text-slate-200 font-normal">
                      {(item.balance || 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <button
                        onClick={() => setViewWallet(item)}
                        className="inline-flex items-center gap-1.5 text-[13px] text-slate-300 hover:text-white transition cursor-pointer"
                      >
                        <Eye className="w-4 h-4 text-slate-400" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-slate-500">
                    No wallets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer matching Screenshot 4 */}
        <div className="px-6 py-3.5 border-t border-[#1c283f] flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] text-slate-400">
          <span>
            {sortedWallets.length > 0
              ? `Showing ${(currentPage - 1) * perPage + 1} to ${Math.min(
                  currentPage * perPage,
                  sortedWallets.length
                )} of ${sortedWallets.length} results`
              : 'Showing 0 results'}
          </span>

          <div className="flex items-center gap-2">
            <span>Per page</span>
            <div className="relative inline-block">
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="appearance-none bg-[#080d1a] border border-slate-700/80 rounded-lg pl-3 pr-8 py-1 text-white text-[13px] focus:outline-none focus:ring-1 focus:ring-[#09929e] cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* VIEW MODAL: Show Wallet Details */}
      {viewWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#101728] border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-700/70 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Wallet Overview</h3>
                <p className="text-xs text-slate-400">{viewWallet.employee}</p>
              </div>
              <button
                onClick={() => setViewWallet(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-[13px]">
              <div className="bg-[#080d1a] p-4 rounded-xl border border-slate-800 text-center">
                <span className="text-xs text-slate-400 block mb-1">Available Balance</span>
                <span className="text-3xl font-bold text-white block">
                  ₹{(viewWallet.balance || 0).toLocaleString()}
                </span>
                <span className="text-xs text-emerald-400 mt-1 inline-block">INR Account</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-[#080d1a] p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Employee</span>
                  <span className="font-medium text-white">{viewWallet.employee}</span>
                </div>
                <div className="bg-[#080d1a] p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Status</span>
                  <span className="text-emerald-400 font-medium">Active</span>
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-[#0b1322] border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setViewWallet(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MODAL: New Wallet */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#101728] border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-700/70 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Create New Wallet</h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWallet} className="p-6 space-y-4 text-[13px]">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Employee Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aslam"
                  value={formEmployee}
                  onChange={(e) => setFormEmployee(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#09929e]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Initial Balance (INR)
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={formBalance}
                  onChange={(e) => setFormBalance(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#09929e]"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-[#09929e] hover:bg-[#08818c] text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? 'Saving...' : 'Create Wallet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
