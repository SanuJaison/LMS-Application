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
import TablePagination from '@/components/ui/TablePagination';

interface Team {
  _id?: string;
  id?: string;
  name: string;
  district?: string;
  zone?: string;
  team_lead?: string;
  description?: string;
  members_count?: number;
  createdAt?: string;
}

interface TeamsViewProps {
  showToast?: (type: 'success' | 'danger', message: string) => void;
}

const DISTRICT_OPTIONS = [
  'Ernakulam',
  'Kozhikode',
  'Wayanad',
  'Thiruvananthapuram',
  'Malappuram',
  'Thrissur',
  'Kannur',
  'Kottayam',
  'Palakkad',
  'Kollam',
  'Alappuzha',
  'Idukki',
  'Pathanamthitta',
  'Kasaragod',
];

const ZONE_OPTIONS = ['Central Zone', 'North Zone', 'South Zone'];

export default function TeamsView({ showToast }: TeamsViewProps) {
  // Data state
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Table controls
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<'district' | 'name' | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [visibleColumns, setVisibleColumns] = useState({
    district: true,
    name: true,
  });
  const [showColumnDropdown, setShowColumnDropdown] = useState<boolean>(false);
  const [perPage, setPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals state
  const [viewModalTeam, setViewModalTeam] = useState<Team | null>(null);
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Form state
  const [formData, setFormData] = useState({
    district: 'Ernakulam',
    name: '',
    zone: 'Central Zone',
    team_lead: '',
  });

  // Fetch teams from backend
  const fetchTeams = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/teams');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setTeams(json.data);
      }
    } catch (err) {
      console.error('Failed to load teams:', err);
      showToast?.('danger', 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  // Filter & Sort
  const filteredAndSortedTeams = useMemo(() => {
    let result = [...teams];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name?.toLowerCase().includes(q) ||
          t.district?.toLowerCase().includes(q) ||
          t.zone?.toLowerCase().includes(q)
      );
    }

    if (sortField) {
      result.sort((a, b) => {
        const valA = String(a[sortField] || '').toLowerCase();
        const valB = String(b[sortField] || '').toLowerCase();
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [teams, searchQuery, sortField, sortOrder]);

  // Pagination slice
  const paginatedTeams = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredAndSortedTeams.slice(start, start + perPage);
  }, [filteredAndSortedTeams, currentPage, perPage]);

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedTeams.length && paginatedTeams.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(
        paginatedTeams
          .map((t) => t.id || t._id)
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
  const handleSort = (field: 'district' | 'name') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Open modal for creating new team
  const openNewModal = () => {
    setEditingTeam(null);
    setFormData({
      district: 'Ernakulam',
      name: '',
      zone: 'Central Zone',
      team_lead: '',
    });
    setEditModalOpen(true);
  };

  // Open modal for editing team
  const openEditModal = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      district: team.district || 'Ernakulam',
      name: team.name || '',
      zone: team.zone || 'Central Zone',
      team_lead: team.team_lead || '',
    });
    setEditModalOpen(true);
  };

  // Save (Create or Update)
  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast?.('danger', 'Team name is required');
      return;
    }

    try {
      setSaving(true);
      const isEdit = Boolean(editingTeam);
      const teamId = editingTeam?.id || editingTeam?._id;

      const payload = {
        ...(isEdit && { id: teamId }),
        name: formData.name.trim(),
        district: formData.district.trim(),
        zone: formData.zone.trim(),
        team_lead: formData.team_lead.trim(),
      };

      const res = await fetch('/api/admin/teams', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        showToast?.('success', `Team ${isEdit ? 'updated' : 'created'} successfully!`);
        setEditModalOpen(false);
        setEditingTeam(null);
        fetchTeams();
      } else {
        showToast?.('danger', json.message || 'Failed to save team');
      }
    } catch (err) {
      console.error('Save team error:', err);
      showToast?.('danger', 'Failed to save team');
    } finally {
      setSaving(false);
    }
  };

  // Single delete
  const handleDeleteTeam = async (team: Team) => {
    const teamId = team.id || team._id;
    if (!teamId) return;

    if (!confirm(`Are you sure you want to delete "${team.name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/teams?id=${teamId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        showToast?.('success', 'Team deleted successfully!');
        setSelectedIds((prev) => prev.filter((id) => id !== teamId));
        fetchTeams();
      } else {
        showToast?.('danger', json.message || 'Failed to delete team');
      }
    } catch (err) {
      console.error('Delete team error:', err);
      showToast?.('danger', 'Failed to delete team');
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} team(s)?`)) return;

    try {
      const res = await fetch('/api/admin/teams', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const json = await res.json();
      if (json.success) {
        showToast?.('success', `${selectedIds.length} team(s) deleted successfully!`);
        setSelectedIds([]);
        fetchTeams();
      } else {
        showToast?.('danger', json.message || 'Failed to delete teams');
      }
    } catch (err) {
      console.error('Bulk delete error:', err);
      showToast?.('danger', 'Failed to delete selected teams');
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Header: Breadcrumbs, Title & "New team" Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted mb-1">
            <span>Teams</span>
            <span className="text-subtle">&gt;</span>
            <span className="text-ink/80">List</span>
          </div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Teams</h1>
        </div>

        <button
          onClick={openNewModal}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg shadow transition cursor-pointer self-start sm:self-auto"
        >
          New team
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
                      checked={visibleColumns.district}
                      onChange={() =>
                        setVisibleColumns((prev) => ({ ...prev, district: !prev.district }))
                      }
                      className="rounded bg-field border-line text-accent focus:ring-0 cursor-pointer"
                    />
                    <span>District</span>
                  </label>
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
                team{selectedIds.length > 1 ? 's' : ''} selected
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
            <span className="text-xs">Loading teams...</span>
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
                        selectedIds.length === paginatedTeams.length &&
                        paginatedTeams.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="rounded bg-field border-line text-accent focus:ring-0 cursor-pointer"
                    />
                  </th>
                  {visibleColumns.district && (
                    <th
                      onClick={() => handleSort('district')}
                      className="py-3.5 px-4 cursor-pointer hover:text-ink select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>District</span>
                        <ChevronDown
                          className={`w-3 h-3 text-subtle transition-transform ${
                            sortField === 'district' && sortOrder === 'desc'
                              ? 'rotate-180'
                              : ''
                          }`}
                        />
                      </div>
                    </th>
                  )}
                  {visibleColumns.name && (
                    <th
                      onClick={() => handleSort('name')}
                      className="py-3.5 px-4 cursor-pointer hover:text-ink select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Name</span>
                        {sortField === 'name' && (
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
                {paginatedTeams.length > 0 ? (
                  paginatedTeams.map((team, idx) => {
                    const id = team.id || team._id || String(idx);
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
                        {visibleColumns.district && (
                          <td className="py-3.5 px-4 text-ink/80">
                            {team.district || 'Ernakulam'}
                          </td>
                        )}
                        {visibleColumns.name && (
                          <td className="py-3.5 px-4 font-normal text-ink">
                            {team.name}
                          </td>
                        )}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-3.5 whitespace-nowrap">
                            <button
                              onClick={() => setViewModalTeam(team)}
                              className="inline-flex items-center gap-1.5 text-accent hover:text-ink transition font-medium text-xs hover:underline cursor-pointer"
                              title="View details"
                            >
                              <Eye className="w-3.5 h-3.5 text-accent" />
                              <span>View</span>
                            </button>
                            <button
                              onClick={() => openEditModal(team)}
                              className="inline-flex items-center gap-1.5 text-accent hover:text-ink transition font-medium text-xs hover:underline cursor-pointer"
                              title="Edit team"
                            >
                              <Pencil className="w-3.5 h-3.5 text-accent" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteTeam(team)}
                              className="inline-flex items-center gap-1.5 text-danger hover:text-danger transition font-medium text-xs hover:underline cursor-pointer"
                              title="Delete team"
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
                      colSpan={4}
                      className="py-12 text-center text-subtle text-xs"
                    >
                      No teams found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <TablePagination
          total={filteredAndSortedTeams.length}
          page={currentPage}
          perPage={perPage}
          onPageChange={setCurrentPage}
          onPerPageChange={setPerPage}
        />
      </div>

      {/* VIEW MODAL */}
      {viewModalTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 dark:bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-elevated border border-line rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-accent">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">Team Details</h3>
                  <p className="text-[11px] text-muted">{viewModalTeam.name}</p>
                </div>
              </div>
              <button
                onClick={() => setViewModalTeam(null)}
                className="text-muted hover:text-ink p-1 rounded-lg hover:bg-active transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-3 bg-field rounded-xl border border-line">
                  <div className="text-muted text-[11px] mb-1">Team Name</div>
                  <div className="text-ink font-semibold text-sm">
                    {viewModalTeam.name}
                  </div>
                </div>
                <div className="p-3 bg-field rounded-xl border border-line">
                  <div className="text-muted text-[11px] mb-1">District</div>
                  <div className="text-ink font-semibold text-sm">
                    {viewModalTeam.district || 'Ernakulam'}
                  </div>
                </div>
                <div className="p-3 bg-field rounded-xl border border-line">
                  <div className="text-muted text-[11px] mb-1">Zone</div>
                  <div className="text-ink">
                    {viewModalTeam.zone || 'Central Zone'}
                  </div>
                </div>
                <div className="p-3 bg-field rounded-xl border border-line">
                  <div className="text-muted text-[11px] mb-1">Team Lead</div>
                  <div className="text-ink">
                    {viewModalTeam.team_lead || 'Not assigned'}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-elevated border-t border-line flex items-center justify-end gap-2.5">
              <button
                onClick={() => {
                  const target = viewModalTeam;
                  setViewModalTeam(null);
                  openEditModal(target);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-medium transition cursor-pointer"
              >
                Edit team
              </button>
              <button
                onClick={() => setViewModalTeam(null)}
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
                  {editingTeam ? (
                    <Pencil className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </div>
                <h3 className="text-sm font-bold text-ink">
                  {editingTeam ? 'Edit Team' : 'New Team'}
                </h3>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-muted hover:text-ink p-1 rounded-lg hover:bg-active transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTeam} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-ink/80 font-semibold mb-1">
                  District <span className="text-danger">*</span>
                </label>
                <select
                  value={formData.district}
                  onChange={(e) =>
                    setFormData({ ...formData, district: e.target.value })
                  }
                  required
                  className="w-full bg-field border border-line rounded-lg px-3 py-2 text-ink outline-none focus:border-accent"
                >
                  {DISTRICT_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-ink/80 font-semibold mb-1">
                  Team Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Team Kakkanad"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full bg-field border border-line rounded-lg px-3 py-2 text-ink outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-ink/80 font-semibold mb-1">
                  Zone
                </label>
                <select
                  value={formData.zone}
                  onChange={(e) =>
                    setFormData({ ...formData, zone: e.target.value })
                  }
                  className="w-full bg-field border border-line rounded-lg px-3 py-2 text-ink outline-none focus:border-accent"
                >
                  {ZONE_OPTIONS.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-ink/80 font-semibold mb-1">
                  Team Lead
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Nair"
                  value={formData.team_lead}
                  onChange={(e) =>
                    setFormData({ ...formData, team_lead: e.target.value })
                  }
                  className="w-full bg-field border border-line rounded-lg px-3 py-2 text-ink outline-none focus:border-accent"
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
                  <span>{editingTeam ? 'Save changes' : 'Create team'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
