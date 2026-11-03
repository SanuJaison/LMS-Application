'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Target,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  UserCheck,
  Shield,
  IndianRupee,
  TrendingUp,
  RefreshCw,
  Loader2,
  Trash2,
  Pencil,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import {
  fetchResourceList,
  createResourceItem,
  updateResourceItem,
  deleteResourceItem,
} from '../../services/api';
import TablePagination from '@/components/ui/TablePagination';

interface TaskTemplatesViewProps {
  showToast?: (type: 'success' | 'danger', message: string) => void;
  onNavigateToTasks?: () => void;
}

export interface SMTaskTarget {
  _id?: string;
  id?: string;
  employee: string;
  employee_id?: string;
  task_template: string;
  period_start: string;
  period_end: string;
  total_target: number;
  achieved: number;
  is_completed: boolean;
  metric_type?: string;
  notes?: string;
  createdAt?: string;
}

const METRIC_TYPE_OPTIONS = [
  'Admissions Closed',
  'Leads Generated',
  'Follow-ups Completed',
  'Calls Made',
];

export default function TaskTemplatesView({
  showToast,
  onNavigateToTasks,
}: TaskTemplatesViewProps) {
  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // SM Profile
  const [smEmployee, setSmEmployee] = useState<any | null>(null);

  // Targets assigned to SM
  const [smTasks, setSmTasks] = useState<SMTaskTarget[]>([]);

  // Statewide Lead Statistics
  const [leads, setLeads] = useState<any[]>([]);

  // Form State
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [targetMonth, setTargetMonth] = useState<string>(currentMonthStr);
  const [dailyTargetInput, setDailyTargetInput] = useState<number>(15);
  const [monthlyTargetInput, setMonthlyTargetInput] = useState<number>(390);
  const [metricType, setMetricType] = useState<string>('Admissions Closed');
  const [notes, setNotes] = useState<string>('');

  // Edit Modal State
  const [editingTarget, setEditingTarget] = useState<SMTaskTarget | null>(null);
  const [editTargetCount, setEditTargetCount] = useState<number>(15);
  const [editAchievedCount, setEditAchievedCount] = useState<number>(0);
  const [editNotes, setEditNotes] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Pagination
  const [perPage, setPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Load Data
  const loadData = async () => {
    try {
      setLoading(true);
      const [empList, tasksList, leadsList] = await Promise.all([
        fetchResourceList('employees').catch(() => []),
        fetchResourceList('employeeTasks').catch(() => []),
        fetchResourceList('leads').catch(() => []),
      ]);

      // 1. Identify active Sales Manager
      const sm = Array.isArray(empList)
        ? empList.find(
            (e: any) =>
              e.designation?.toLowerCase() === 'sales manager' ||
              e.employee_id === 'SM001' ||
              /^SM/i.test(e.employee_id || '')
          )
        : null;
      setSmEmployee(sm || null);

      // 2. Filter tasks for SM
      const allTasks: SMTaskTarget[] = Array.isArray(tasksList) ? tasksList : [];
      const smSpecificTasks = sm
        ? allTasks.filter(
            (t) =>
              t.employee_id === sm.employee_id ||
              t.employee?.toLowerCase() === sm.name?.toLowerCase() ||
              t.task_template?.toLowerCase().includes('sm target')
          )
        : allTasks.filter((t) => t.task_template?.toLowerCase().includes('sm target'));

      setSmTasks(smSpecificTasks);

      // 3. Leads for performance calculation
      const validLeads = Array.isArray(leadsList) ? leadsList : [];
      setLeads(validLeads);

      // Pre-fill inputs from latest monthly/daily targets if present
      const latestDaily = smSpecificTasks.find(
        (t) => t.task_template?.toLowerCase().includes('daily')
      );
      if (latestDaily && latestDaily.total_target) {
        setDailyTargetInput(latestDaily.total_target);
      }

      const latestMonthly = smSpecificTasks.find(
        (t) => t.task_template?.toLowerCase().includes('monthly')
      );
      if (latestMonthly && latestMonthly.total_target) {
        setMonthlyTargetInput(latestMonthly.total_target);
      }
    } catch (err) {
      console.error('Failed to load SM target data:', err);
      showToast?.('danger', 'Failed to load Sales Manager data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Today ISO and Month keys
  const todayIso = new Date().toISOString().slice(0, 10);
  const activeMonthKey = targetMonth || currentMonthStr;

  // Statewide Lead Calculations
  const leadsCreatedToday = useMemo(() => {
    return leads.filter((l) => {
      const d = l.createdAt ? new Date(l.createdAt).toISOString().slice(0, 10) : '';
      return d === todayIso;
    }).length;
  }, [leads, todayIso]);

  const leadsCreatedThisMonth = useMemo(() => {
    return leads.filter((l) => {
      const d = l.createdAt ? new Date(l.createdAt).toISOString().slice(0, 7) : '';
      return d === activeMonthKey;
    }).length;
  }, [leads, activeMonthKey]);

  const admissionsToday = useMemo(() => {
    return leads.filter((l) => {
      const isClosed =
        l.status === 4 ||
        l.status === 5 ||
        l.admission_status === 'Admitted' ||
        l.admission_status === 'Closed' ||
        l.admission_status === 'Won';
      const d = l.admission_date
        ? new Date(l.admission_date).toISOString().slice(0, 10)
        : l.updatedAt
        ? new Date(l.updatedAt).toISOString().slice(0, 10)
        : '';
      return isClosed && d === todayIso;
    }).length;
  }, [leads, todayIso]);

  const admissionsThisMonth = useMemo(() => {
    return leads.filter((l) => {
      const isClosed =
        l.status === 4 ||
        l.status === 5 ||
        l.admission_status === 'Admitted' ||
        l.admission_status === 'Closed' ||
        l.admission_status === 'Won';
      const d = l.admission_date
        ? new Date(l.admission_date).toISOString().slice(0, 7)
        : l.updatedAt
        ? new Date(l.updatedAt).toISOString().slice(0, 7)
        : '';
      return isClosed && d === activeMonthKey;
    }).length;
  }, [leads, activeMonthKey]);

  // Live target progress
  const activeDailyTarget = useMemo(() => {
    const dailyRow = smTasks.find(
      (t) =>
        t.task_template?.toLowerCase().includes('daily') ||
        t.period_start?.slice(0, 10) === todayIso
    );
    return dailyRow ? dailyRow.total_target : dailyTargetInput;
  }, [smTasks, todayIso, dailyTargetInput]);

  const activeDailyAchieved = metricType === 'Leads Generated' ? leadsCreatedToday : admissionsToday;

  const activeMonthlyTarget = useMemo(() => {
    const monthlyRow = smTasks.find(
      (t) =>
        t.task_template?.toLowerCase().includes('monthly') ||
        t.period_start?.slice(0, 7) === activeMonthKey
    );
    return monthlyRow ? monthlyRow.total_target : monthlyTargetInput;
  }, [smTasks, activeMonthKey, monthlyTargetInput]);

  const activeMonthlyAchieved =
    metricType === 'Leads Generated' ? leadsCreatedThisMonth : admissionsThisMonth;

  // Handle Target Assignment Submission
  const handleAssignTargets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smEmployee) {
      showToast?.('danger', 'Please create a Sales Manager first in the Employees section.');
      return;
    }

    if (dailyTargetInput <= 0 || monthlyTargetInput <= 0) {
      showToast?.('danger', 'Targets must be greater than zero.');
      return;
    }

    try {
      setIsSaving(true);

      const daysInMonth = new Date(
        parseInt(activeMonthKey.split('-')[0]),
        parseInt(activeMonthKey.split('-')[1]),
        0
      ).getDate();
      const monthEndIso = `${activeMonthKey}-${String(daysInMonth).padStart(2, '0')}`;

      // 1. Check if Daily Target exists for today, update or create
      const existingDaily = smTasks.find(
        (t) =>
          (t.task_template?.toLowerCase().includes('daily') &&
            t.period_start?.slice(0, 10) === todayIso) ||
          t.period_start === todayIso
      );

      const dailyPayload = {
        employee: smEmployee.name,
        employee_id: smEmployee.employee_id,
        task_template: 'Daily SM Target',
        period_start: todayIso,
        period_end: todayIso,
        total_target: Number(dailyTargetInput),
        achieved: activeDailyAchieved,
        is_completed: activeDailyAchieved >= Number(dailyTargetInput),
        metric_type: metricType,
        notes: notes || `Statewide daily target for ${smEmployee.name}`,
      };

      if (existingDaily && (existingDaily._id || existingDaily.id)) {
        await updateResourceItem('employeeTasks', {
          id: existingDaily._id || existingDaily.id,
          _id: existingDaily._id || existingDaily.id,
          ...dailyPayload,
        });
      } else {
        await createResourceItem('employeeTasks', dailyPayload);
      }

      // 2. Check if Monthly Target exists for this month, update or create
      const existingMonthly = smTasks.find(
        (t) =>
          t.task_template?.toLowerCase().includes('monthly') &&
          t.period_start?.slice(0, 7) === activeMonthKey
      );

      const monthlyPayload = {
        employee: smEmployee.name,
        employee_id: smEmployee.employee_id,
        task_template: 'Monthly SM Target',
        period_start: `${activeMonthKey}-01`,
        period_end: monthEndIso,
        total_target: Number(monthlyTargetInput),
        achieved: activeMonthlyAchieved,
        is_completed: activeMonthlyAchieved >= Number(monthlyTargetInput),
        metric_type: metricType,
        notes: notes || `Statewide monthly target for ${smEmployee.name} (${activeMonthKey})`,
      };

      if (existingMonthly && (existingMonthly._id || existingMonthly.id)) {
        await updateResourceItem('employeeTasks', {
          id: existingMonthly._id || existingMonthly.id,
          _id: existingMonthly._id || existingMonthly.id,
          ...monthlyPayload,
        });
      } else {
        await createResourceItem('employeeTasks', monthlyPayload);
      }

      showToast?.('success', `Targets assigned for Sales Manager (${smEmployee.name})!`);
      await loadData();
    } catch (err) {
      console.error('Failed to assign SM targets:', err);
      showToast?.('danger', 'Failed to save SM targets.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Target Record
  const handleDeleteTarget = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this target record?')) return;
    try {
      await deleteResourceItem('employeeTasks', id);
      showToast?.('success', 'Target record deleted.');
      setSmTasks((prev) => prev.filter((t) => (t._id || t.id) !== id));
    } catch {
      showToast?.('danger', 'Failed to delete target record.');
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (task: SMTaskTarget) => {
    setEditingTarget(task);
    setEditTargetCount(task.total_target || 15);
    setEditAchievedCount(task.achieved || 0);
    setEditNotes(task.notes || '');
  };

  // Save Edit Modal
  const handleSaveEdit = async () => {
    if (!editingTarget) return;
    try {
      setIsUpdating(true);
      const id = (editingTarget._id || editingTarget.id) as string;
      const isCompleted = editAchievedCount >= editTargetCount;
      await updateResourceItem('employeeTasks', {
        id,
        _id: id,
        total_target: Number(editTargetCount),
        achieved: Number(editAchievedCount),
        is_completed: isCompleted,
        notes: editNotes,
      });

      showToast?.('success', 'Target updated successfully.');
      setEditingTarget(null);
      await loadData();
    } catch {
      showToast?.('danger', 'Failed to update target.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Pagination for tasks table
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return smTasks.slice(start, start + perPage);
  }, [smTasks, currentPage, perPage]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/50">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-ink">Sales Manager Targets</h1>
              <p className="text-sm text-muted">
                Assign and monitor monthly & daily performance targets for the statewide Sales Manager
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              loadData();
            }}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border text-sm text-muted hover:text-ink hover:bg-hover transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {onNavigateToTasks && (
            <button
              type="button"
              onClick={onNavigateToTasks}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 text-sm font-medium text-primary hover:bg-primary/20 transition cursor-pointer"
            >
              <span>Employee Tasks</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* SM Profile Banner */}
      {smEmployee ? (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-primary/10 via-surface to-surface border border-primary/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary/25">
                {smEmployee.name?.charAt(0)?.toUpperCase() || 'S'}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-ink">{smEmployee.name}</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-primary border border-primary/30">
                    Sales Manager
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-xs font-mono bg-surface border border-border text-muted">
                    {smEmployee.employee_id || 'SM001'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Active
                  </span>
                </div>
                <p className="text-xs text-muted mt-1">
                  {smEmployee.email || 'sm@kidecrm.com'} • {smEmployee.contact_number || '+91 9746543243'} • Head of Statewide Operations (Kerala)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-xl bg-surface/80 border border-border/60">
                <span className="text-[11px] uppercase tracking-wider text-muted font-medium block">
                  Monthly Salary
                </span>
                <span className="text-base font-bold text-ink flex items-center">
                  <IndianRupee className="w-3.5 h-3.5" />
                  {Number(smEmployee.salary || 0).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="px-4 py-2 rounded-xl bg-surface/80 border border-border/60">
                <span className="text-[11px] uppercase tracking-wider text-muted font-medium block">
                  Incentive / Close
                </span>
                <span className="text-base font-bold text-emerald-400 flex items-center">
                  <IndianRupee className="w-3.5 h-3.5" />
                  {Number(smEmployee.incentive || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-amber-400">No Sales Manager Found</h3>
            <p className="text-xs text-muted mt-0.5">
              Please create a Sales Manager first in the Employees section before assigning statewide targets.
            </p>
          </div>
        </div>
      )}

      {/* Target KPI Progress Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Daily Target Progress */}
        <div className="p-4 rounded-xl bg-surface border border-border/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Daily Target (Today)
            </span>
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{activeDailyAchieved}</span>
            <span className="text-sm text-muted">/ {activeDailyTarget}</span>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted mb-1">
              <span>Progress</span>
              <span className="font-semibold text-ink">
                {activeDailyTarget > 0
                  ? Math.min(100, Math.round((activeDailyAchieved / activeDailyTarget) * 100))
                  : 0}
                %
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-border overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{
                  width: `${
                    activeDailyTarget > 0
                      ? Math.min(100, Math.round((activeDailyAchieved / activeDailyTarget) * 100))
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Monthly Target Progress */}
        <div className="p-4 rounded-xl bg-surface border border-border/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Monthly Target ({activeMonthKey})
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{activeMonthlyAchieved}</span>
            <span className="text-sm text-muted">/ {activeMonthlyTarget}</span>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted mb-1">
              <span>Progress</span>
              <span className="font-semibold text-emerald-400">
                {activeMonthlyTarget > 0
                  ? Math.min(100, Math.round((activeMonthlyAchieved / activeMonthlyTarget) * 100))
                  : 0}
                %
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-border overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    activeMonthlyTarget > 0
                      ? Math.min(100, Math.round((activeMonthlyAchieved / activeMonthlyTarget) * 100))
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Statewide Leads */}
        <div className="p-4 rounded-xl bg-surface border border-border/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Total Leads Generated
            </span>
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <FileSpreadsheet className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{leads.length}</span>
            <span className="text-xs text-muted">Statewide (Kerala)</span>
          </div>
          <p className="text-xs text-muted mt-3">
            {leadsCreatedThisMonth} added this month • {leadsCreatedToday} today
          </p>
        </div>

        {/* Total Closed Admissions */}
        <div className="p-4 rounded-xl bg-surface border border-border/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Closed Admissions
            </span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400">
              {leads.filter(
                (l) =>
                  l.status === 4 ||
                  l.status === 5 ||
                  l.admission_status === 'Admitted' ||
                  l.admission_status === 'Closed' ||
                  l.admission_status === 'Won'
              ).length}
            </span>
            <span className="text-xs text-muted">Total Closed</span>
          </div>
          <p className="text-xs text-muted mt-3">
            {admissionsThisMonth} closed this month • {admissionsToday} today
          </p>
        </div>
      </div>

      {/* Target Assignment Form */}
      <div className="p-6 rounded-2xl bg-surface border border-border/60">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold text-ink">Assign & Update Sales Manager Targets</h2>
        </div>

        <form onSubmit={handleAssignTargets} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Daily Target */}
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
                Daily Target <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={dailyTargetInput}
                  onChange={(e) => setDailyTargetInput(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface/50 border border-border text-ink focus:outline-none focus:border-primary text-sm font-semibold"
                  placeholder="e.g. 15"
                />
                <span className="absolute right-3 top-2.5 text-xs text-muted">/ day</span>
              </div>
              <p className="text-[11px] text-muted mt-1">Daily admissions or lead target across Kerala</p>
            </div>

            {/* Monthly Target */}
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
                Monthly Target <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={monthlyTargetInput}
                  onChange={(e) => setMonthlyTargetInput(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface/50 border border-border text-ink focus:outline-none focus:border-primary text-sm font-semibold"
                  placeholder="e.g. 390"
                />
                <span className="absolute right-3 top-2.5 text-xs text-muted">/ month</span>
              </div>
              <p className="text-[11px] text-muted mt-1">Total statewide target for the month</p>
            </div>

            {/* Target Metric */}
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
                Target Metric
              </label>
              <select
                value={metricType}
                onChange={(e) => setMetricType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface/50 border border-border text-ink focus:outline-none focus:border-primary text-sm cursor-pointer"
              >
                {METRIC_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="bg-slate-900 text-ink">
                    {opt}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted mt-1">Primary KPI to evaluate target completion</p>
            </div>

            {/* Target Month */}
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
                Target Month Period
              </label>
              <input
                type="month"
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface/50 border border-border text-ink focus:outline-none focus:border-primary text-sm cursor-pointer"
              />
              <p className="text-[11px] text-muted mt-1">Target active period</p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
              Target Notes / Directives (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Focus on Admissions across Malabar & South Region for Q4"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface/50 border border-border text-ink focus:outline-none focus:border-primary text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving || !smEmployee}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Assigning Targets...</span>
                </>
              ) : (
                <>
                  <Target className="w-4 h-4" />
                  <span>Save & Assign SM Targets</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Assigned Targets History Table */}
      <div className="rounded-2xl bg-surface border border-border/60 overflow-hidden">
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-ink">Assigned Targets & Task History</h3>
            <p className="text-xs text-muted">All targets created for the Sales Manager</p>
          </div>
          <span className="text-xs font-medium text-muted bg-surface/80 border border-border px-2.5 py-1 rounded-lg">
            {smTasks.length} {smTasks.length === 1 ? 'Record' : 'Records'}
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted mt-3">Loading target history...</p>
          </div>
        ) : smTasks.length === 0 ? (
          <div className="p-12 text-center text-muted">
            <Target className="w-10 h-10 mx-auto text-muted/40 mb-2" />
            <p className="text-sm font-medium">No target records assigned yet</p>
            <p className="text-xs text-muted/80 mt-1">
              Use the form above to assign daily and monthly targets for the Sales Manager.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#1e293b]/70 border-b border-border text-muted font-semibold">
                <tr>
                  <th className="py-3 px-4">Target Type</th>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4">Metric</th>
                  <th className="py-3 px-4">Target</th>
                  <th className="py-3 px-4">Achieved</th>
                  <th className="py-3 px-4">Progress</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-ink">
                {paginatedTasks.map((t) => {
                  const id = (t._id || t.id) as string;
                  const isDaily = t.task_template?.toLowerCase().includes('daily');
                  const targetCount = t.total_target || 15;
                  const achievedCount = t.achieved || 0;
                  const pct =
                    targetCount > 0
                      ? Math.min(100, Math.round((achievedCount / targetCount) * 100))
                      : 0;

                  return (
                    <tr key={id} className="hover:bg-hover/40 transition">
                      <td className="py-3.5 px-4 font-semibold text-ink flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isDaily ? 'bg-primary' : 'bg-emerald-400'
                          }`}
                        />
                        {t.task_template || 'Sales Manager Target'}
                      </td>
                      <td className="py-3.5 px-4 text-muted font-mono">
                        {t.period_start} {t.period_end && t.period_end !== t.period_start ? `→ ${t.period_end}` : ''}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-surface border border-border text-muted">
                          {t.metric_type || 'Admissions Closed'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-ink">{targetCount}</td>
                      <td className="py-3.5 px-4 font-bold text-emerald-400">{achievedCount}</td>
                      <td className="py-3.5 px-4 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                pct >= 100 ? 'bg-emerald-400' : 'bg-primary'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono text-muted">{pct}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {pct >= 100 || t.is_completed ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Completed
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                            In Progress
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-muted max-w-[200px] truncate">
                        {t.notes || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(t)}
                            title="Edit Target"
                            className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-hover transition cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTarget(id)}
                            title="Delete Target"
                            className="p-1.5 rounded-lg text-muted hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {smTasks.length > 0 && (
          <div className="p-4 border-t border-border/50">
            <TablePagination
              page={currentPage}
              perPage={perPage}
              total={smTasks.length}
              onPageChange={setCurrentPage}
              onPerPageChange={(n) => {
                setPerPage(n);
                setCurrentPage(1);
              }}
            />
          </div>
        )}
      </div>

      {/* Edit Target Modal */}
      {editingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-ink text-sm">Edit Target Record</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingTarget(null)}
                className="p-1 rounded-lg text-muted hover:text-ink hover:bg-hover transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-muted mb-1">Target Title</label>
                <input
                  type="text"
                  disabled
                  value={editingTarget.task_template}
                  className="w-full px-3 py-2 rounded-xl bg-hover/50 border border-border text-muted font-mono cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-muted mb-1">Target Count</label>
                  <input
                    type="number"
                    min="1"
                    value={editTargetCount}
                    onChange={(e) => setEditTargetCount(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-ink focus:outline-none focus:border-primary font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-muted mb-1">Achieved Count</label>
                  <input
                    type="number"
                    min="0"
                    value={editAchievedCount}
                    onChange={(e) => setEditAchievedCount(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-emerald-400 focus:outline-none focus:border-primary font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-ink focus:outline-none focus:border-primary resize-none"
                  placeholder="Notes or directives..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-[#1e293b]/40">
              <button
                type="button"
                onClick={() => setEditingTarget(null)}
                className="px-4 py-2 rounded-xl border border-border text-xs text-muted hover:text-ink hover:bg-hover transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition cursor-pointer disabled:opacity-50"
              >
                {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
