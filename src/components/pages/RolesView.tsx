'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Check,
  ShieldCheck,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import {
  fetchResourceList,
  createResourceItem,
  updateResourceItem,
  deleteResourceItem,
} from '../../services/api';
import TablePagination from '@/components/ui/TablePagination';

// 12 standard Filament Shield permissions in 4 columns
const PERMISSION_COLUMNS = [
  ['View', 'Restore', 'Delete'],
  ['View Any', 'Restore Any', 'Delete Any'],
  ['Create', 'Replicate', 'Force Delete'],
  ['Update', 'Reorder', 'Force Delete Any'],
];

const ALL_RESOURCE_PERMISSIONS = PERMISSION_COLUMNS.flat();

// CRM Models matching reference screenshots
const RESOURCES = [
  { id: 'activity', name: 'Activity', namespace: 'Spatie\\Activitylog\\Models\\Activity' },
  { id: 'employee_attendance', name: 'Employee Attendance', namespace: 'App\\Models\\Employee' },
  { id: 'attendance_report', name: 'Attendance Report', namespace: 'App\\Models\\AttendanceReport' },
  { id: 'beat_plan', name: 'Beat Plan', namespace: 'App\\Models\\BeatPlan' },
  { id: 'course', name: 'Course', namespace: 'App\\Models\\Course' },
  { id: 'customer', name: 'Customer', namespace: 'App\\Models\\Customer' },
  { id: 'customer_visit', name: 'Customer Visit', namespace: 'App\\Models\\CustomerVisit' },
  { id: 'daily_report', name: 'Daily Report', namespace: 'App\\Models\\DailyReport' },
  { id: 'designation', name: 'Designation', namespace: 'App\\Models\\Designation' },
  { id: 'district', name: 'District', namespace: 'App\\Models\\District' },
  { id: 'employee', name: 'Employee', namespace: 'App\\Models\\Employee' },
  { id: 'employee_task', name: 'Employee Task', namespace: 'App\\Models\\EmployeeTask' },
  { id: 'lead', name: 'Lead', namespace: 'App\\Models\\Lead' },
  { id: 'leave', name: 'Leave', namespace: 'App\\Models\\Leave' },
  { id: 'role', name: 'Role', namespace: 'Spatie\\Permission\\Models\\Role' },
  { id: 'task_template', name: 'Task Template', namespace: 'App\\Models\\TaskTemplate' },
  { id: 'team', name: 'Team', namespace: 'App\\Models\\Team' },
  { id: 'user', name: 'User', namespace: 'App\\Models\\User' },
  { id: 'wallet', name: 'Wallet', namespace: 'App\\Models\\Wallet' },
  { id: 'wallet_withdraw_request', name: 'Wallet Withdraw Request', namespace: 'App\\Models\\WalletWithdrawRequest' },
  { id: 'zone', name: 'Zone', namespace: 'App\\Models\\Zone' },
];

const WIDGETS = [
  { id: 'account_widget', name: 'Account Widget', namespace: 'Filament\\Widgets\\AccountWidget' },
  { id: 'filament_info_widget', name: 'Filament Info Widget', namespace: 'Filament\\Widgets\\FilamentInfoWidget' },
  { id: 'lead_trend_widget', name: 'Lead Generation Trend', namespace: 'App\\Filament\\Widgets\\LeadTrendWidget' },
  { id: 'attendance_widget', name: 'Live Attendance Overview', namespace: 'App\\Filament\\Widgets\\AttendanceWidget' },
  { id: 'employee_stats_widget', name: 'Employee Stats Chart', namespace: 'App\\Filament\\Widgets\\EmployeeStatsWidget' },
  { id: 'recent_activities_widget', name: 'Recent Activities', namespace: 'App\\Filament\\Widgets\\RecentActivitiesWidget' },
];

export interface RoleRecord {
  _id?: string;
  id?: string;
  name: string;
  guard_name: string;
  description?: string;
  permissions?: string[];
  permissions_count?: number;
  users_count?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface RolesViewProps {
  showToast?: (type: 'success' | 'danger', message: string) => void;
  onRolesUpdated?: (count: number) => void;
}

export default function RolesView({ showToast, onRolesUpdated }: RolesViewProps) {
  // Navigation mode: 'list' | 'create' | 'edit'
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [activeSubTab, setActiveSubTab] = useState<'resources' | 'widgets'>('resources');

  // Database roles state
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);

  // Table selection & pagination
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [perPage, setPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Form inputs
  const [formName, setFormName] = useState<string>('');
  const [formGuard, setFormGuard] = useState<string>('web');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Load roles directly from MongoDB Atlas
  const loadRoles = async () => {
    try {
      setLoading(true);
      const res = await fetchResourceList('roles');
      const list = Array.isArray(res) ? res : [];
      setRoles(list);
      onRolesUpdated?.(list.length);
    } catch (err: any) {
      console.error('Failed to load roles from MongoDB:', err);
      showToast?.('danger', 'Failed to load roles from database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const rowId = (role: RoleRecord) => (role._id || role.id || '').toString();

  // Filtered roles list
  const filteredRoles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return roles;
    return roles.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.guard_name?.toLowerCase().includes(q)
    );
  }, [roles, searchQuery]);

  // Pagination calculations
  const paginatedRoles = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredRoles.slice(start, start + perPage);
  }, [filteredRoles, currentPage, perPage]);

  // Form permission key helper
  const permKey = (targetId: string, action: string) => `${targetId}::${action}`;

  // Open Create Form
  const openCreateForm = () => {
    setEditingRole(null);
    setFormName('');
    setFormGuard('web');
    setSelectedPermissions(new Set());
    setCollapsedCards({});
    setMode('create');
  };

  // Open Edit Form
  const openEditForm = (role: RoleRecord) => {
    setEditingRole(role);
    setFormName(role.name || '');
    setFormGuard(role.guard_name || 'web');
    const existing = new Set<string>();
    if (role.permissions && Array.isArray(role.permissions)) {
      if (role.permissions.includes('*')) {
        // All permissions granted
        RESOURCES.forEach((r) => {
          ALL_RESOURCE_PERMISSIONS.forEach((p) => existing.add(permKey(r.id, p)));
        });
        WIDGETS.forEach((w) => existing.add(permKey(w.id, 'View')));
      } else {
        role.permissions.forEach((p) => existing.add(p));
      }
    }
    setSelectedPermissions(existing);
    setCollapsedCards({});
    setMode('edit');
  };

  // Toggle single permission checkbox
  const togglePermission = (key: string) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Toggle all permissions for a specific resource
  const toggleResourceAll = (resourceId: string) => {
    const keys = ALL_RESOURCE_PERMISSIONS.map((p) => permKey(resourceId, p));
    const allChecked = keys.every((k) => selectedPermissions.has(k));

    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        keys.forEach((k) => next.delete(k));
      } else {
        keys.forEach((k) => next.add(k));
      }
      return next;
    });
  };

  // Master "Select All" toggle across all resources & widgets
  const totalPossiblePermissions = RESOURCES.length * 12 + WIDGETS.length;
  const isMasterSelectAll = selectedPermissions.size >= totalPossiblePermissions;

  const toggleMasterSelectAll = () => {
    if (isMasterSelectAll) {
      setSelectedPermissions(new Set());
    } else {
      const next = new Set<string>();
      RESOURCES.forEach((r) => {
        ALL_RESOURCE_PERMISSIONS.forEach((p) => next.add(permKey(r.id, p)));
      });
      WIDGETS.forEach((w) => next.add(permKey(w.id, 'View')));
      setSelectedPermissions(next);
    }
  };

  // Toggle card accordion collapse
  const toggleCollapse = (id: string) => {
    setCollapsedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Save Role to MongoDB Atlas
  const handleSave = async (createAnother = false) => {
    if (!formName.trim()) {
      showToast?.('danger', 'Role name is required');
      return;
    }

    try {
      setIsSaving(true);
      const permArray = Array.from(selectedPermissions);
      const payload: any = {
        name: formName.trim(),
        guard_name: formGuard.trim() || 'web',
        permissions: permArray,
        permissions_count: permArray.length,
        users_count: editingRole?.users_count ?? 0,
      };

      if (mode === 'edit' && editingRole) {
        payload.id = rowId(editingRole);
        await updateResourceItem('roles', payload);
        showToast?.('success', `Role "${payload.name}" updated successfully`);
      } else {
        await createResourceItem('roles', payload);
        showToast?.('success', `Role "${payload.name}" created successfully`);
      }

      await loadRoles();

      if (createAnother) {
        setFormName('');
        setSelectedPermissions(new Set());
        setMode('create');
      } else {
        setMode('list');
      }
    } catch (err: any) {
      console.error('Failed to save role:', err);
      showToast?.('danger', err.message || 'Failed to save role');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Role from MongoDB Atlas
  const handleDeleteRole = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete role "${name}"?`)) return;
    try {
      setIsDeleting(id);
      await deleteResourceItem('roles', id);
      showToast?.('success', `Role "${name}" deleted successfully`);
      await loadRoles();
    } catch (err: any) {
      console.error('Failed to delete role:', err);
      showToast?.('danger', err.message || 'Failed to delete role');
    } finally {
      setIsDeleting(null);
    }
  };

  // ==========================================
  // VIEW: CREATE / EDIT ROLE FORM
  // ==========================================
  if (mode === 'create' || mode === 'edit') {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-muted">
          <button
            onClick={() => setMode('list')}
            className="hover:text-accent transition flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Roles
          </button>
          <span>&gt;</span>
          <span className="text-ink capitalize">
            {mode === 'create' ? 'Create' : 'Edit'}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-ink tracking-tight">
          {mode === 'create' ? 'Create Role' : 'Edit Role'}
        </h1>

        {/* Main Configuration Card */}
        <div className="bg-surface border border-line rounded-xl p-5 md:p-6 shadow-xl space-y-6">
          {/* Top Row Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Name Input */}
            <div>
              <label className="block text-xs font-medium text-ink/80 mb-1.5">
                Name<span className="text-danger ml-0.5">*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Manager"
                className="w-full px-3.5 py-2 rounded-lg bg-app border border-line text-ink text-sm focus:outline-none focus:border-accent transition"
              />
            </div>

            {/* Guard Name Input */}
            <div>
              <label className="block text-xs font-medium text-ink/80 mb-1.5">
                Guard Name
              </label>
              <input
                type="text"
                value={formGuard}
                onChange={(e) => setFormGuard(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-app border border-line text-ink text-sm focus:outline-none focus:border-accent transition"
              />
            </div>

            {/* Select All Toggle Switch */}
            <div className="flex items-center justify-between md:justify-end gap-4 pt-2 md:pt-4">
              <div className="text-right">
                <span className="text-xs font-semibold text-ink block">Select All</span>
                <span className="text-[11px] text-muted block">
                  Enables/Disables all Permissions for this role
                </span>
              </div>
              <button
                type="button"
                onClick={toggleMasterSelectAll}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isMasterSelectAll ? 'bg-accent' : 'bg-active'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isMasterSelectAll ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Resources / Widgets Tab Pill Selector */}
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <button
              onClick={() => setActiveSubTab('resources')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeSubTab === 'resources'
                  ? 'bg-bulk text-accent border border-accent/30 shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <span>Resources</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-accent text-white">
                246
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab('widgets')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeSubTab === 'widgets'
                  ? 'bg-bulk text-accent border border-accent/30 shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <span>Widgets</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-active text-ink/80">
                6
              </span>
            </button>
          </div>

          {/* SUBTAB 1: RESOURCES ACCORDION CARDS */}
          {activeSubTab === 'resources' && (
            <div className="space-y-4">
              {RESOURCES.map((resource) => {
                const isCollapsed = collapsedCards[resource.id] ?? false;
                const resourcePermKeys = ALL_RESOURCE_PERMISSIONS.map((p) =>
                  permKey(resource.id, p)
                );
                const isAllResourceChecked = resourcePermKeys.every((k) =>
                  selectedPermissions.has(k)
                );

                return (
                  <div
                    key={resource.id}
                    className="bg-app border border-line rounded-xl p-4 transition-all shadow-sm"
                  >
                    {/* Card Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-ink tracking-wide">
                          {resource.name}
                        </h3>
                        <p className="text-[11px] text-muted font-mono mt-0.5">
                          {resource.namespace}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleCollapse(resource.id)}
                        className="text-muted hover:text-ink p-1 rounded transition cursor-pointer"
                      >
                        {isCollapsed ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronUp className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Card Content (Permissions Grid) */}
                    {!isCollapsed && (
                      <div className="mt-4 pt-3 border-t border-line space-y-3">
                        {/* Select All Link for this resource */}
                        <div>
                          <button
                            type="button"
                            onClick={() => toggleResourceAll(resource.id)}
                            className="text-xs font-medium text-accent hover:text-accent transition cursor-pointer"
                          >
                            {isAllResourceChecked ? 'Deselect all' : 'Select all'}
                          </button>
                        </div>

                        {/* 12-Checkbox Grid in 4 Columns */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {PERMISSION_COLUMNS.map((colGroup, colIdx) => (
                            <div key={colIdx} className="space-y-2.5">
                              {colGroup.map((perm) => {
                                const key = permKey(resource.id, perm);
                                const checked = selectedPermissions.has(key);

                                return (
                                  <label
                                    key={perm}
                                    onClick={() => togglePermission(key)}
                                    className="flex items-center gap-2.5 text-xs text-ink/80 hover:text-ink cursor-pointer select-none"
                                  >
                                    <div
                                      className={`w-4 h-4 rounded flex items-center justify-center transition border ${
                                        checked
                                          ? 'bg-accent border-accent text-white shadow-sm'
                                          : 'bg-app border-line text-transparent hover:border-accent'
                                      }`}
                                    >
                                      <Check className="w-3 h-3 stroke-[3]" />
                                    </div>
                                    <span>{perm}</span>
                                  </label>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* SUBTAB 2: WIDGETS CARDS */}
          {activeSubTab === 'widgets' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {WIDGETS.map((widget) => {
                const key = permKey(widget.id, 'View');
                const checked = selectedPermissions.has(key);

                return (
                  <div
                    key={widget.id}
                    className="bg-app border border-line rounded-xl p-4 flex items-center justify-between shadow-sm"
                  >
                    <div>
                      <h3 className="text-sm font-semibold text-ink">{widget.name}</h3>
                      <p className="text-[11px] text-muted font-mono mt-0.5">
                        {widget.namespace}
                      </p>
                    </div>

                    <label
                      onClick={() => togglePermission(key)}
                      className="flex items-center gap-2 text-xs text-ink/80 hover:text-ink cursor-pointer select-none"
                    >
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center transition border ${
                          checked
                            ? 'bg-accent border-accent text-white'
                            : 'bg-app border-line text-transparent'
                        }`}
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                      <span>View</span>
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSave(false)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold shadow-lg transition cursor-pointer disabled:opacity-50"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{mode === 'edit' ? 'Save changes' : 'Create'}</span>
          </button>

          {mode === 'create' && (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSave(true)}
              className="px-4 py-2.5 rounded-lg bg-hover hover:bg-line border border-line text-ink text-xs font-medium transition cursor-pointer disabled:opacity-50"
            >
              Create & create another
            </button>
          )}

          <button
            type="button"
            disabled={isSaving}
            onClick={() => setMode('list')}
            className="px-4 py-2.5 rounded-lg bg-elevated hover:bg-line border border-line text-muted hover:text-ink text-xs font-medium transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: ROLES LIST TABLE
  // ==========================================
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* Header & New Role Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-muted mb-1">Roles</div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Roles</h1>
        </div>

        <button
          onClick={openCreateForm}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold shadow-md transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New role</span>
        </button>
      </div>

      {/* Main Table Card */}
      <div className="bg-surface border border-line rounded-xl shadow-xl overflow-hidden">
        {/* Search Bar & Controls */}
        <div className="p-4 border-b border-line flex items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search roles..."
              className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-app border border-line text-ink text-xs placeholder:text-subtle focus:outline-none focus:border-accent transition"
            />
          </div>
        </div>

        {/* Roles Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-ink/80">
            <thead className="bg-app border-b border-line text-muted uppercase tracking-wider text-[11px] font-semibold">
              <tr>
                <th className="py-3 px-4 w-10 text-center">
                  <ShieldCheck className="w-4 h-4 text-accent mx-auto" />
                </th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Guard name</th>
                <th className="py-3 px-4">Permissions count</th>
                <th className="py-3 px-4">Created at</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-accent mb-2" />
                    <span>Loading roles from database...</span>
                  </td>
                </tr>
              ) : paginatedRoles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted">
                    No roles found. Click &quot;New role&quot; to create one.
                  </td>
                </tr>
              ) : (
                paginatedRoles.map((role) => {
                  const id = rowId(role);
                  const isCurrentDeleting = isDeleting === id;
                  const dateStr = role.createdAt
                    ? new Date(role.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Oct 19, 2026';

                  return (
                    <tr
                      key={id}
                      className="hover:bg-elevated/60 transition-colors group"
                    >
                      <td className="py-3.5 px-4 text-center">
                        <span className="w-2 h-2 rounded-full bg-accent inline-block" />
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-ink">
                        {role.name}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-muted">
                        {role.guard_name || 'web'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-bulk text-accent border border-accent/30">
                          {role.permissions_count ?? (role.permissions?.length || 246)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-muted">{dateStr}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditForm(role)}
                            className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-line transition cursor-pointer"
                            title="Edit Role"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            disabled={isCurrentDeleting}
                            onClick={() => handleDeleteRole(id, role.name)}
                            className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-line transition cursor-pointer disabled:opacity-50"
                            title="Delete Role"
                          >
                            {isCurrentDeleting ? (
                              <Loader2 className="w-4 h-4 animate-spin text-danger" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <TablePagination
          total={filteredRoles.length}
          page={currentPage}
          perPage={perPage}
          onPageChange={setCurrentPage}
          onPerPageChange={setPerPage}
          perPageOptions={[5, 10, 25, 50]}
        />
      </div>
    </div>
  );
}
