'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Loader2,
  Pencil,
  RefreshCw,
  Target,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  createResourceItem,
  deleteResourceItem,
  fetchResourceList,
  updateResourceItem,
} from '../../services/api';
import TablePagination from '@/components/ui/TablePagination';
import { confirmDeleteToast } from '@/utils/confirmToast';

interface TaskTemplatesViewProps {
  showToast?: (type: 'success' | 'danger', message: string) => void;
  onNavigateToTasks?: () => void;
}

interface SMEmployee {
  _id?: string;
  id?: string;
  employee_id?: string;
  name?: string;
  email?: string;
  contact_number?: string;
  designation?: string;
  status?: string;
}

interface TargetRow {
  _id?: string;
  id?: string;
  employee?: string;
  employee_id?: string;
  task_template?: string;
  period_start?: string;
  period_end?: string;
  total_target?: number;
  achieved?: number;
  is_completed?: boolean;
  metric_type?: string;
  notes?: string;
  createdAt?: string;
}

interface MonthGroup {
  month: string;
  monthly?: TargetRow;
}

const pad = (n: number) => String(n).padStart(2, '0');

const monthKeyOf = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

const monthEnd = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${key}-${pad(lastDay)}`;
};

const monthLabel = (key: string) => {
  if (!/^\d{4}-\d{2}$/.test(key)) return key || '—';
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
};

const isMonthly = (row: TargetRow) => /monthly/i.test(row.task_template || '');

const rowCreatedTime = (row: TargetRow) =>
  new Date(row.createdAt || 0).getTime() || 0;

const isClosedLead = (lead: any) => {
  const status = String(lead.status || '').toLowerCase().trim();
  const admission = String(lead.admission_status || '').toLowerCase().trim();
  return (
    status === '4' ||
    status === '5' ||
    status === 'admitted' ||
    status === 'closed' ||
    status === 'won' ||
    admission === 'admitted' ||
    admission === 'closed' ||
    admission === 'won'
  );
};

const isPendingFollowUp = (lead: any) => {
  if (isClosedLead(lead)) return false;
  const status = String(lead.status || '').toLowerCase().trim();
  const admission = String(lead.admission_status || '').toLowerCase().trim();
  return (
    admission === 'follow-up' ||
    admission === 'interested' ||
    status === '2' ||
    status === '3' ||
    Boolean(lead.next_followup_date)
  );
};

export default function TaskTemplatesView({ showToast }: TaskTemplatesViewProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [employees, setEmployees] = useState<SMEmployee[]>([]);
  const [targetRows, setTargetRows] = useState<TargetRow[]>([]);
  const [leads, setLeads] = useState<any[]>([]);

  const todayKey = monthKeyOf();
  const todayIso = new Date().toISOString().slice(0, 10);

  const [targetMonth, setTargetMonth] = useState(todayKey);
  const [monthlyTargetInput, setMonthlyTargetInput] = useState(0);
  const [notes, setNotes] = useState('');

  const [editingGroup, setEditingGroup] = useState<MonthGroup | null>(null);
  const [editMonthly, setEditMonthly] = useState(0);
  const [editNotes, setEditNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const loadData = async () => {
    try {
      setLoading(true);
      const [employeeList, taskList, leadList] = await Promise.all([
        fetchResourceList('employees').catch(() => []),
        fetchResourceList('employeeTasks').catch(() => []),
        fetchResourceList('admin/leads').catch(() => []),
      ]);
      setEmployees(Array.isArray(employeeList) ? employeeList : []);
      setTargetRows(Array.isArray(taskList) ? taskList : []);
      setLeads(Array.isArray(leadList) ? leadList : []);
    } catch (error) {
      console.error('Failed to load SM target data:', error);
      showToast?.('danger', 'Failed to load SM target data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const smEmployee = useMemo(
    () =>
      employees.find(
        (employee) =>
          /^SM/i.test(employee.employee_id || '') ||
          employee.designation?.toLowerCase() === 'sales manager'
      ),
    [employees]
  );

  const smTargets = useMemo(() => {
    if (!smEmployee) return [];
    return targetRows.filter((row) => {
      const sameEmployee =
        (row.employee_id &&
          smEmployee.employee_id &&
          row.employee_id === smEmployee.employee_id) ||
        (row.employee &&
          smEmployee.name &&
          row.employee.toLowerCase().trim() === smEmployee.name.toLowerCase().trim());
      return Boolean(sameEmployee && /sm target/i.test(row.task_template || ''));
    });
  }, [targetRows, smEmployee]);

  const monthGroups = useMemo(() => {
    const map = new Map<string, MonthGroup>();

    for (const row of smTargets) {
      const month =
        (row.period_start || '').slice(0, 7) ||
        (row.createdAt ? new Date(row.createdAt).toISOString().slice(0, 7) : todayKey);
      if (!map.has(month)) map.set(month, { month });
      const group = map.get(month)!;

      if (
        isMonthly(row) &&
        (!group.monthly || rowCreatedTime(row) > rowCreatedTime(group.monthly))
      ) {
        group.monthly = row;
      }
    }

    return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month));
  }, [smTargets, todayKey]);

  const currentGroup = useMemo(
    () => monthGroups.find((group) => group.month === targetMonth),
    [monthGroups, targetMonth]
  );

  useEffect(() => {
    const group = monthGroups.find((item) => item.month === targetMonth);
    setMonthlyTargetInput(group?.monthly?.total_target ?? 0);
    setNotes(group?.monthly?.notes || '');
  }, [targetMonth, monthGroups]);

  const leadsToday = useMemo(
    () =>
      leads.filter(
        (lead) =>
          isClosedLead(lead) &&
          String(lead.admission_date || lead.updatedAt || lead.createdAt || '').slice(0, 10) ===
            todayIso
      ).length,
    [leads, todayIso]
  );

  const leadsThisMonth = useMemo(
    () =>
      leads.filter(
        (lead) =>
          isClosedLead(lead) &&
          String(lead.admission_date || lead.updatedAt || lead.createdAt || '').slice(0, 7) ===
            todayKey
      ).length,
    [leads, todayKey]
  );

  const pendingFollowUps = useMemo(
    () => leads.filter(isPendingFollowUp).length,
    [leads]
  );

  const monthAchieved = (month: string) =>
    leads.filter(
      (lead) =>
        isClosedLead(lead) &&
        String(lead.admission_date || lead.updatedAt || lead.createdAt || '').slice(0, 7) === month
    ).length;

  const handleSaveTargets = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!smEmployee) {
      showToast?.('danger', 'Create a Sales Manager before assigning targets.');
      return;
    }
    if (monthlyTargetInput <= 0) {
      showToast?.('danger', 'Monthly target must be greater than zero.');
      return;
    }

    setIsSaving(true);
    try {
      const group = monthGroups.find((item) => item.month === targetMonth);
      const monthLeads = monthAchieved(targetMonth);

      const monthlyPayload = {
        employee: smEmployee.name || '',
        employee_id: smEmployee.employee_id || '',
        period_start: `${targetMonth}-01`,
        period_end: monthEnd(targetMonth),
        metric_type: 'Leads Generated',
        notes,
        task_template: 'Monthly SM Target',
        total_target: Number(monthlyTargetInput),
        achieved: monthLeads,
        is_completed: monthLeads >= Number(monthlyTargetInput),
      };

      if (group?.monthly?._id) {
        await updateResourceItem('employeeTasks', {
          id: group.monthly._id,
          ...monthlyPayload,
        });
      } else {
        await createResourceItem('employeeTasks', monthlyPayload);
      }

      showToast?.('success', `Monthly target saved for ${monthLabel(targetMonth)}.`);
      await loadData();
    } catch (error) {
      console.error('Failed to save SM targets:', error);
      showToast?.('danger', 'Failed to save SM targets.');
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = (group: MonthGroup) => {
    setEditingGroup(group);
    setEditMonthly(group.monthly?.total_target ?? 0);
    setEditNotes(group.monthly?.notes || '');
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingGroup || !smEmployee) return;
    if (editMonthly <= 0) {
      showToast?.('danger', 'Monthly target must be greater than zero.');
      return;
    }

    setIsUpdating(true);
    try {
      const monthLeads = monthAchieved(editingGroup.month);

      const monthlyPayload = {
        employee: smEmployee.name || '',
        employee_id: smEmployee.employee_id || '',
        period_start: `${editingGroup.month}-01`,
        period_end: monthEnd(editingGroup.month),
        metric_type: 'Leads Generated',
        notes: editNotes,
        task_template: 'Monthly SM Target',
        total_target: Number(editMonthly),
        achieved: monthLeads,
        is_completed: monthLeads >= Number(editMonthly),
      };

      if (editingGroup.monthly?._id) {
        await updateResourceItem('employeeTasks', {
          id: editingGroup.monthly._id,
          ...monthlyPayload,
        });
      } else {
        await createResourceItem('employeeTasks', monthlyPayload);
      }

      showToast?.('success', 'Target updated.');
      setEditingGroup(null);
      await loadData();
    } catch (error) {
      console.error('Failed to update SM targets:', error);
      showToast?.('danger', 'Failed to update SM targets.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (group: MonthGroup) => {
    const confirmed = await confirmDeleteToast({
      title: 'Delete Monthly Target?',
      message: `Delete the monthly target for ${monthLabel(group.month)}? Confirm delete?`,
      variant: 'danger',
    });
    if (!confirmed) return;

    const ids = [group.monthly?._id].filter(Boolean) as string[];
    if (ids.length === 0) return;

    try {
      await deleteResourceItem('employeeTasks', ids.length === 1 ? ids[0] : ids);
      showToast?.('success', `Monthly target deleted for ${monthLabel(group.month)}.`);
      await loadData();
    } catch (error) {
      console.error('Failed to delete SM targets:', error);
      showToast?.('danger', 'Failed to delete SM targets.');
    }
  };

  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return monthGroups.slice(start, start + perPage);
  }, [monthGroups, currentPage, perPage]);

  const activeMonthlyTarget = currentGroup?.monthly?.total_target ?? 0;
  const activeMonthlyAchieved = monthAchieved(targetMonth);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted mb-1">
            <span>Targets</span>
            <span>&gt;</span>
            <span className="text-ink">SM Targets</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">SM Targets</h1>
          <p className="text-xs text-muted mt-1">
            Assign monthly targets to the Sales Manager.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setRefreshing(true);
            loadData();
          }}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-line bg-surface text-xs font-medium text-muted hover:text-ink hover:bg-hover transition disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {!smEmployee && !loading && (
        <div className="bg-surface border border-line rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-ink">No Sales Manager found</h3>
            <p className="text-xs text-muted mt-0.5">
              Create the Sales Manager in Employees first, then assign monthly targets here.
            </p>
          </div>
        </div>
      )}

      {/* SM identity */}
      {smEmployee && (
        <div className="bg-surface border border-line rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-bold text-lg">
                {smEmployee.name?.charAt(0)?.toUpperCase() || 'S'}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-ink">{smEmployee.name || 'Sales Manager'}</h2>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-accent/10 text-accent border border-accent/20">
                    Sales Manager
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-surface-2 border border-line text-muted">
                    {smEmployee.employee_id || 'SM001'}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1">
                  {smEmployee.email || '—'} • {smEmployee.contact_number || '—'}
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-success/10 text-success border border-success/20">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              {smEmployee.status || 'active'}
            </span>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Monthly Target
            </span>
            <span className="p-1.5 rounded-lg bg-success/10 text-success">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">
              {activeMonthlyTarget > 0 ? activeMonthlyTarget : '—'}
            </span>
            {activeMonthlyTarget > 0 && <span className="text-xs text-muted">/ month</span>}
          </div>
          <p className="text-[11px] text-muted mt-2">
            {activeMonthlyTarget > 0
              ? `${monthLabel(targetMonth)} • achieved ${activeMonthlyAchieved}`
              : 'No target assigned'}
          </p>
        </div>

        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Leads This Month
            </span>
            <span className="p-1.5 rounded-lg bg-accent/10 text-accent">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{leadsThisMonth}</span>
            <span className="text-xs text-muted">statewide</span>
          </div>
          <p className="text-[11px] text-muted mt-2">{leadsToday} added today</p>
        </div>

        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Pending Follow-ups
            </span>
            <span className="p-1.5 rounded-lg bg-warning/10 text-warning">
              <Target className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{pendingFollowUps}</span>
            <span className="text-xs text-muted">open</span>
          </div>
          <p className="text-[11px] text-muted mt-2">Statewide follow-up queue</p>
        </div>
      </div>

      {/* Assignment form */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-line flex items-center gap-2">
          <Target className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-bold text-ink">Assign / update Sales Manager monthly target</h2>
        </div>

        <form onSubmit={handleSaveTargets} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                Target month
              </label>
              <input
                type="month"
                value={targetMonth}
                onChange={(event) => setTargetMonth(event.target.value)}
                className="w-full px-3 py-2 bg-field border border-line rounded-lg text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                Monthly target
              </label>
              <input
                type="number"
                min={1}
                step={1}
                required
                value={monthlyTargetInput || ''}
                onChange={(event) =>
                  setMonthlyTargetInput(parseInt(event.target.value, 10) || 0)
                }
                className="w-full px-3 py-2 bg-field border border-line rounded-lg text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="e.g. 390"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                Notes (optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="w-full px-3 py-2 bg-field border border-line rounded-lg text-xs text-ink placeholder-subtle focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="e.g. statewide admissions"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="submit"
              disabled={isSaving || !smEmployee}
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg shadow-sm transition active:scale-95 disabled:opacity-60 cursor-pointer"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>{isSaving ? 'Saving…' : 'Save targets'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* History */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-line">
          <div>
            <h2 className="text-sm font-bold text-ink">Target history</h2>
            <p className="text-[11px] text-muted mt-0.5">
              Monthly targets already saved for the Sales Manager.
            </p>
          </div>
          <span className="text-xs text-muted">
            Total: <strong className="text-ink">{monthGroups.length}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-muted font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Month</th>
                <th className="py-3 px-4">Monthly target</th>
                <th className="py-3 px-4">Achieved</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-2">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-accent" />
                      <span>Loading targets…</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedGroups.length > 0 ? (
                paginatedGroups.map((group) => {
                  const monthlyTarget = group.monthly?.total_target ?? 0;
                  const achieved = monthAchieved(group.month);
                  const completed = monthlyTarget > 0 && achieved >= monthlyTarget;

                  return (
                    <tr key={group.month} className="hover:bg-hover/60 transition">
                      <td className="py-3 px-4 font-medium text-ink whitespace-nowrap">{monthLabel(group.month)}</td>
                      <td className="py-3 px-4 text-ink">{monthlyTarget || '—'}</td>
                      <td className="py-3 px-4 text-muted">{achieved}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${
                            monthlyTarget === 0
                              ? 'bg-surface-2 text-muted border-line'
                              : completed
                                ? 'bg-success/10 text-success border-success/20'
                                : 'bg-warning/10 text-warning border-warning/20'
                          }`}
                        >
                          {monthlyTarget === 0
                            ? 'Not set'
                            : completed
                              ? 'Completed'
                              : 'In progress'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => openEdit(group)}
                            className="inline-flex items-center gap-1 text-xs text-accent hover:underline cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(group)}
                            className="inline-flex items-center gap-1 text-xs text-danger hover:underline cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-subtle">
                    No SM targets saved yet. Use the form above to assign a monthly target.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          total={monthGroups.length}
          page={currentPage}
          perPage={perPage}
          onPageChange={setCurrentPage}
          onPerPageChange={setPerPage}
        />
      </div>

      {/* Edit modal */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-elevated border border-line rounded-2xl shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-ink text-base">
                Edit monthly target — {monthLabel(editingGroup.month)}
              </h3>
              <button
                type="button"
                onClick={() => setEditingGroup(null)}
                className="text-muted hover:text-ink p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                  Monthly target
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={editMonthly || ''}
                  onChange={(event) =>
                    setEditMonthly(parseInt(event.target.value, 10) || 0)
                  }
                  className="w-full px-3 py-2 bg-field border border-line rounded-lg text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                  Notes
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(event) => setEditNotes(event.target.value)}
                  className="w-full px-3 py-2 bg-field border border-line rounded-lg text-xs text-ink placeholder-subtle focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="Optional note"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="px-4 py-1.5 rounded-lg border border-line bg-active text-ink hover:bg-hover text-xs font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="inline-flex items-center gap-2 px-4 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg transition disabled:opacity-60 cursor-pointer"
                >
                  {isUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{isUpdating ? 'Saving…' : 'Save changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
