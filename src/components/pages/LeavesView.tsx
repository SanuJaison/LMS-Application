'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  ChevronDown,
  Columns3,
  Calendar,
} from 'lucide-react';
import {
  fetchResourceList,
  createResourceItem,
  updateResourceItem,
  deleteResourceItem,
} from '../../services/api';

export interface LeaveItem {
  _id?: string;
  id?: string;
  employee: string;
  start_date: string;
  end_date: string;
  reason?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | string;
  createdAt?: string;
}

interface LeavesViewProps {
  showToast?: (type: 'success' | 'danger', message: string) => void;
}

const STATUS_FILTERS = ['Pending', 'Approved', 'Rejected', 'All'] as const;

export default function LeavesView({ showToast }: LeavesViewProps) {
  // Mode: 'list' | 'create'
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');

  // Filter Tab: 'Pending' | 'Approved' | 'Rejected' | 'All'
  const [activeFilterTab, setActiveFilterTab] = useState<'Pending' | 'Approved' | 'Rejected' | 'All'>('Pending');

  // Data state
  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [employees, setEmployees] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Table Selection & Pagination
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [perPage, setPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Edit Modal State
  const [editingLeave, setEditingLeave] = useState<LeaveItem | null>(null);

  // Create Form State - matching Screenshot 2 (Status starts unselected: 'Select an option')
  const [formEmployee, setFormEmployee] = useState<string>('');
  const [formStartDate, setFormStartDate] = useState<string>('');
  const [formEndDate, setFormEndDate] = useState<string>('');
  const [formReason, setFormReason] = useState<string>('');
  const [formStatus, setFormStatus] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Load leaves and employees from MongoDB Atlas
  const loadData = async () => {
    try {
      setLoading(true);
      const [leavesRes, empsRes] = await Promise.all([
        fetchResourceList('leaves'),
        fetchResourceList('employees'),
      ]);

      setLeaves(Array.isArray(leavesRes) ? leavesRes : []);

      if (Array.isArray(empsRes)) {
        setEmployees(empsRes.map((e: any) => e.name || e).filter(Boolean));
      }
    } catch (err) {
      console.error('Failed to load leaves:', err);
      showToast?.('danger', 'Failed to load leaves from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const rowId = (item: LeaveItem) => (item._id || item.id || '').toString();

  // Filtered & Sorted
  const filteredLeaves = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let res = leaves;

    // Filter by Active Tab (Pending, Approved, Rejected, All)
    if (activeFilterTab !== 'All') {
      res = res.filter(
        (l) => (l.status || 'Pending').toLowerCase() === activeFilterTab.toLowerCase()
      );
    }

    // Filter by Search Query
    if (q) {
      res = res.filter(
        (l) =>
          l.employee?.toLowerCase().includes(q) ||
          l.start_date?.toLowerCase().includes(q) ||
          l.end_date?.toLowerCase().includes(q) ||
          l.reason?.toLowerCase().includes(q) ||
          l.status?.toLowerCase().includes(q)
      );
    }

    if (!sortField) return res;

    return [...res].sort((a: any, b: any) => {
      const valA = a[sortField] ?? '';
      const valB = b[sortField] ?? '';
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [leaves, activeFilterTab, searchQuery, sortField, sortAsc]);

  // Pagination
  const totalPages = Math.ceil(filteredLeaves.length / perPage) || 1;
  const paginatedLeaves = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredLeaves.slice(start, start + perPage);
  }, [filteredLeaves, currentPage, perPage]);

  // Selection
  const allVisibleSelected =
    paginatedLeaves.length > 0 &&
    paginatedLeaves.every((item) => selectedIds.includes(rowId(item)));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleIds = paginatedLeaves.map(rowId);
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      const visibleIds = paginatedLeaves.map(rowId);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected leaves?`)) return;
    try {
      await deleteResourceItem('leaves', selectedIds);
      showToast?.('success', `${selectedIds.length} leaves deleted successfully!`);
      setSelectedIds([]);
      await loadData();
    } catch {
      showToast?.('danger', 'Failed to delete selected leaves.');
    }
  };

  // Single Delete
  const handleDeleteLeave = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this leave record?')) return;
    try {
      await deleteResourceItem('leaves', id);
      showToast?.('success', 'Leave record deleted successfully!');
      await loadData();
    } catch {
      showToast?.('danger', 'Failed to delete leave record.');
    }
  };

  // Format Helper for Date display (e.g. 2026-08-25 -> Aug 25, 2026)
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes(',')) return dateStr; // Already formatted (e.g. "Aug 25, 2026")
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (!isNaN(year) && !isNaN(month) && !isNaN(day) && months[month]) {
        return `${months[month]} ${day}, ${year}`;
      }
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Format helper for Date input (e.g. "Aug 25, 2026" -> "2026-08-25")
  const formatDateForInput = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('-') && dateStr.length === 10) return dateStr;
    const monthsMap: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const match = dateStr.match(/([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (match) {
      const mStr = match[1].slice(0, 3).toLowerCase();
      const m = monthsMap[mStr];
      const d = match[2].padStart(2, '0');
      const y = match[3];
      if (m) return `${y}-${m}-${d}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  };

  // Reset Create Form
  const resetForm = () => {
    setFormEmployee('');
    setFormStartDate('');
    setFormEndDate('');
    setFormReason('');
    setFormStatus('');
  };

  // Submit Create Leave
  const handleCreateLeave = async (keepOpen = false) => {
    if (!formEmployee) {
      showToast?.('danger', 'Employee is required.');
      return;
    }
    if (!formStartDate) {
      showToast?.('danger', 'Start date is required.');
      return;
    }
    if (!formEndDate) {
      showToast?.('danger', 'End date is required.');
      return;
    }
    if (!formStatus) {
      showToast?.('danger', 'Status is required.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        employee: formEmployee,
        start_date: formatDateDisplay(formStartDate),
        end_date: formatDateDisplay(formEndDate),
        reason: formReason.trim(),
        status: formStatus || 'Pending',
      };

      await createResourceItem('leaves', payload);
      showToast?.('success', 'Leave created successfully!');
      await loadData();

      if (keepOpen) {
        resetForm();
      } else {
        resetForm();
        setViewMode('list');
      }
    } catch (err: any) {
      console.error('Error creating leave:', err);
      showToast?.('danger', err.message || 'Failed to create leave.');
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Edit Leave
  const handleUpdateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLeave) return;
    setIsSaving(true);
    try {
      await updateResourceItem('leaves', {
        id: rowId(editingLeave),
        _id: rowId(editingLeave),
        employee: editingLeave.employee,
        start_date: formatDateDisplay(editingLeave.start_date),
        end_date: formatDateDisplay(editingLeave.end_date),
        reason: editingLeave.reason,
        status: editingLeave.status,
      });
      showToast?.('success', 'Leave record updated successfully!');
      setEditingLeave(null);
      await loadData();
    } catch {
      showToast?.('danger', 'Failed to update leave record.');
    } finally {
      setIsSaving(false);
    }
  };

  // -------------------------------------------------------------
  // VIEW: CREATE LEAVE FORM (Screenshot 2)
  // -------------------------------------------------------------
  if (viewMode === 'create') {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Breadcrumb matching Screenshot 2 */}
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <button
              onClick={() => setViewMode('list')}
              className="text-slate-400 hover:text-white hover:underline cursor-pointer"
            >
              Leaves
            </button>
            <span className="text-slate-500">&gt;</span>
            <span className="text-slate-300">Create</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Create Leave</h1>
        </div>

        {/* Form Fields matching Screenshot 2 */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateLeave(false);
          }}
          className="space-y-5 max-w-5xl"
        >
          {/* Row 1: Employee & Start Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Employee <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  required
                  value={formEmployee}
                  onChange={(e) => setFormEmployee(e.target.value)}
                  className={`w-full appearance-none px-3.5 py-2.5 bg-[#080d1a] border border-slate-700/60 rounded-lg text-[13px] ${
                    !formEmployee ? 'text-slate-400' : 'text-slate-200'
                  } focus:outline-none focus:ring-1 focus:ring-[#09929e] cursor-pointer`}
                >
                  <option value="" disabled>Select an option</option>
                  {employees.map((emp) => (
                    <option key={emp} value={emp} className="bg-[#0b1322] text-white">
                      {emp}
                    </option>
                  ))}
                  {employees.length === 0 && (
                    <>
                      <option value="Aslam" className="bg-[#0b1322] text-white">Aslam</option>
                      <option value="Devika" className="bg-[#0b1322] text-white">Devika</option>
                      <option value="Tony" className="bg-[#0b1322] text-white">Tony</option>
                    </>
                  )}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Start date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#080d1a] border border-slate-700/60 rounded-lg text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-[#09929e] [color-scheme:dark]"
                />
              </div>
            </div>
          </div>

          {/* Row 2: End Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                End date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#080d1a] border border-slate-700/60 rounded-lg text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-[#09929e] [color-scheme:dark]"
                />
              </div>
            </div>
            <div className="hidden md:block"></div>
          </div>

          {/* Row 3: Reason (Full Width) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Reason
            </label>
            <textarea
              rows={3}
              value={formReason}
              onChange={(e) => setFormReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#080d1a] border border-slate-700/60 rounded-lg text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-[#09929e]"
            />
          </div>

          {/* Row 4: Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Status <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  required
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className={`w-full appearance-none px-3.5 py-2.5 bg-[#080d1a] border border-slate-700/60 rounded-lg text-[13px] ${
                    !formStatus ? 'text-slate-400' : 'text-slate-200'
                  } focus:outline-none focus:ring-1 focus:ring-[#09929e] cursor-pointer`}
                >
                  <option value="" disabled>Select an option</option>
                  <option value="Pending" className="bg-[#0b1322] text-white">Pending</option>
                  <option value="Approved" className="bg-[#0b1322] text-white">Approved</option>
                  <option value="Rejected" className="bg-[#0b1322] text-white">Rejected</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
            <div className="hidden md:block"></div>
          </div>

          {/* Bottom Action Buttons matching Screenshot 2 */}
          <div className="pt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-[#09929e] hover:bg-[#08818c] text-white text-[13px] font-semibold rounded-lg shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Creating…' : 'Create'}
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleCreateLeave(true)}
              className="px-4 py-2 bg-[#0b1322] hover:bg-slate-800 text-white text-[13px] font-semibold rounded-lg border border-slate-700 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              Create &amp; create another
            </button>

            <button
              type="button"
              onClick={() => {
                resetForm();
                setViewMode('list');
              }}
              className="px-4 py-2 bg-[#0b1322] hover:bg-slate-800 text-white text-[13px] font-semibold rounded-lg border border-slate-700 transition active:scale-95 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: LEAVES LIST TABLE (Screenshot 1)
  // -------------------------------------------------------------
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Breadcrumb matching Screenshot 1 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span>Leaves</span>
            <span className="text-slate-500">&gt;</span>
            <span className="text-slate-300">List</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Leaves</h1>
        </div>

        <button
          onClick={() => setViewMode('create')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#09929e] hover:bg-[#08818c] text-white text-[13px] font-semibold rounded-lg shadow-sm transition active:scale-95 cursor-pointer self-start sm:self-auto"
        >
          <span>New leave</span>
        </button>
      </div>

      {/* Filament Filter Segment Tabs matching Screenshot 1 (Pending | Approved | Rejected | All) */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center p-1 bg-[#0b1322] border border-[#1b263b] rounded-xl shadow-md gap-1">
          {STATUS_FILTERS.map((tab) => {
            const isActive = activeFilterTab === tab;
            return (
              <button
                key={tab}
                onClick={() => {
                  setActiveFilterTab(tab);
                  setCurrentPage(1);
                }}
                className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition cursor-pointer ${
                  isActive
                    ? 'bg-[#15233e] text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
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

        {/* Bulk Selection Notification Bar */}
        {selectedIds.length > 0 && (
          <div className="bg-[#10243e] px-4 py-2 flex items-center justify-between text-xs border-b border-[#1b263b]">
            <span className="text-slate-200">
              <strong className="text-white">{selectedIds.length}</strong> record(s) selected
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedIds([])}
                className="text-slate-300 hover:text-white underline text-xs cursor-pointer"
              >
                Deselect all
              </button>
              <button
                onClick={handleBulkDelete}
                className="text-red-400 hover:text-red-300 font-semibold text-xs flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete selected</span>
              </button>
            </div>
          </div>
        )}

        {/* Table matching Screenshot 1 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1c283f] bg-[#0c1322] text-slate-300 font-semibold text-[13px]">
                <th className="py-3.5 px-4 w-10">
                  <input
                    type="checkbox"
                    className="accent-[#09929e] cursor-pointer rounded"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    title="Select all"
                  />
                </th>
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
                  onClick={() => handleSort('start_date')}
                  className="py-3.5 px-6 cursor-pointer hover:text-white select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Start date</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('end_date')}
                  className="py-3.5 px-6 cursor-pointer hover:text-white select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>End date</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
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
                      <span>Loading leaves...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedLeaves.length > 0 ? (
                paginatedLeaves.map((item, idx) => {
                  const id = rowId(item) || String(idx);
                  const isSelected = selectedIds.includes(id);
                  const status = (item.status || 'Pending').toLowerCase();

                  return (
                    <tr
                      key={id}
                      className={`transition text-slate-200 ${
                        isSelected ? 'bg-[#0e2233]' : 'hover:bg-[#131c2e]/60'
                      }`}
                    >
                      <td
                        className={`py-3.5 px-4 border-l-2 ${
                          isSelected ? 'border-[#09929e]' : 'border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="accent-[#09929e] cursor-pointer rounded"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(id)}
                        />
                      </td>
                      <td className="py-3.5 px-6 font-normal text-white">{item.employee || '—'}</td>
                      <td className="py-3.5 px-6 text-slate-300">{item.start_date || '—'}</td>
                      <td className="py-3.5 px-6 text-slate-300">{item.end_date || '—'}</td>
                      <td className="py-3.5 px-6">
                        <span
                          className={`inline-block px-3 py-0.5 rounded text-xs font-medium ${
                            status === 'pending'
                              ? 'border border-amber-600/40 bg-amber-500/10 text-amber-400'
                              : status === 'approved'
                              ? 'border border-emerald-600/40 bg-emerald-500/10 text-emerald-400'
                              : 'border border-rose-600/40 bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {item.status || 'Pending'}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <button
                          onClick={() => setEditingLeave(item)}
                          className="inline-flex items-center gap-1.5 text-[13px] text-[#09929e] hover:text-[#08818c] transition cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5 text-[#09929e]" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No {activeFilterTab !== 'All' ? activeFilterTab.toLowerCase() : ''} leaves found. Click &quot;New leave&quot; to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#1c283f] flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] text-slate-400">
          <span>
            {filteredLeaves.length > 0
              ? `Showing ${(currentPage - 1) * perPage + 1} to ${Math.min(
                  currentPage * perPage,
                  filteredLeaves.length
                )} of ${filteredLeaves.length} results`
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

      {/* ------------------------------------------------------------- */}
      {/* EDIT LEAVE MODAL                                              */}
      {/* ------------------------------------------------------------- */}
      {editingLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#101728] border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-700/70 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Edit Leave Record</h3>
              <button
                onClick={() => setEditingLeave(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateLeave} className="p-6 space-y-4 text-[13px]">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Employee <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={editingLeave.employee || ''}
                  onChange={(e) => setEditingLeave({ ...editingLeave, employee: e.target.value })}
                  className="w-full px-3 py-2 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] focus:ring-1 focus:ring-[#09929e]"
                >
                  {employees.map((emp) => (
                    <option key={emp} value={emp}>{emp}</option>
                  ))}
                  {!employees.includes(editingLeave.employee) && (
                    <option key={editingLeave.employee} value={editingLeave.employee}>{editingLeave.employee}</option>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Start Date</label>
                  <input
                    type="date"
                    required
                    value={formatDateForInput(editingLeave.start_date)}
                    onChange={(e) => setEditingLeave({ ...editingLeave, start_date: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] focus:ring-1 focus:ring-[#09929e]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">End Date</label>
                  <input
                    type="date"
                    required
                    value={formatDateForInput(editingLeave.end_date)}
                    onChange={(e) => setEditingLeave({ ...editingLeave, end_date: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] focus:ring-1 focus:ring-[#09929e]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Reason</label>
                <textarea
                  rows={2}
                  value={editingLeave.reason || ''}
                  onChange={(e) => setEditingLeave({ ...editingLeave, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] focus:ring-1 focus:ring-[#09929e]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Status</label>
                <select
                  value={editingLeave.status || 'Pending'}
                  onChange={(e) => setEditingLeave({ ...editingLeave, status: e.target.value })}
                  className="w-full px-3 py-2 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] focus:ring-1 focus:ring-[#09929e]"
                >
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-between border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    const id = rowId(editingLeave);
                    setEditingLeave(null);
                    handleDeleteLeave(id);
                  }}
                  className="text-red-400 hover:text-red-300 text-xs font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingLeave(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 bg-[#09929e] hover:bg-[#08818c] text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
