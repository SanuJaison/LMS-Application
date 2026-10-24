'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Eye,
  Pencil,
  Trash2,
  X,
  Plus,
  Loader2,
  RotateCw,
  CheckCircle2,
  XCircle,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';
import {
  fetchResourceList,
  createResourceItem,
  updateResourceItem,
  deleteResourceItem,
  generateTasksNow,
} from '../../services/api';

export interface TaskTemplateItem {
  _id?: string;
  id?: string;
  title: string;
  metric_type: string;
  designation: string;
  frequency: string;
  target_count: number;
  is_carry_over: boolean;
  is_active: boolean;
  description?: string;
  createdAt?: string;
}

interface TaskTemplatesViewProps {
  showToast?: (type: 'success' | 'danger', message: string) => void;
  onNavigateToTasks?: () => void;
}

const METRIC_TYPE_OPTIONS = ['Leads Generated', 'Calls Made', 'Admissions Closed', 'Follow-ups Completed'];
const FREQUENCY_OPTIONS = ['daily', 'weekly', 'monthly'];

export default function TaskTemplatesView({ showToast, onNavigateToTasks }: TaskTemplatesViewProps) {
  // Data State
  const [templates, setTemplates] = useState<TaskTemplateItem[]>([]);
  const [designations, setDesignations] = useState<string[]>(['Business Development Executive']);
  const [loading, setLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Table controls
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [perPage, setPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Modals state
  const [viewModalItem, setViewModalItem] = useState<TaskTemplateItem | null>(null);
  const [formModalOpen, setFormModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<TaskTemplateItem | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form Fields
  const [formTitle, setFormTitle] = useState<string>('');
  const [formMetricType, setFormMetricType] = useState<string>('Leads Generated');
  const [formDesignation, setFormDesignation] = useState<string>('Business Development Executive');
  const [formFrequency, setFormFrequency] = useState<string>('daily');
  const [formTargetCount, setFormTargetCount] = useState<number>(15);
  const [formIsCarryOver, setFormIsCarryOver] = useState<boolean>(true);
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formDescription, setFormDescription] = useState<string>('');

  // Fetch templates & designations
  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchResourceList('taskTemplates');
      setTemplates(Array.isArray(res) ? res : []);

      // Load designations for dropdown
      try {
        const desigRes = await fetchResourceList('designations');
        if (Array.isArray(desigRes) && desigRes.length > 0) {
          const names = desigRes.map((d: any) => d.name).filter(Boolean);
          if (names.length > 0) setDesignations(names);
        }
      } catch {
        // keep defaults
      }
    } catch (err) {
      console.error('Failed to load task templates:', err);
      showToast?.('danger', 'Failed to load task templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const rowId = (item: TaskTemplateItem) => (item._id || item.id || '').toString();

  // Filtered
  const filteredTemplates = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.title?.toLowerCase().includes(q) ||
        t.metric_type?.toLowerCase().includes(q) ||
        t.designation?.toLowerCase().includes(q) ||
        t.frequency?.toLowerCase().includes(q)
    );
  }, [templates, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredTemplates.length / perPage) || 1;
  const paginatedTemplates = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredTemplates.slice(start, start + perPage);
  }, [filteredTemplates, currentPage, perPage]);

  // Selection
  const allVisibleSelected =
    paginatedTemplates.length > 0 &&
    paginatedTemplates.every((item) => selectedIds.includes(rowId(item)));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleIds = paginatedTemplates.map(rowId);
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      const visibleIds = paginatedTemplates.map(rowId);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Trigger automated task generation ("Generate Tasks Now")
  const handleGenerateTasks = async () => {
    try {
      setIsGenerating(true);
      const res = await generateTasksNow();
      if (res.success) {
        showToast?.('success', res.message || 'Tasks generated successfully!');
      } else {
        showToast?.('danger', res.message || 'Failed to generate tasks');
      }
    } catch (err) {
      console.error('Error generating tasks:', err);
      showToast?.('danger', 'Error triggering task generation.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Open Create Modal
  const openCreateModal = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormMetricType('Leads Generated');
    setFormDesignation(designations[0] || 'Business Development Executive');
    setFormFrequency('daily');
    setFormTargetCount(15);
    setFormIsCarryOver(true);
    setFormIsActive(true);
    setFormDescription('');
    setFormModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (item: TaskTemplateItem) => {
    setEditingItem(item);
    setFormTitle(item.title || '');
    setFormMetricType(item.metric_type || 'Leads Generated');
    setFormDesignation(item.designation || designations[0] || 'Business Development Executive');
    setFormFrequency(item.frequency || 'daily');
    setFormTargetCount(item.target_count || 15);
    setFormIsCarryOver(item.is_carry_over !== false);
    setFormIsActive(item.is_active !== false);
    setFormDescription(item.description || '');
    setFormModalOpen(true);
  };

  // Save (Create / Edit)
  const handleSaveTemplate = async (e: React.FormEvent, keepOpen = false) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDesignation.trim()) {
      showToast?.('danger', 'Title and Designation are required.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: formTitle.trim(),
        metric_type: formMetricType,
        designation: formDesignation,
        frequency: formFrequency,
        target_count: Number(formTargetCount) || 15,
        is_carry_over: formIsCarryOver,
        is_active: formIsActive,
        description: formDescription.trim(),
      };

      if (editingItem) {
        await updateResourceItem('taskTemplates', {
          ...payload,
          id: rowId(editingItem),
          _id: rowId(editingItem),
        });
        showToast?.('success', 'Task template updated successfully!');
        setFormModalOpen(false);
        setEditingItem(null);
      } else {
        await createResourceItem('taskTemplates', payload);
        showToast?.('success', 'Task template created successfully!');
        if (keepOpen) {
          setFormTitle('');
          setFormDescription('');
        } else {
          setFormModalOpen(false);
        }
      }
      await loadData();
    } catch (err) {
      console.error('Error saving template:', err);
      showToast?.('danger', 'Failed to save task template.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete single
  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this task template?')) return;
    setIsDeleting(id);
    try {
      await deleteResourceItem('taskTemplates', id);
      showToast?.('success', 'Task template deleted successfully!');
      setSelectedIds((prev) => prev.filter((i) => i !== id));
      await loadData();
    } catch {
      showToast?.('danger', 'Failed to delete task template.');
    } finally {
      setIsDeleting(null);
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected task templates?`)) return;
    try {
      await deleteResourceItem('taskTemplates', selectedIds);
      showToast?.('success', `${selectedIds.length} templates deleted successfully!`);
      setSelectedIds([]);
      await loadData();
    } catch {
      showToast?.('danger', 'Failed to delete selected templates.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Breadcrumb matching Screenshot 1 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span>Task Templates</span>
            <span>&gt;</span>
            <span className="text-slate-200">List</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Task Templates</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Generate Tasks Now (Emerald Green Button) */}
          <button
            onClick={handleGenerateTasks}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-semibold rounded-lg shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Generate today's tasks for all matching active employees"
          >
            <RotateCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Generating…' : 'Generate Tasks Now'}</span>
          </button>

          {/* New task template (Cyan Button) */}
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#09929e] hover:bg-[#08818c] text-white text-xs font-semibold rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
          >
            <span>New task template</span>
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-[#0b1322] border border-[#1b263b] rounded-xl overflow-hidden shadow-xl">
        {/* Search Toolbar matching Screenshot 5 (Right aligned) */}
        <div className="p-4 flex items-center justify-end border-b border-[#1b263b]">
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
        </div>

        {/* Bulk Selection Notification Bar */}
        {selectedIds.length > 0 && (
          <div className="bg-[#10243e] px-4 py-2 flex items-center justify-between text-xs border-b border-[#1b263b]">
            <span className="text-slate-200">
              <strong className="text-white">{selectedIds.length}</strong> template(s) selected
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedIds([])}
                className="text-slate-300 hover:text-white underline text-xs"
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

        {/* Table matching Screenshot 5 */}
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
                <th className="py-3.5 px-6">Title</th>
                <th className="py-3.5 px-6">Metric type</th>
                <th className="py-3.5 px-6">Designation</th>
                <th className="py-3.5 px-6">Frequency</th>
                <th className="py-3.5 px-6">Target count</th>
                <th className="py-3.5 px-6 text-center">Is carry over</th>
                <th className="py-3.5 px-6 text-center">Is active</th>
                <th className="py-3.5 px-6 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#172236] text-[13px]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-[#09929e]" />
                      <span>Loading task templates...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedTemplates.length > 0 ? (
                paginatedTemplates.map((item, idx) => {
                  const id = rowId(item) || String(idx);
                  const isSelected = selectedIds.includes(id);

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
                      <td className="py-3.5 px-6 font-normal text-white">{item.title || '—'}</td>
                      <td className="py-3.5 px-6 text-slate-300">{item.metric_type || 'Leads Generated'}</td>
                      <td className="py-3.5 px-6 text-slate-300">{item.designation || '—'}</td>
                      <td className="py-3.5 px-6 text-slate-300">{item.frequency || 'daily'}</td>
                      <td className="py-3.5 px-6 text-slate-200">{item.target_count ?? 15}</td>
                      <td className="py-3.5 px-6 text-center">
                        {item.is_carry_over !== false ? (
                          <svg className="w-4 h-4 text-emerald-400 inline-block" viewBox="0 0 20 20" fill="none">
                            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M6 10l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-slate-500 inline-block" viewBox="0 0 20 20" fill="none">
                            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-center">
                        {item.is_active !== false ? (
                          <svg className="w-4 h-4 text-emerald-400 inline-block" viewBox="0 0 20 20" fill="none">
                            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M6 10l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-rose-500 inline-block" viewBox="0 0 20 20" fill="none">
                            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => setViewModalItem(item)}
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
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No task templates found. Click &quot;New task template&quot; to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#1c283f] flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] text-slate-400">
          <span>
            {filteredTemplates.length === 1
              ? 'Showing 1 result'
              : `Showing ${filteredTemplates.length > 0 ? (currentPage - 1) * perPage + 1 : 0} to ${Math.min(
                  currentPage * perPage,
                  filteredTemplates.length
                )} of ${filteredTemplates.length} results`}
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

      {/* VIEW MODAL */}
      {viewModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl bg-[#111827] border border-slate-700 rounded-2xl shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-white text-base">View task template</h3>
              <button
                onClick={() => setViewModalItem(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Title</label>
                  <div className="px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white">
                    {viewModalItem.title || '—'}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Metric Type</label>
                  <div className="px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white">
                    {viewModalItem.metric_type || 'Leads Generated'}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Designation</label>
                  <div className="px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white">
                    {viewModalItem.designation || '—'}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Frequency</label>
                  <div className="px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white capitalize">
                    {viewModalItem.frequency || 'daily'}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Target Count</label>
                  <div className="px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-emerald-400 font-bold">
                    {viewModalItem.target_count ?? 15}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Flags</label>
                  <div className="flex items-center gap-3 pt-1">
                    <span
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium border ${
                        viewModalItem.is_carry_over !== false
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      Carry Over: {viewModalItem.is_carry_over !== false ? 'Yes' : 'No'}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium border ${
                        viewModalItem.is_active !== false
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800'
                          : 'bg-red-950/40 text-red-400 border-red-800'
                      }`}
                    >
                      {viewModalItem.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              {viewModalItem.description && (
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Description</label>
                  <div className="px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-slate-300">
                    {viewModalItem.description}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-start gap-2 pt-5">
              <button
                type="button"
                onClick={() => setViewModalItem(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-600 bg-[#1b263b] text-slate-200 hover:bg-slate-700 text-xs font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {formModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl bg-[#111827] border border-slate-700 rounded-2xl shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-white text-base">
                {editingItem ? 'Edit task template' : 'Create task template'}
              </h3>
              <button
                onClick={() => setFormModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => handleSaveTemplate(e, false)} className="text-xs space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">
                    Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Daily Lead Generation"
                    className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">
                    Metric Type <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={formMetricType}
                    onChange={(e) => setFormMetricType(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none"
                  >
                    {METRIC_TYPE_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">
                    Designation <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={formDesignation}
                    onChange={(e) => setFormDesignation(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none"
                  >
                    {designations.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">Frequency</label>
                  <select
                    value={formFrequency}
                    onChange={(e) => setFormFrequency(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none capitalize"
                  >
                    {FREQUENCY_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">
                    Target Count <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={formTargetCount}
                    onChange={(e) => setFormTargetCount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none"
                  />
                </div>

                <div className="flex items-center gap-6 pt-5">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsCarryOver}
                      onChange={(e) => setFormIsCarryOver(e.target.checked)}
                      className="accent-[#09929e] w-4 h-4 cursor-pointer"
                    />
                    <span>Is carry over</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="accent-[#09929e] w-4 h-4 cursor-pointer"
                    />
                    <span>Is active</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Description</label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional description..."
                  className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFormModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
                >
                  Cancel
                </button>
                {!editingItem && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={(e) => handleSaveTemplate(e, true)}
                    className="px-3.5 py-1.5 rounded-lg border border-[#09929e] text-[#09929e] hover:bg-[#09929e]/10 text-xs disabled:opacity-60 cursor-pointer"
                  >
                    {isSaving ? 'Saving…' : 'Create & create another'}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 rounded-lg bg-[#09929e] hover:bg-[#08818c] text-white font-semibold text-xs disabled:opacity-60 cursor-pointer"
                >
                  {isSaving ? 'Saving…' : editingItem ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
