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
import TablePagination from '@/components/ui/TablePagination';

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
          <div className="flex items-center gap-2 text-xs text-muted mb-1">
            <span>Wallets</span>
            <span className="text-subtle">&gt;</span>
            <span className="text-ink/80">List</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Wallets</h1>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-[13px] font-semibold rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
        >
          <span>New wallet</span>
        </button>
      </div>

      {/* Main Table Container */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-xl">
        {/* Card toolbar matching Screenshot 4 (right aligned columns toggle) */}
        <div className="p-3 px-6 flex items-center justify-end border-b border-line">
          <button
            className="p-1.5 rounded-lg text-muted hover:text-ink transition cursor-pointer"
            title="Columns"
          >
            <Columns3 className="w-4 h-4" />
          </button>
        </div>

        {/* Table matching Screenshot 4 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-ink/80 font-semibold text-[13px]">
                <th
                  onClick={() => handleSort('employee')}
                  className="py-3.5 px-6 cursor-pointer hover:text-ink select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Employee</span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('balance')}
                  className="py-3.5 px-6 cursor-pointer hover:text-ink select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Balance</span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted" />
                  </div>
                </th>
                <th className="py-3.5 px-6 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-2 text-[13px]">
              {loading ? (
                <tr>
                  <td colSpan={3} className="py-16 text-center text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-accent" />
                      <span>Loading wallets...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedWallets.length > 0 ? (
                paginatedWallets.map((item, idx) => (
                  <tr key={item._id || item.id || idx} className="hover:bg-hover/60 transition text-ink">
                    <td className="py-3.5 px-6 font-normal text-ink">{item.employee}</td>
                    <td className="py-3.5 px-6 text-ink font-normal">
                      {(item.balance || 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <button
                        onClick={() => setViewWallet(item)}
                        className="inline-flex items-center gap-1.5 text-[13px] text-ink/80 hover:text-ink transition cursor-pointer"
                      >
                        <Eye className="w-4 h-4 text-muted" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-subtle">
                    No wallets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <TablePagination
          total={sortedWallets.length}
          page={currentPage}
          perPage={perPage}
          onPageChange={setCurrentPage}
          onPerPageChange={setPerPage}
        />
      </div>

      {/* VIEW MODAL: Show Wallet Details */}
      {viewWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-elevated border border-line rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-line flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink">Wallet Overview</h3>
                <p className="text-xs text-muted">{viewWallet.employee}</p>
              </div>
              <button
                onClick={() => setViewWallet(null)}
                className="text-muted hover:text-ink p-1 rounded-lg hover:bg-active transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-[13px]">
              <div className="bg-field p-4 rounded-xl border border-line text-center">
                <span className="text-xs text-muted block mb-1">Available Balance</span>
                <span className="text-3xl font-bold text-ink block">
                  ₹{(viewWallet.balance || 0).toLocaleString()}
                </span>
                <span className="text-xs text-success mt-1 inline-block">INR Account</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-field p-3 rounded-lg border border-line">
                  <span className="text-muted block mb-0.5">Employee</span>
                  <span className="font-medium text-ink">{viewWallet.employee}</span>
                </div>
                <div className="bg-field p-3 rounded-lg border border-line">
                  <span className="text-muted block mb-0.5">Status</span>
                  <span className="text-success font-medium">Active</span>
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-surface border-t border-line flex justify-end">
              <button
                onClick={() => setViewWallet(null)}
                className="px-4 py-2 bg-active hover:bg-active text-ink/80 text-xs font-medium rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MODAL: New Wallet */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-elevated border border-line rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-line flex items-center justify-between">
              <h3 className="text-base font-semibold text-ink">Create New Wallet</h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-muted hover:text-ink p-1 rounded-lg hover:bg-active transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWallet} className="p-6 space-y-4 text-[13px]">
              <div>
                <label className="block text-xs font-semibold text-ink/80 mb-1.5">
                  Employee Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aslam"
                  value={formEmployee}
                  onChange={(e) => setFormEmployee(e.target.value)}
                  className="w-full px-3.5 py-2 bg-field border border-line rounded-lg text-ink text-[13px] placeholder-subtle focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink/80 mb-1.5">
                  Initial Balance (INR)
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={formBalance}
                  onChange={(e) => setFormBalance(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-field border border-line rounded-lg text-ink text-[13px] placeholder-subtle focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 bg-active hover:bg-active text-ink/80 text-xs font-medium rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
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
