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
} from 'lucide-react';
import {
  fetchResourceList,
  createResourceItem,
  updateResourceItem,
  deleteResourceItem,
  generateTasksNow,
} from '../../services/api';
import TablePagination from '@/components/ui/TablePagination';

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

  // Trigger automated task generation (Bulk to all or specific selected templates)
  const handleGenerateTasks = async (overrideIds?: string[]) => {
    try {
      setIsGenerating(true);
      const targetIds =
        overrideIds && overrideIds.length > 0
          ? overrideIds
          : selectedIds.length > 0
            ? selectedIds
            : undefined;

      const res = await generateTasksNow(targetIds);
      if (res.success) {
        showToast?.('success', res.message || 'Tasks generated successfully!');
        if (targetIds && targetIds.length > 0) {
          setSelectedIds([]);
        }
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
          <div className="flex items-center gap-2 text-xs text-muted mb-1">
            <span>Task Templates</span>
            <span>&gt;</span>
            <span className="text-ink">List</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Task Templates</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Generate Tasks Now (Emerald Green Button) */}
          <button
            onClick={() => handleGenerateTasks()}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
            title={
              selectedIds.length > 0
                ? `Generate tasks for ${selectedIds.length} selected template(s)`
                : "Generate today's tasks for all matching active employees"
            }
          >
            <RotateCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>
              {isGenerating
                ? 'Generating…'
                : selectedIds.length > 0
                  ? `Generate Tasks (${selectedIds.length} Selected)`
                  : 'Generate Tasks Now'}
            </span>
          </button>

          {/* New task template (Cyan Button) */}
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
          >
            <span>New task template</span>
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-xl">
        {/* Search Toolbar matching Screenshot 5 (Right aligned) */}
        <div className="p-4 flex items-center justify-end border-b border-line">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-field border border-line rounded-lg text-[13px] text-ink placeholder-subtle focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        {/* Bulk Selection Notification Bar */}
        {selectedIds.length > 0 && (
          <div className="bg-bulk px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs border-b border-line">
            <span className="text-ink">
              <strong className="text-ink">{selectedIds.length}</strong> template(s) selected
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleGenerateTasks(selectedIds)}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                <span>Generate for Selected ({selectedIds.length})</span>
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="text-ink/80 hover:text-ink underline text-xs"
              >
                Deselect all
              </button>
              <button
                onClick={handleBulkDelete}
                className="text-danger hover:text-danger font-semibold text-xs flex items-center gap-1 cursor-pointer"
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
              <tr className="border-b border-line bg-surface-2 text-ink/80 font-semibold text-[13px]">
                <th className="py-3.5 px-4 w-10">
                  <input
                    type="checkbox"
                    className="accent-accent cursor-pointer rounded"
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
            <tbody className="divide-y divide-line-2 text-[13px]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-accent" />
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
                      className={`transition text-ink ${
                        isSelected ? 'bg-selected' : 'hover:bg-hover/60'
                      }`}
                    >
                      <td
                        className={`py-3.5 px-4 border-l-2 ${
                          isSelected ? 'border-accent' : 'border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="accent-accent cursor-pointer rounded"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(id)}
                        />
                      </td>
                      <td className="py-3.5 px-6 font-normal text-ink">{item.title || '—'}</td>
                      <td className="py-3.5 px-6 text-ink/80">{item.metric_type || 'Leads Generated'}</td>
                      <td className="py-3.5 px-6 text-ink/80">{item.designation || '—'}</td>
                      <td className="py-3.5 px-6 text-ink/80">{item.frequency || 'daily'}</td>
                      <td className="py-3.5 px-6 text-ink">{item.target_count ?? 15}</td>
                      <td className="py-3.5 px-6 text-center">
                        {item.is_carry_over !== false ? (
                          <svg className="w-4 h-4 text-success inline-block" viewBox="0 0 20 20" fill="none">
                            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M6 10l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-subtle inline-block" viewBox="0 0 20 20" fill="none">
                            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-center">
                        {item.is_active !== false ? (
                          <svg className="w-4 h-4 text-success inline-block" viewBox="0 0 20 20" fill="none">
                            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M6 10l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-danger inline-block" viewBox="0 0 20 20" fill="none">
                            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => handleGenerateTasks([id])}
                            disabled={isGenerating}
                            className="inline-flex items-center gap-1 text-[13px] text-emerald-400 hover:text-emerald-300 transition cursor-pointer disabled:opacity-50"
                            title={`Generate today's tasks for "${item.title}"`}
                          >
                            <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Generate</span>
                          </button>
                          <button
                            onClick={() => setViewModalItem(item)}
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
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-subtle">
                    No task templates found. Click &quot;New task template&quot; to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <TablePagination
          total={filteredTemplates.length}
          page={currentPage}
          perPage={perPage}
          onPageChange={setCurrentPage}
          onPerPageChange={setPerPage}
        />
      </div>

      {/* VIEW MODAL */}
      {viewModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl bg-elevated border border-line rounded-2xl shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-ink text-base">View task template</h3>
              <button
                onClick={() => setViewModalItem(null)}
                className="text-muted hover:text-ink p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-muted font-semibold mb-1">Title</label>
                  <div className="px-3 py-2 bg-field border border-line rounded-lg text-ink">
                    {viewModalItem.title || '—'}
                  </div>
                </div>

                <div>
                  <label className="block text-muted font-semibold mb-1">Metric Type</label>
                  <div className="px-3 py-2 bg-field border border-line rounded-lg text-ink">
                    {viewModalItem.metric_type || 'Leads Generated'}
                  </div>
                </div>

                <div>
                  <label className="block text-muted font-semibold mb-1">Designation</label>
                  <div className="px-3 py-2 bg-field border border-line rounded-lg text-ink">
                    {viewModalItem.designation || '—'}
                  </div>
                </div>

                <div>
                  <label className="block text-muted font-semibold mb-1">Frequency</label>
                  <div className="px-3 py-2 bg-field border border-line rounded-lg text-ink capitalize">
                    {viewModalItem.frequency || 'daily'}
                  </div>
                </div>

                <div>
                  <label className="block text-muted font-semibold mb-1">Target Count</label>
                  <div className="px-3 py-2 bg-field border border-line rounded-lg text-success font-bold">
                    {viewModalItem.target_count ?? 15}
                  </div>
                </div>

                <div>
                  <label className="block text-muted font-semibold mb-1">Flags</label>
                  <div className="flex items-center gap-3 pt-1">
                    <span
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium border ${
                        viewModalItem.is_carry_over !== false
                          ? 'bg-success/10 text-success border-success/30'
                          : 'bg-active text-muted border-line'
                      }`}
                    >
                      Carry Over: {viewModalItem.is_carry_over !== false ? 'Yes' : 'No'}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium border ${
                        viewModalItem.is_active !== false
                          ? 'bg-success/10 text-success border-success/30'
                          : 'bg-danger/10 text-danger border-danger/30'
                      }`}
                    >
                      {viewModalItem.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              {viewModalItem.description && (
                <div>
                  <label className="block text-muted font-semibold mb-1">Description</label>
                  <div className="px-3 py-2 bg-field border border-line rounded-lg text-ink/80">
                    {viewModalItem.description}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-start gap-2 pt-5">
              <button
                type="button"
                onClick={() => setViewModalItem(null)}
                className="px-4 py-1.5 rounded-lg border border-line bg-active text-ink hover:bg-active text-xs font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {formModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl bg-elevated border border-line rounded-2xl shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-ink text-base">
                {editingItem ? 'Edit task template' : 'Create task template'}
              </h3>
              <button
                onClick={() => setFormModalOpen(false)}
                className="text-muted hover:text-ink p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => handleSaveTemplate(e, false)} className="text-xs space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-ink/80 font-semibold mb-1.5">
                    Title <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Daily Lead Generation"
                    className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-ink/80 font-semibold mb-1.5">
                    Metric Type <span className="text-danger">*</span>
                  </label>
                  <select
                    value={formMetricType}
                    onChange={(e) => setFormMetricType(e.target.value)}
                    className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none"
                  >
                    {METRIC_TYPE_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-ink/80 font-semibold mb-1.5">
                    Designation <span className="text-danger">*</span>
                  </label>
                  <select
                    value={formDesignation}
                    onChange={(e) => setFormDesignation(e.target.value)}
                    className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none"
                  >
                    {designations.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-ink/80 font-semibold mb-1.5">Frequency</label>
                  <select
                    value={formFrequency}
                    onChange={(e) => setFormFrequency(e.target.value)}
                    className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none capitalize"
                  >
                    {FREQUENCY_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-ink/80 font-semibold mb-1.5">
                    Target Count <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={formTargetCount}
                    onChange={(e) => setFormTargetCount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none"
                  />
                </div>

                <div className="flex items-center gap-6 pt-5">
                  <label className="flex items-center gap-2 text-ink/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsCarryOver}
                      onChange={(e) => setFormIsCarryOver(e.target.checked)}
                      className="accent-accent w-4 h-4 cursor-pointer"
                    />
                    <span>Is carry over</span>
                  </label>

                  <label className="flex items-center gap-2 text-ink/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="accent-accent w-4 h-4 cursor-pointer"
                    />
                    <span>Is active</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-ink/80 font-semibold mb-1.5">Description</label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional description..."
                  className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFormModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-line text-ink/80 hover:bg-active text-xs"
                >
                  Cancel
                </button>
                {!editingItem && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={(e) => handleSaveTemplate(e, true)}
                    className="px-3.5 py-1.5 rounded-lg border border-accent text-accent hover:bg-accent/10 text-xs disabled:opacity-60 cursor-pointer"
                  >
                    {isSaving ? 'Saving…' : 'Create & create another'}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-semibold text-xs disabled:opacity-60 cursor-pointer"
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
