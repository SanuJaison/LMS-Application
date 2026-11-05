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
  CheckCircle,
} from 'lucide-react';
import {
  fetchResourceList,
  createResourceItem,
  updateResourceItem,
  deleteResourceItem,
  authHeaders,
} from '../../services/api';
import TablePagination from '@/components/ui/TablePagination';

export interface WalletWithdrawRequestItem {
  _id?: string;
  id?: string;
  request_id?: string;
  name?: string;
  title?: string;
  employee?: string;
  employee_id?: string;
  designation?: string;
  team?: string;
  email?: string;
  phone?: string;
  contact?: string;
  upi_id?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  amount?: number;
  description?: string;
  notes?: string;
  remarks?: string;
  status: string;
  transaction_reference?: string;
  createdAt?: string;
}

interface WalletWithdrawRequestsViewProps {
  showToast?: (type: 'success' | 'danger', message: string) => void;
}

export default function WalletWithdrawRequestsView({ showToast }: WalletWithdrawRequestsViewProps) {
  const [requests, setRequests] = useState<WalletWithdrawRequestItem[]>([]);
  const [employees, setEmployees] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
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
          r.employee_id?.toLowerCase().includes(q) ||
          r.designation?.toLowerCase().includes(q) ||
          r.request_id?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.upi_id?.toLowerCase().includes(q) ||
          r.contact?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q) ||
          r.remarks?.toLowerCase().includes(q) ||
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
    setFormContact(item.contact || item.upi_id || item.email || item.phone || '');
    setFormNotes(item.description || item.notes || item.remarks || '');
    setFormStatus(item.status || 'Pending');
    setCreateModalOpen(true);
  };

  const handleWorkflowAction = async (
    item: WalletWithdrawRequestItem,
    action: string
  ) => {
    const id = rowId(item);
    setActionLoadingId(id);
    try {
      const res = await fetch('/api/wallet/workflow', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          id,
          request_id: item.request_id,
          action,
          remarks: `Processed by Admin (${action})`,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast?.('success', json.message || 'Status updated');
        await loadData();
      } else {
        showToast?.('danger', json.message || 'Action failed');
      }
    } catch {
      showToast?.('danger', 'Failed to process workflow action');
    } finally {
      setActionLoadingId(null);
    }
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
        remarks: formNotes.trim(),
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

  const getStatusBadgeClass = (status?: string) => {
    const st = (status || 'Pending').toLowerCase();
    if (st === 'paid' || st === 'approved' || st === 'active') {
      return 'border border-success/40 bg-success/10 text-success';
    }
    if (st === 'rejected') {
      return 'border border-danger/40 bg-danger/10 text-danger';
    }
    return 'border border-warning/40 bg-warning/10 text-warning';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted mb-1">
            <span>Wallets</span>
            <span className="text-subtle">&gt;</span>
            <span className="text-ink/80">Withdraw Requests</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Wallet Withdraw Requests</h1>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-[13px] font-semibold rounded-lg shadow-sm transition active:scale-95 cursor-pointer self-start sm:self-auto"
        >
          <span>New withdraw request</span>
        </button>
      </div>

      {/* Main Table Container */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-xl">
        {/* Search Toolbar */}
        <div className="p-4 flex items-center justify-end gap-3 border-b border-line">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by employee, ID, status..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-field border border-line rounded-lg text-[13px] text-ink placeholder-subtle focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <button
            className="p-2 border border-line rounded-lg text-muted hover:text-ink bg-field cursor-pointer"
            title="Columns"
          >
            <Columns3 className="w-4 h-4" />
          </button>
        </div>

        {/* Table */}
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
                  onClick={() => handleSort('amount')}
                  className="py-3.5 px-6 cursor-pointer hover:text-ink select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Amount</span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted" />
                  </div>
                </th>
                <th className="py-3.5 px-6 font-semibold">Contact / UPI</th>
                <th className="py-3.5 px-6 font-semibold">Notes</th>
                <th className="py-3.5 px-6 font-semibold">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-2 text-[13px]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-accent" />
                      <span>Loading requests...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedRequests.length > 0 ? (
                paginatedRequests.map((item, idx) => {
                  const id = rowId(item) || String(idx);
                  const isBusy = actionLoadingId === id;

                  return (
                    <tr key={id} className="hover:bg-hover/60 transition text-ink">
                      <td className="py-3.5 px-6 font-normal text-ink">
                        <div className="font-semibold text-ink">
                          {item.employee || item.name || '—'}
                        </div>
                        {(item.employee_id || item.designation) && (
                          <div className="text-[11px] text-muted">
                            {item.employee_id}
                            {item.employee_id && item.designation ? ' • ' : ''}
                            {item.designation}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-ink font-semibold">
                        ₹{(item.amount || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-6 text-ink/80">
                        {item.upi_id || item.contact || item.email || item.phone || '—'}
                      </td>
                      <td className="py-3.5 px-6 text-ink/80">
                        {item.description || item.notes || item.remarks || '—'}
                      </td>
                      <td className="py-3.5 px-6">
                        <span
                          className={`inline-block px-3 py-0.5 rounded text-xs font-medium ${getStatusBadgeClass(
                            item.status
                          )}`}
                        >
                          {item.status || 'Pending'}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2.5 flex-wrap">
                          {item.status === 'Forwarded to Accounts' && (
                            <>
                              <button
                                onClick={() => handleWorkflowAction(item, 'sanction')}
                                disabled={isBusy}
                                className="px-2.5 py-1 rounded bg-accent hover:bg-accent-hover text-white text-xs font-semibold cursor-pointer"
                              >
                                Sanction
                              </button>
                              <button
                                onClick={() => handleWorkflowAction(item, 'reject')}
                                disabled={isBusy}
                                className="px-2 py-1 rounded bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 text-xs cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {item.status === 'Approved' && (
                            <button
                              onClick={() => handleWorkflowAction(item, 'pay')}
                              disabled={isBusy}
                              className="px-2.5 py-1 rounded bg-success hover:bg-success/90 text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-1"
                            >
                              <CheckCircle className="w-3 h-3" />
                              <span>Mark Paid</span>
                            </button>
                          )}
                          <button
                            onClick={() => setViewItem(item)}
                            className="inline-flex items-center gap-1.5 text-[13px] text-ink/80 hover:text-ink transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4 text-muted" />
                            <span>View</span>
                          </button>
                          <button
                            onClick={() => openEditModal(item)}
                            className="inline-flex items-center gap-1.5 text-[13px] text-accent hover:text-accent-hover transition cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5 text-accent" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDelete(id)}
                            className="inline-flex items-center gap-1.5 text-[13px] text-danger hover:text-danger transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-danger" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-subtle">
                    No wallet withdraw requests found. Click &quot;New withdraw request&quot; to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <TablePagination
          total={filteredRequests.length}
          page={currentPage}
          perPage={perPage}
          onPageChange={setCurrentPage}
          onPerPageChange={setPerPage}
        />
      </div>

      {/* CREATE / EDIT MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-elevated border border-line rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-line flex items-center justify-between">
              <h3 className="text-base font-semibold text-ink">
                {editingItem ? 'Edit Withdraw Request' : 'New Wallet Withdraw Request'}
              </h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-muted hover:text-ink p-1 rounded-lg hover:bg-active transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-[13px]">
              <div>
                <label className="block text-xs font-semibold text-ink/80 mb-1.5">
                  Employee <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <select
                    required
                    value={formEmployee}
                    onChange={(e) => setFormEmployee(e.target.value)}
                    className="w-full appearance-none px-3.5 py-2.5 bg-field border border-line rounded-lg text-ink text-[13px] focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
                  >
                    <option value="" disabled>Select employee</option>
                    {employees.map((emp) => (
                      <option key={emp} value={emp} className="bg-surface text-ink">
                        {emp}
                      </option>
                    ))}
                    {!employees.includes(formEmployee) && formEmployee && (
                      <option key={formEmployee} value={formEmployee} className="bg-surface text-ink">
                        {formEmployee}
                      </option>
                    )}
                  </select>
                  <ChevronDown className="w-4 h-4 text-muted absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink/80 mb-1.5">Amount (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-field border border-line rounded-lg text-ink text-[13px] focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink/80 mb-1.5">Contact / Email / UPI</label>
                <input
                  type="text"
                  placeholder="UPI ID, email, or phone"
                  value={formContact}
                  onChange={(e) => setFormContact(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-field border border-line rounded-lg text-ink text-[13px] focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink/80 mb-1.5">Notes / Reason</label>
                <textarea
                  rows={2}
                  placeholder="Additional details..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-field border border-line rounded-lg text-ink text-[13px] focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink/80 mb-1.5">Status</label>
                <div className="relative">
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full appearance-none px-3.5 py-2.5 bg-field border border-line rounded-lg text-ink text-[13px] focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
                  >
                    <option value="Submitted to ASM" className="bg-surface text-ink">Submitted to ASM</option>
                    <option value="Forwarded to SM" className="bg-surface text-ink">Forwarded to SM</option>
                    <option value="Forwarded to Accounts" className="bg-surface text-ink">Forwarded to Accounts</option>
                    <option value="Pending" className="bg-surface text-ink">Pending</option>
                    <option value="Approved" className="bg-surface text-ink">Approved</option>
                    <option value="Paid" className="bg-surface text-ink">Paid</option>
                    <option value="Rejected" className="bg-surface text-ink">Rejected</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-muted absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 bg-surface hover:bg-active text-ink text-[13px] font-semibold rounded-lg border border-line transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-accent hover:bg-accent-hover text-white text-[13px] font-semibold rounded-lg shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-elevated border border-line rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-line flex items-center justify-between">
              <h3 className="text-base font-semibold text-ink">Withdraw Request Details</h3>
              <button
                onClick={() => setViewItem(null)}
                className="text-muted hover:text-ink p-1 rounded-lg hover:bg-active transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3 text-[13px]">
              {viewItem.request_id && (
                <div>
                  <span className="text-xs text-muted block">Request ID</span>
                  <span className="text-ink font-mono font-semibold">{viewItem.request_id}</span>
                </div>
              )}
              <div>
                <span className="text-xs text-muted block">Employee</span>
                <span className="text-ink font-medium">
                  {viewItem.employee || viewItem.name || '—'}
                  {viewItem.employee_id ? ` (${viewItem.employee_id})` : ''}
                </span>
                {viewItem.designation && (
                  <span className="block text-xs text-muted">{viewItem.designation}</span>
                )}
              </div>
              <div>
                <span className="text-xs text-muted block">Amount</span>
                <span className="text-success font-bold text-base">₹{(viewItem.amount || 0).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-xs text-muted block">Contact / UPI</span>
                <span className="text-ink">
                  {viewItem.upi_id || viewItem.contact || viewItem.email || viewItem.phone || '—'}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted block">Notes</span>
                <span className="text-ink">
                  {viewItem.description || viewItem.notes || viewItem.remarks || '—'}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted block">Status</span>
                <span className="text-warning font-semibold">{viewItem.status || 'Pending'}</span>
              </div>
            </div>
            <div className="px-6 py-3 border-t border-line flex justify-end">
              <button
                onClick={() => setViewItem(null)}
                className="px-4 py-2 bg-surface hover:bg-active text-ink text-[13px] font-semibold rounded-lg border border-line transition cursor-pointer"
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
