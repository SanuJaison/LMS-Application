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
      const res = await fetch('/api/admin/zones');
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
    <div className="w-full space-y-4">
      {/* Top Header: Breadcrumbs, Title & "New zone" Button */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <span>Zones</span>
            <span className="text-slate-600">&gt;</span>
            <span className="text-slate-300">List</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Zones</h1>
        </div>

        <button
          onClick={openNewModal}
          className="px-4 py-2 bg-[#00a2b8] hover:bg-[#0891b2] text-white text-xs font-semibold rounded-lg shadow transition cursor-pointer"
        >
          New zone
        </button>
      </div>

      {/* Main Table Card */}
      <div className="bg-[#0b1322] border border-[#1b253b] rounded-xl shadow-lg overflow-hidden">
        {/* Top Bar: Search Input & Column Visibility Toggle Button */}
        <div className="p-3.5 flex items-center justify-end gap-2 border-b border-[#1b253b]">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-[#080d18] border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#00a2b8]"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setShowColumnDropdown(!showColumnDropdown)}
              className="p-2 border border-slate-700/80 rounded-lg bg-[#080d18] text-slate-400 hover:text-white transition flex items-center justify-center cursor-pointer"
              title="Toggle columns"
            >
              <Columns3 className="w-3.5 h-3.5" />
            </button>

            {showColumnDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-[#0d1627] border border-[#223352] rounded-xl shadow-2xl p-3 z-30 text-xs">
                <div className="font-semibold text-slate-300 mb-2 pb-1 border-b border-slate-800">
                  Columns
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={visibleColumns.name}
                      onChange={() =>
                        setVisibleColumns((prev) => ({ ...prev, name: !prev.name }))
                      }
                      className="rounded bg-[#080d18] border-slate-700 text-[#00a2b8] focus:ring-0 cursor-pointer"
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
          <div className="px-4 py-2.5 bg-[#132038] border-b border-[#203254] flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center gap-2 text-white">
              <span className="font-semibold">{selectedIds.length}</span>
              <span className="text-slate-300">
                zone{selectedIds.length > 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedIds([])}
                className="px-2.5 py-1 rounded bg-[#0b1322] border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              >
                Deselect all
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1 rounded bg-red-900/60 hover:bg-red-800 text-red-200 border border-red-700/60 transition flex items-center gap-1.5 font-medium cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete selected</span>
              </button>
            </div>
          </div>
        )}

        {/* Table Content */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 text-[#00a2b8] animate-spin" />
            <span className="text-xs">Loading zones...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1b253b] text-slate-300 font-semibold text-xs bg-[#0b1322]">
                  <th className="py-3.5 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.length === paginatedZones.length &&
                        paginatedZones.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="rounded bg-[#080d18] border-slate-700 text-[#00a2b8] focus:ring-0 cursor-pointer"
                    />
                  </th>
                  {visibleColumns.name && (
                    <th
                      onClick={handleSort}
                      className="py-3.5 px-4 cursor-pointer hover:text-white select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Name</span>
                        {sortOrder && (
                          <ChevronDown
                            className={`w-3 h-3 text-slate-500 transition-transform ${
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
              <tbody className="divide-y divide-[#172236]">
                {paginatedZones.length > 0 ? (
                  paginatedZones.map((zone, idx) => {
                    const id = zone.id || zone._id || String(idx);
                    return (
                      <tr key={id} className="hover:bg-[#131d2e]/60 transition">
                        <td className="py-3.5 px-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(id)}
                            onChange={() => toggleSelectOne(id)}
                            className="rounded bg-[#080d18] border-slate-700 text-[#00a2b8] focus:ring-0 cursor-pointer"
                          />
                        </td>
                        {visibleColumns.name && (
                          <td className="py-3.5 px-4 font-normal text-slate-200">
                            {zone.name}
                          </td>
                        )}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-3.5 whitespace-nowrap">
                            <button
                              onClick={() => setViewModalZone(zone)}
                              className="inline-flex items-center gap-1.5 text-[#38bdf8] hover:text-white transition font-medium text-xs hover:underline cursor-pointer"
                              title="View details"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#38bdf8]" />
                              <span>View</span>
                            </button>
                            <button
                              onClick={() => openEditModal(zone)}
                              className="inline-flex items-center gap-1.5 text-[#38bdf8] hover:text-white transition font-medium text-xs hover:underline cursor-pointer"
                              title="Edit zone"
                            >
                              <Pencil className="w-3.5 h-3.5 text-[#38bdf8]" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteZone(zone)}
                              className="inline-flex items-center gap-1.5 text-[#f43f5e] hover:text-red-400 transition font-medium text-xs hover:underline cursor-pointer"
                              title="Delete zone"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-[#f43f5e]" />
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
                      className="py-12 text-center text-slate-500 text-xs"
                    >
                      No zones found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Footer: Result Count & Per Page */}
        <div className="px-4 py-3 bg-[#0a101d] border-t border-[#1b253b] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            Showing{' '}
            <span className="font-semibold text-white">
              {filteredAndSortedZones.length === 0
                ? 0
                : (currentPage - 1) * perPage + 1}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-white">
              {Math.min(currentPage * perPage, filteredAndSortedZones.length)}
            </span>{' '}
            of{' '}
            <span className="font-semibold text-white">
              {filteredAndSortedZones.length}
            </span>{' '}
            results
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span>Per page</span>
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-[#080d18] border border-slate-700/80 rounded px-2.5 py-1 text-white text-xs outline-none focus:border-[#00a2b8]"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            {Math.ceil(filteredAndSortedZones.length / perPage) > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 rounded border border-slate-700 bg-[#080d18] text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((p) =>
                      Math.min(
                        Math.ceil(filteredAndSortedZones.length / perPage),
                        p + 1
                      )
                    )
                  }
                  disabled={
                    currentPage >=
                    Math.ceil(filteredAndSortedZones.length / perPage)
                  }
                  className="px-2.5 py-1 rounded border border-slate-700 bg-[#080d18] text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* VIEW MODAL */}
      {viewModalZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0f172a] border border-[#223352] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-[#223352] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#00a2b8]/20 flex items-center justify-center text-[#00a2b8]">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Zone Details</h3>
                  <p className="text-[11px] text-slate-400">{viewModalZone.name}</p>
                </div>
              </div>
              <button
                onClick={() => setViewModalZone(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="p-3 bg-[#080d18] rounded-xl border border-slate-800">
                <div className="text-slate-400 text-[11px] mb-1">Zone Name</div>
                <div className="text-white font-semibold text-sm">
                  {viewModalZone.name}
                </div>
              </div>
              {viewModalZone.description && (
                <div className="p-3 bg-[#080d18] rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[11px] mb-1">Description</div>
                  <div className="text-slate-200">
                    {viewModalZone.description}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3.5 bg-[#090d16] border-t border-[#223352] flex items-center justify-end gap-2.5">
              <button
                onClick={() => {
                  const target = viewModalZone;
                  setViewModalZone(null);
                  openEditModal(target);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-[#00a2b8] hover:bg-[#0891b2] text-white text-xs font-medium transition cursor-pointer"
              >
                Edit zone
              </button>
              <button
                onClick={() => setViewModalZone(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0f172a] border border-[#223352] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-[#223352] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#00a2b8]/20 flex items-center justify-center text-[#00a2b8]">
                  {editingZone ? (
                    <Pencil className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </div>
                <h3 className="text-sm font-bold text-white">
                  {editingZone ? 'Edit Zone' : 'New Zone'}
                </h3>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveZone} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Zone Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. South Zone"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full bg-[#080d18] border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-[#00a2b8]"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. South Kerala regional operations"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full bg-[#080d18] border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-[#00a2b8] resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-[#00a2b8] hover:bg-[#0891b2] text-white text-xs font-semibold shadow transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
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
