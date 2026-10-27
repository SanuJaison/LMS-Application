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
} from 'lucide-react';
import {
  fetchResourceList,
  createResourceItem,
  updateResourceItem,
  deleteResourceItem,
} from '../../services/api';
import TablePagination from '@/components/ui/TablePagination';

interface DesignationItem {
  _id?: string;
  id?: string;
  name: string;
  prefix?: string;
  createdAt?: string;
}

interface DesignationsViewProps {
  showToast?: (type: 'success' | 'danger', message: string) => void;
}

export default function DesignationsView({ showToast }: DesignationsViewProps) {
  // Data state
  const [designations, setDesignations] = useState<DesignationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Table controls
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [perPage, setPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Modals state
  const [viewModalItem, setViewModalItem] = useState<DesignationItem | null>(null);
  const [formModalOpen, setFormModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<DesignationItem | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form Fields
  const [formName, setFormName] = useState<string>('');
  const [formPrefix, setFormPrefix] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchResourceList('designations');
      setDesignations(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to load designations:', err);
      showToast?.('danger', 'Failed to load designations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const rowId = (item: DesignationItem) => (item._id || item.id || '').toString();

  // Filtered designations
  const filteredDesignations = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return designations;
    return designations.filter(
      (d) =>
        d.name?.toLowerCase().includes(q) ||
        d.prefix?.toLowerCase().includes(q)
    );
  }, [designations, searchQuery]);

  // Pagination
  const paginatedDesignations = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredDesignations.slice(start, start + perPage);
  }, [filteredDesignations, currentPage, perPage]);

  // Selection handlers
  const allVisibleSelected =
    paginatedDesignations.length > 0 &&
    paginatedDesignations.every((item) => selectedIds.includes(rowId(item)));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleIds = paginatedDesignations.map(rowId);
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      const visibleIds = paginatedDesignations.map(rowId);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Open Create Modal
  const openCreateModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormPrefix('');
    setFormModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (item: DesignationItem) => {
    setEditingItem(item);
    setFormName(item.name || '');
    setFormPrefix(item.prefix || '');
    setFormModalOpen(true);
  };

  // Save (Create / Update)
  const handleSaveDesignation = async (e: React.FormEvent, keepOpen = false) => {
    e.preventDefault();
    if (!formName.trim() || !formPrefix.trim()) {
      showToast?.('danger', 'Name and Prefix are required.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        prefix: formPrefix.trim(),
      };

      if (editingItem) {
        await updateResourceItem('designations', {
          ...payload,
          id: rowId(editingItem),
          _id: rowId(editingItem),
        });
        showToast?.('success', 'Designation updated successfully!');
        setFormModalOpen(false);
        setEditingItem(null);
      } else {
        await createResourceItem('designations', payload);
        showToast?.('success', 'Designation created successfully!');
        if (keepOpen) {
          setFormName('');
          setFormPrefix('');
        } else {
          setFormModalOpen(false);
        }
      }
      await loadData();
    } catch (err) {
      console.error('Error saving designation:', err);
      showToast?.('danger', 'Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete single
  const handleDeleteDesignation = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this designation?')) return;
    setIsDeleting(id);
    try {
      await deleteResourceItem('designations', id);
      showToast?.('success', 'Designation deleted successfully!');
      setSelectedIds((prev) => prev.filter((i) => i !== id));
      await loadData();
    } catch {
      showToast?.('danger', 'Failed to delete designation.');
    } finally {
      setIsDeleting(null);
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected designations?`)) return;
    try {
      await deleteResourceItem('designations', selectedIds);
      showToast?.('success', `${selectedIds.length} designations deleted successfully!`);
      setSelectedIds([]);
      await loadData();
    } catch {
      showToast?.('danger', 'Failed to delete selected designations.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted mb-1">
            <span>Designations</span>
            <span>&gt;</span>
            <span className="text-ink">List</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Designations</h1>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New designation</span>
        </button>
      </div>

      {/* Main Table Container */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-xl">
        {/* Search & Bulk Actions Toolbar */}
        <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-line">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search designations..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-field border border-line rounded-lg text-xs text-ink placeholder-subtle focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="text-xs text-muted flex items-center gap-2">
            <span>
              Total: <strong className="text-ink">{filteredDesignations.length}</strong>
            </span>
          </div>
        </div>

        {/* Bulk Selection Notification Bar */}
        {selectedIds.length > 0 && (
          <div className="bg-bulk px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs border-b border-line">
            <span className="text-ink">
              <strong className="text-ink">{selectedIds.length}</strong> designation(s) selected
            </span>
            <div className="flex items-center gap-3">
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

        {/* Designations Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-muted font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    className="accent-accent cursor-pointer"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    title="Select all"
                  />
                </th>
                <th className="py-3 px-5">Name</th>
                <th className="py-3 px-5">Prefix</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-2">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-accent" />
                      <span>Loading designations...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedDesignations.length > 0 ? (
                paginatedDesignations.map((item, idx) => {
                  const id = rowId(item) || String(idx);
                  const isSelected = selectedIds.includes(id);

                  return (
                    <tr
                      key={id}
                      className={`transition ${
                        isSelected ? 'bg-selected' : 'hover:bg-hover/60'
                      }`}
                    >
                      <td
                        className={`py-3 px-4 border-l-2 ${
                          isSelected ? 'border-accent' : 'border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="accent-accent cursor-pointer"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(id)}
                        />
                      </td>
                      <td className="py-3 px-5 font-medium text-ink">{item.name || '—'}</td>
                      <td className="py-3 px-5 text-ink/80">{item.prefix || '—'}</td>
                      <td className="py-3 px-5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => setViewModalItem(item)}
                            className="inline-flex items-center gap-1 text-xs text-muted hover:text-accent transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                          <button
                            onClick={() => openEditModal(item)}
                            className="inline-flex items-center gap-1 text-xs text-accent hover:underline transition cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteDesignation(id)}
                            disabled={isDeleting === id}
                            className="inline-flex items-center gap-1 text-xs text-danger hover:text-danger hover:underline transition disabled:opacity-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{isDeleting === id ? 'Deleting…' : 'Delete'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-subtle">
                    No designations found. Click &quot;New designation&quot; to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <TablePagination
          total={filteredDesignations.length}
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
              <h3 className="font-bold text-ink text-base">View designation</h3>
              <button
                onClick={() => setViewModalItem(null)}
                className="text-muted hover:text-ink p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-ink/80 font-semibold mb-1.5">Name</label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={viewModalItem.name || '—'}
                    className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink/80 text-xs cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-ink/80 font-semibold mb-1.5">Prefix</label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={viewModalItem.prefix || '—'}
                    className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink/80 text-xs cursor-not-allowed"
                  />
                </div>
              </div>
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
                {editingItem ? 'Edit designation' : 'Create designation'}
              </h3>
              <button
                onClick={() => setFormModalOpen(false)}
                className="text-muted hover:text-ink p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => handleSaveDesignation(e, false)} className="text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="block text-ink/80 font-semibold mb-1.5">
                    Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Sales Manager"
                    className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-ink/80 font-semibold mb-1.5">
                    Prefix <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formPrefix}
                    onChange={(e) => setFormPrefix(e.target.value)}
                    placeholder="e.g. SM"
                    className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
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
                    onClick={(e) => handleSaveDesignation(e, true)}
                    className="px-3.5 py-1.5 rounded-lg border border-accent text-accent hover:bg-accent/10 text-xs disabled:opacity-60"
                  >
                    {isSaving ? 'Saving…' : 'Create & create another'}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-semibold text-xs disabled:opacity-60"
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
