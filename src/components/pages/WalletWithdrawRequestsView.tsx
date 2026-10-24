'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Eye,
  Pencil,
  Trash2,
  X,
  Loader2,
  ChevronDown,
  Columns3,
} from 'lucide-react';
import {
  fetchResourceList,
  createResourceItem,
  updateResourceItem,
  deleteResourceItem,
} from '../../services/api';

export interface WalletWithdrawRequestItem {
  _id?: string;
  id?: string;
  name?: string;
  title?: string;
  employee?: string;
  email?: string;
  phone?: string;
  contact?: string;
  amount?: number;
  description?: string;
  notes?: string;
  status: string;
  createdAt?: string;
}

interface WalletWithdrawRequestsViewProps {
  showToast?: (type: 'success' | 'danger', message: string) => void;
}

export default function WalletWithdrawRequestsView({ showToast }: WalletWithdrawRequestsViewProps) {
  const [requests, setRequests] = useState<WalletWithdrawRequestItem[]>([]);
  const [employees, setEmployees] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [perPage, setPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<WalletWithdrawRequestItem | null>(null);
  const [viewItem, setViewItem] = useState<WalletWithdrawRequestItem | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form Fields
  const [formEmployee, setFormEmployee] = useState<string>('');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formContact, setFormContact] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formStatus, setFormStatus] = useState<string>('Pending');

  const loadData = async () => {
    try {
      setLoading(true);
      const [reqsRes, empsRes] = await Promise.all([
        fetchResourceList('walletWithdrawRequests'),
        fetchResourceList('employees'),
      ]);

      setRequests(Array.isArray(reqsRes) ? reqsRes : []);
      if (Array.isArray(empsRes)) {
        setEmployees(empsRes.map((e: any) => e.name || e).filter(Boolean));
      }
    } catch (err) {
      console.error('Failed to load wallet withdraw requests:', err);
      showToast?.('danger', 'Failed to load wallet withdraw requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const rowId = (item: WalletWithdrawRequestItem) => (item._id || item.id || '').toString();

  // Filtered & Sorted
  const filteredRequests = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let res = requests;

    if (q) {
      res = res.filter(
        (r) =>
          r.employee?.toLowerCase().includes(q) ||
          r.name?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.contact?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q) ||
          r.status?.toLowerCase().includes(q)
      );
    }

    if (!sortField) return res;

    return [...res].sort((a: any, b: any) => {
      const valA = a[sortField] ?? '';
      const valB = b[sortField] ?? '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [requests, searchQuery, sortField, sortAsc]);

  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredRequests.slice(start, start + perPage);
  }, [filteredRequests, currentPage, perPage]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setFormEmployee('');
    setFormAmount('');
    setFormContact('');
    setFormNotes('');
    setFormStatus('Pending');
    setCreateModalOpen(true);
  };

  const openEditModal = (item: WalletWithdrawRequestItem) => {
    setEditingItem(item);
    setFormEmployee(item.employee || item.name || '');
    setFormAmount(item.amount ? String(item.amount) : '');
    setFormContact(item.contact || item.email || item.phone || '');
    setFormNotes(item.description || item.notes || '');
    setFormStatus(item.status || 'Pending');
    setCreateModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmployee.trim()) {
      showToast?.('danger', 'Employee is required.');
      return;
    }

    setIsSaving(true);
    try {
      const payload: Record<string, any> = {
        name: formEmployee.trim(),
        title: formEmployee.trim(),
        employee: formEmployee.trim(),
        amount: Number(formAmount) || 0,
        contact: formContact.trim(),
        email: formContact.includes('@') ? formContact.trim() : '',
        phone: formContact.trim(),
        description: formNotes.trim(),
        notes: formNotes.trim(),
        status: formStatus || 'Pending',
      };

      if (editingItem) {
        payload.id = rowId(editingItem);
        payload._id = rowId(editingItem);
        await updateResourceItem('walletWithdrawRequests', payload);
        showToast?.('success', 'Withdraw request updated successfully!');
      } else {
        await createResourceItem('walletWithdrawRequests', payload);
        showToast?.('success', 'Withdraw request created successfully!');
      }

      setCreateModalOpen(false);
      await loadData();
    } catch {
      showToast?.('danger', 'Failed to save withdraw request.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this withdraw request?')) return;
    try {
      await deleteResourceItem('walletWithdrawRequests', id);
      showToast?.('success', 'Withdraw request deleted successfully!');
      await loadData();
    } catch {
      showToast?.('danger', 'Failed to delete withdraw request.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span>Wallets</span>
            <span className="text-slate-500">&gt;</span>
            <span className="text-slate-300">Withdraw Requests</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Wallet Withdraw Requests</h1>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#09929e] hover:bg-[#08818c] text-white text-[13px] font-semibold rounded-lg shadow-sm transition active:scale-95 cursor-pointer self-start sm:self-auto"
        >
          <span>New withdraw request</span>
        </button>
      </div>

      {/* Main Table Container */}
      <div className="bg-[#0b1322] border border-[#1b263b] rounded-xl overflow-hidden shadow-xl">
        {/* Search Toolbar */}
        <div className="p-4 flex items-center justify-end gap-3 border-b border-[#1b263b]">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-[#080d1a] border border-slate-700/60 rounded-lg text-[13px] text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#09929e]"
            />
          </div>
          <button
            className="p-2 border border-slate-700/60 rounded-lg text-slate-400 hover:text-white bg-[#080d1a] cursor-pointer"
            title="Columns"
          >
            <Columns3 className="w-4 h-4" />
          </button>
        </div>

        {/* Table */}
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
                  onClick={() => handleSort('amount')}
                  className="py-3.5 px-6 cursor-pointer hover:text-white select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Amount</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-6 font-semibold">Contact</th>
                <th className="py-3.5 px-6 font-semibold">Notes</th>
                <th className="py-3.5 px-6 font-semibold">Status</th>
                <th className="py-3.5 px-6 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#172236] text-[13px]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-[#09929e]" />
                      <span>Loading requests...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedRequests.length > 0 ? (
                paginatedRequests.map((item, idx) => {
                  const id = rowId(item) || String(idx);
                  const st = (item.status || 'Pending').toLowerCase();

                  return (
                    <tr key={id} className="hover:bg-[#131c2e]/60 transition text-slate-200">
                      <td className="py-3.5 px-6 font-normal text-white">{item.employee || item.name || '—'}</td>
                      <td className="py-3.5 px-6 text-slate-200">
                        ₹{(item.amount || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-6 text-slate-300">{item.contact || item.email || item.phone || '—'}</td>
                      <td className="py-3.5 px-6 text-slate-300">{item.description || item.notes || '—'}</td>
                      <td className="py-3.5 px-6">
                        <span
                          className={`inline-block px-3 py-0.5 rounded text-xs font-medium ${
                            st === 'pending'
                              ? 'border border-amber-600/40 bg-amber-500/10 text-amber-400'
                              : st === 'approved' || st === 'active'
                              ? 'border border-emerald-600/40 bg-emerald-500/10 text-emerald-400'
                              : 'border border-rose-600/40 bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {item.status || 'Pending'}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => setViewItem(item)}
                            className="inline-flex items-center gap-1.5 text-[13px] text-slate-300 hover:text-white transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4 text-slate-400" />
                            <span>View</span>
                          </button>
                          <button
                            onClick={() => openEditModal(item)}
                            className="inline-flex items-center gap-1.5 text-[13px] text-[#09929e] hover:text-[#08818c] transition cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5 text-[#09929e]" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDelete(id)}
                            className="inline-flex items-center gap-1.5 text-[13px] text-rose-400 hover:text-rose-300 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No wallet withdraw requests found. Click &quot;New withdraw request&quot; to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#1c283f] flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] text-slate-400">
          <span>
            {filteredRequests.length > 0
              ? `Showing ${(currentPage - 1) * perPage + 1} to ${Math.min(
                  currentPage * perPage,
                  filteredRequests.length
                )} of ${filteredRequests.length} results`
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

      {/* CREATE / EDIT MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#101728] border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-700/70 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">
                {editingItem ? 'Edit Withdraw Request' : 'New Wallet Withdraw Request'}
              </h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-[13px]">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Employee <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    required
                    value={formEmployee}
                    onChange={(e) => setFormEmployee(e.target.value)}
                    className="w-full appearance-none px-3.5 py-2.5 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] focus:outline-none focus:ring-1 focus:ring-[#09929e] cursor-pointer"
                  >
                    <option value="" disabled>Select employee</option>
                    {employees.map((emp) => (
                      <option key={emp} value={emp} className="bg-[#0b1322] text-white">
                        {emp}
                      </option>
                    ))}
                    {!employees.includes(formEmployee) && formEmployee && (
                      <option key={formEmployee} value={formEmployee} className="bg-[#0b1322] text-white">
                        {formEmployee}
                      </option>
                    )}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Amount (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] focus:outline-none focus:ring-1 focus:ring-[#09929e]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Contact / Email</label>
                <input
                  type="text"
                  placeholder="Email or phone"
                  value={formContact}
                  onChange={(e) => setFormContact(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] focus:outline-none focus:ring-1 focus:ring-[#09929e]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Notes / Reason</label>
                <textarea
                  rows={2}
                  placeholder="Additional details..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] focus:outline-none focus:ring-1 focus:ring-[#09929e]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Status</label>
                <div className="relative">
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full appearance-none px-3.5 py-2.5 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] focus:outline-none focus:ring-1 focus:ring-[#09929e] cursor-pointer"
                  >
                    <option value="Pending" className="bg-[#0b1322] text-white">Pending</option>
                    <option value="Approved" className="bg-[#0b1322] text-white">Approved</option>
                    <option value="Rejected" className="bg-[#0b1322] text-white">Rejected</option>
                    <option value="Active" className="bg-[#0b1322] text-white">Active</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 bg-[#0b1322] hover:bg-slate-800 text-white text-[13px] font-semibold rounded-lg border border-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-[#09929e] hover:bg-[#08818c] text-white text-[13px] font-semibold rounded-lg shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? 'Saving…' : editingItem ? 'Save Changes' : 'Create Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW MODAL */}
      {viewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#101728] border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-700/70 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Withdraw Request Details</h3>
              <button
                onClick={() => setViewItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3 text-[13px]">
              <div>
                <span className="text-xs text-slate-400 block">Employee</span>
                <span className="text-white font-medium">{viewItem.employee || viewItem.name || '—'}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Amount</span>
                <span className="text-emerald-400 font-bold text-base">₹{(viewItem.amount || 0).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Contact</span>
                <span className="text-slate-200">{viewItem.contact || viewItem.email || '—'}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Notes</span>
                <span className="text-slate-200">{viewItem.description || viewItem.notes || '—'}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Status</span>
                <span className="text-amber-400 font-semibold">{viewItem.status || 'Pending'}</span>
              </div>
            </div>
            <div className="px-6 py-3 border-t border-slate-700/60 flex justify-end">
              <button
                onClick={() => setViewItem(null)}
                className="px-4 py-2 bg-[#0b1322] hover:bg-slate-800 text-white text-[13px] font-semibold rounded-lg border border-slate-700 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
