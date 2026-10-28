'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Eye,
  Pencil,
  Trash2,
  Columns3,
  ChevronDown,
  X,
  Plus,
  Loader2,
} from 'lucide-react';
import { Zone } from '@/types';
import { authHeaders } from '../../services/api';
import TablePagination from '@/components/ui/TablePagination';

interface ZonesViewProps {
  showToast?: (type: 'success' | 'danger', message: string) => void;
}

export default function ZonesView({ showToast }: ZonesViewProps) {
  // Data state
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Table controls
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [visibleColumns, setVisibleColumns] = useState({
    name: true,
  });
  const [showColumnDropdown, setShowColumnDropdown] = useState<boolean>(false);
  const [perPage, setPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals state
  const [viewModalZone, setViewModalZone] = useState<Zone | null>(null);
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  // Fetch zones from backend API
  const fetchZonesData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/zones', { headers: authHeaders() });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setZones(json.data);
      }
    } catch (err) {
      console.error('Failed to load zones:', err);
      showToast?.('danger', 'Failed to load zones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchZonesData();
  }, []);

  // Filter & Sort
  const filteredAndSortedZones = useMemo(() => {
    let result = [...zones];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (z) =>
          z.name?.toLowerCase().includes(q) ||
          z.description?.toLowerCase().includes(q)
      );
    }

    if (sortOrder) {
      result.sort((a, b) => {
        const valA = (a.name || '').toLowerCase();
        const valB = (b.name || '').toLowerCase();
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [zones, searchQuery, sortOrder]);

  // Pagination slice
  const paginatedZones = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredAndSortedZones.slice(start, start + perPage);
  }, [filteredAndSortedZones, currentPage, perPage]);

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedZones.length && paginatedZones.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(
        paginatedZones
          .map((z) => z.id || z._id)
          .filter(Boolean) as string[]
      );
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Sort toggle handler
  const handleSort = () => {
    if (sortOrder === null) setSortOrder('asc');
    else if (sortOrder === 'asc') setSortOrder('desc');
    else setSortOrder(null);
  };

  // Open modal for creating new zone
  const openNewModal = () => {
    setEditingZone(null);
    setFormData({
      name: '',
      description: '',
    });
    setEditModalOpen(true);
  };

  // Open modal for editing zone
  const openEditModal = (zone: Zone) => {
    setEditingZone(zone);
    setFormData({
      name: zone.name || '',
      description: zone.description || '',
    });
    setEditModalOpen(true);
  };

  // Save (Create or Update)
  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast?.('danger', 'Zone name is required');
      return;
    }

    try {
      setSaving(true);
      const isEdit = Boolean(editingZone);
      const zoneId = editingZone?.id || editingZone?._id;

      const payload = {
        ...(isEdit && { id: zoneId }),
        name: formData.name.trim(),
        description: formData.description.trim(),
      };

      const res = await fetch('/api/admin/zones', {
        method: isEdit ? 'PUT' : 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        showToast?.('success', `Zone ${isEdit ? 'updated' : 'created'} successfully!`);
        setEditModalOpen(false);
        setEditingZone(null);
        fetchZonesData();
      } else {
        showToast?.('danger', json.message || 'Failed to save zone');
      }
    } catch (err) {
      console.error('Save zone error:', err);
      showToast?.('danger', 'Failed to save zone');
    } finally {
      setSaving(false);
    }
  };

  // Single delete
  const handleDeleteZone = async (zone: Zone) => {
    const zoneId = zone.id || zone._id;
    if (!zoneId) return;

    if (!confirm(`Are you sure you want to delete "${zone.name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/zones?id=${zoneId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const json = await res.json();
      if (json.success) {
        showToast?.('success', 'Zone deleted successfully!');
        setSelectedIds((prev) => prev.filter((id) => id !== zoneId));
        fetchZonesData();
      } else {
        showToast?.('danger', json.message || 'Failed to delete zone');
      }
    } catch (err) {
      console.error('Delete zone error:', err);
      showToast?.('danger', 'Failed to delete zone');
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} zone(s)?`)) return;

    try {
      const res = await fetch('/api/admin/zones', {
        method: 'DELETE',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ids: selectedIds }),
      });
      const json = await res.json();
      if (json.success) {
        showToast?.('success', `${selectedIds.length} zone(s) deleted successfully!`);
        setSelectedIds([]);
        fetchZonesData();
      } else {
        showToast?.('danger', json.message || 'Failed to delete zones');
      }
    } catch (err) {
      console.error('Bulk delete error:', err);
      showToast?.('danger', 'Failed to delete selected zones');
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Header: Breadcrumbs, Title & "New zone" Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted mb-1">
            <span>Zones</span>
            <span className="text-subtle">&gt;</span>
            <span className="text-ink/80">List</span>
          </div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Zones</h1>
        </div>

        <button
          onClick={openNewModal}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg shadow transition cursor-pointer self-start sm:self-auto"
        >
          New zone
        </button>
      </div>

      {/* Main Table Card */}
      <div className="bg-surface border border-line rounded-xl shadow-lg overflow-hidden">
        {/* Top Bar: Search Input & Column Visibility Toggle Button */}
        <div className="p-3.5 flex items-center justify-end gap-2 border-b border-line">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-field border border-line rounded-lg text-xs text-ink placeholder-subtle focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setShowColumnDropdown(!showColumnDropdown)}
              className="p-2 border border-line rounded-lg bg-field text-muted hover:text-ink transition flex items-center justify-center cursor-pointer"
              title="Toggle columns"
            >
              <Columns3 className="w-3.5 h-3.5" />
            </button>

            {showColumnDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-elevated border border-line rounded-xl shadow-2xl p-3 z-30 text-xs">
                <div className="font-semibold text-ink/80 mb-2 pb-1 border-b border-line">
                  Columns
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-ink/80 hover:text-ink cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={visibleColumns.name}
                      onChange={() =>
                        setVisibleColumns((prev) => ({ ...prev, name: !prev.name }))
                      }
                      className="rounded bg-field border-line text-accent focus:ring-0 cursor-pointer"
                    />
                    <span>Name</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bulk Actions Notification Bar */}
        {selectedIds.length > 0 && (
          <div className="px-4 py-2.5 bg-bulk border-b border-line flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in">
            <div className="flex items-center gap-2 text-ink">
              <span className="font-semibold">{selectedIds.length}</span>
              <span className="text-ink/80">
                zone{selectedIds.length > 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedIds([])}
                className="px-2.5 py-1 rounded bg-surface border border-line text-ink/80 hover:text-ink transition cursor-pointer"
              >
                Deselect all
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1 rounded bg-danger/15 hover:bg-danger/20 text-danger border border-danger/30 transition flex items-center gap-1.5 font-medium cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete selected</span>
              </button>
            </div>
          </div>
        )}

        {/* Table Content */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-muted gap-2">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
            <span className="text-xs">Loading zones...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-line text-ink/80 font-semibold text-xs bg-surface">
                  <th className="py-3.5 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.length === paginatedZones.length &&
                        paginatedZones.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="rounded bg-field border-line text-accent focus:ring-0 cursor-pointer"
                    />
                  </th>
                  {visibleColumns.name && (
                    <th
                      onClick={handleSort}
                      className="py-3.5 px-4 cursor-pointer hover:text-ink select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Name</span>
                        {sortOrder && (
                          <ChevronDown
                            className={`w-3 h-3 text-subtle transition-transform ${
                              sortOrder === 'desc' ? 'rotate-180' : ''
                            }`}
                          />
                        )}
                      </div>
                    </th>
                  )}
                  <th className="py-3.5 px-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-2">
                {paginatedZones.length > 0 ? (
                  paginatedZones.map((zone, idx) => {
                    const id = zone.id || zone._id || String(idx);
                    return (
                      <tr key={id} className="hover:bg-hover/60 transition">
                        <td className="py-3.5 px-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(id)}
                            onChange={() => toggleSelectOne(id)}
                            className="rounded bg-field border-line text-accent focus:ring-0 cursor-pointer"
                          />
                        </td>
                        {visibleColumns.name && (
                          <td className="py-3.5 px-4 font-normal text-ink">
                            {zone.name}
                          </td>
                        )}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-3.5 whitespace-nowrap">
                            <button
                              onClick={() => setViewModalZone(zone)}
                              className="inline-flex items-center gap-1.5 text-accent hover:text-ink transition font-medium text-xs hover:underline cursor-pointer"
                              title="View details"
                            >
                              <Eye className="w-3.5 h-3.5 text-accent" />
                              <span>View</span>
                            </button>
                            <button
                              onClick={() => openEditModal(zone)}
                              className="inline-flex items-center gap-1.5 text-accent hover:text-ink transition font-medium text-xs hover:underline cursor-pointer"
                              title="Edit zone"
                            >
                              <Pencil className="w-3.5 h-3.5 text-accent" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteZone(zone)}
                              className="inline-flex items-center gap-1.5 text-danger hover:text-danger transition font-medium text-xs hover:underline cursor-pointer"
                              title="Delete zone"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-danger" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-12 text-center text-subtle text-xs"
                    >
                      No zones found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <TablePagination
          total={filteredAndSortedZones.length}
          page={currentPage}
          perPage={perPage}
          onPageChange={setCurrentPage}
          onPerPageChange={setPerPage}
        />
      </div>

      {/* VIEW MODAL */}
      {viewModalZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 dark:bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-elevated border border-line rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-accent">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">Zone Details</h3>
                  <p className="text-[11px] text-muted">{viewModalZone.name}</p>
                </div>
              </div>
              <button
                onClick={() => setViewModalZone(null)}
                className="text-muted hover:text-ink p-1 rounded-lg hover:bg-active transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="p-3 bg-field rounded-xl border border-line">
                <div className="text-muted text-[11px] mb-1">Zone Name</div>
                <div className="text-ink font-semibold text-sm">
                  {viewModalZone.name}
                </div>
              </div>
              {viewModalZone.description && (
                <div className="p-3 bg-field rounded-xl border border-line">
                  <div className="text-muted text-[11px] mb-1">Description</div>
                  <div className="text-ink">
                    {viewModalZone.description}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3.5 bg-elevated border-t border-line flex items-center justify-end gap-2.5">
              <button
                onClick={() => {
                  const target = viewModalZone;
                  setViewModalZone(null);
                  openEditModal(target);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-medium transition cursor-pointer"
              >
                Edit zone
              </button>
              <button
                onClick={() => setViewModalZone(null)}
                className="px-3.5 py-1.5 rounded-lg bg-active hover:bg-active text-ink/80 text-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 dark:bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-elevated border border-line rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-accent">
                  {editingZone ? (
                    <Pencil className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </div>
                <h3 className="text-sm font-bold text-ink">
                  {editingZone ? 'Edit Zone' : 'New Zone'}
                </h3>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-muted hover:text-ink p-1 rounded-lg hover:bg-active transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveZone} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-ink/80 font-semibold mb-1">
                  Zone Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. South Zone"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full bg-field border border-line rounded-lg px-3 py-2 text-ink outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-ink/80 font-semibold mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. South Kerala regional operations"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full bg-field border border-line rounded-lg px-3 py-2 text-ink outline-none focus:border-accent resize-none"
                />
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-active hover:bg-active text-ink/80 text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold shadow transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingZone ? 'Save changes' : 'Create zone'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
