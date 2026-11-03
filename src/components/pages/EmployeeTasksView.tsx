'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Hourglass,
  Loader2,
  PhoneCall,
  RefreshCw,
  Search,
  Shield,
  Target,
  UserCheck,
  Users,
} from 'lucide-react';
import { fetchResourceList } from '../../services/api';
import TablePagination from '@/components/ui/TablePagination';

interface EmployeeTasksViewProps {
  showToast?: (type: 'success' | 'danger', message: string) => void;
}

type RoleTab = 'SM' | 'ASM' | 'BDE';

interface EmployeeLike {
  _id?: string;
  id?: string;
  employee_id?: string;
  name?: string;
  email?: string;
  contact_number?: string;
  designation?: string;
  team?: string;
  district?: string;
  zone?: string;
  reports_to?: string;
  status?: string;
}

interface TaskLike {
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

interface PersonMetrics extends EmployeeLike {
  daily_target: number;
  monthly_target: number;
  leads_today: number;
  leads_this_month: number;
  total_leads: number;
  total_followups: number;
  pending_followups: number;
  admissions: number;
  conversion_rate: number;
  bdes_count?: number;
  reports_to_name?: string;
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const currentMonthKey = () => new Date().toISOString().slice(0, 7);

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

const isFollowUpLead = (lead: any) => {
  const status = String(lead.status || '').toLowerCase().trim();
  const admission = String(lead.admission_status || '').toLowerCase().trim();
  return (
    admission === 'follow-up' ||
    admission === 'interested' ||
    status === '2' ||
    status === '3' ||
    (Array.isArray(lead.followups) && lead.followups.length > 0)
  );
};

const isPendingFollowUpLead = (lead: any) => {
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

const leadMatchesEmployee = (lead: any, employee: EmployeeLike) => {
  const employeeId = String(employee.employee_id || '').toLowerCase();
  const employeeName = String(employee.name || '').toLowerCase().trim();
  const leadEmployeeId = String(lead.employee_id || '').toLowerCase();
  const leadEmployeeName = String(lead.employee || '').toLowerCase().trim();
  return Boolean(
    (employeeId && leadEmployeeId === employeeId) ||
      (employeeName && leadEmployeeName === employeeName)
  );
};

const targetRowFor = (
  employee: EmployeeLike,
  tasks: TaskLike[],
  kind: 'daily' | 'monthly'
) => {
  const employeeId = String(employee.employee_id || '').toLowerCase();
  const employeeName = String(employee.name || '').toLowerCase().trim();
  const matcher = kind === 'daily' ? /daily/i : /monthly/i;

  const rows = tasks.filter((task) => {
    const sameEmployee =
      (employeeId && String(task.employee_id || '').toLowerCase() === employeeId) ||
      (employeeName && String(task.employee || '').toLowerCase().trim() === employeeName);
    return Boolean(sameEmployee && matcher.test(task.task_template || ''));
  });

  rows.sort((a, b) => {
    // Prefer the target that belongs to the current month, so next month's
    // targets do not leak into this month's summary.
    const month = currentMonthKey();
    const aCurrent = String(a.period_start || '').slice(0, 7) === month ? 1 : 0;
    const bCurrent = String(b.period_start || '').slice(0, 7) === month ? 1 : 0;
    if (aCurrent !== bCurrent) return bCurrent - aCurrent;

    const aSm = /sm target/i.test(a.task_template || '') ? 1 : 0;
    const bSm = /sm target/i.test(b.task_template || '') ? 1 : 0;
    if (aSm !== bSm) return bSm - aSm;
    return (
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  });

  return rows[0];
};

const buildPersonMetrics = (
  employee: EmployeeLike,
  employeeLeads: any[],
  tasks: TaskLike[]
): PersonMetrics => {
  const dailyRow = targetRowFor(employee, tasks, 'daily');
  const monthlyRow = targetRowFor(employee, tasks, 'monthly');

  const totalLeads = employeeLeads.length;
  const admissions = employeeLeads.filter(isClosedLead).length;

  return {
    ...employee,
    daily_target: Number(dailyRow?.total_target || 0),
    monthly_target: Number(monthlyRow?.total_target || 0),
    leads_today: employeeLeads.filter(
      (lead) => String(lead.createdAt || '').slice(0, 10) === todayIso()
    ).length,
    leads_this_month: employeeLeads.filter(
      (lead) => String(lead.createdAt || '').slice(0, 7) === currentMonthKey()
    ).length,
    total_leads: totalLeads,
    total_followups: employeeLeads.filter(isFollowUpLead).length,
    pending_followups: employeeLeads.filter(isPendingFollowUpLead).length,
    admissions,
    conversion_rate:
      totalLeads > 0 ? Math.round((admissions / totalLeads) * 100) : 0,
  };
};

const sumRows = (rows: PersonMetrics[]) => ({
  daily_target: rows.reduce((sum, row) => sum + (row.daily_target || 0), 0),
  monthly_target: rows.reduce((sum, row) => sum + (row.monthly_target || 0), 0),
  leads_today: rows.reduce((sum, row) => sum + (row.leads_today || 0), 0),
  leads_this_month: rows.reduce((sum, row) => sum + (row.leads_this_month || 0), 0),
  total_leads: rows.reduce((sum, row) => sum + (row.total_leads || 0), 0),
  total_followups: rows.reduce((sum, row) => sum + (row.total_followups || 0), 0),
  pending_followups: rows.reduce((sum, row) => sum + (row.pending_followups || 0), 0),
});

export default function EmployeeTasksView({ showToast }: EmployeeTasksViewProps) {
  const [activeTab, setActiveTab] = useState<RoleTab>('SM');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [employees, setEmployees] = useState<EmployeeLike[]>([]);
  const [employeeTasks, setEmployeeTasks] = useState<TaskLike[]>([]);
  const [leads, setLeads] = useState<any[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const loadData = async () => {
    try {
      setLoading(true);
      const [employeeList, taskList, leadList] = await Promise.all([
        fetchResourceList('employees').catch(() => []),
        fetchResourceList('employeeTasks').catch(() => []),
        fetchResourceList('leads').catch(() => []),
      ]);
      setEmployees(Array.isArray(employeeList) ? employeeList : []);
      setEmployeeTasks(Array.isArray(taskList) ? taskList : []);
      setLeads(Array.isArray(leadList) ? leadList : []);
    } catch (error) {
      console.error('Failed to load employee performance data:', error);
      showToast?.('danger', 'Failed to load employee performance data');
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

  const asmEmployees = useMemo(() => {
    const smId = String(smEmployee?.employee_id || '').toLowerCase().trim();
    const smName = String(smEmployee?.name || '').toLowerCase().trim();

    return employees.filter((employee) => {
      const reportsTo = String(employee.reports_to || '').toLowerCase().trim();
      const reportsToSm =
        Boolean(reportsTo) &&
        ((Boolean(smId) && reportsTo === smId) ||
          (Boolean(smName) && reportsTo === smName));

      return (
        /area sales manager/i.test(employee.designation || '') ||
        /office team lead/i.test(employee.designation || '') ||
        /^ASM/i.test(employee.employee_id || '') ||
        reportsToSm
      );
    });
  }, [employees, smEmployee]);

  const bdeEmployees = useMemo(() => {
    const asmIds = new Set(
      asmEmployees
        .map((asm) => String(asm.employee_id || '').toLowerCase().trim())
        .filter(Boolean)
    );
    const asmNames = new Set(
      asmEmployees
        .map((asm) => String(asm.name || '').toLowerCase().trim())
        .filter(Boolean)
    );

    return employees.filter((employee) => {
      const reportsTo = String(employee.reports_to || '').toLowerCase().trim();
      const reportsToAsm =
        Boolean(reportsTo) && (asmIds.has(reportsTo) || asmNames.has(reportsTo));

      return (
        /business development executive/i.test(employee.designation || '') ||
        /tele-?caller/i.test(employee.designation || '') ||
        /^BDE/i.test(employee.employee_id || '') ||
        /^TC/i.test(employee.employee_id || '') ||
        reportsToAsm
      );
    });
  }, [employees, asmEmployees]);

  // The SM owns the whole tree, so the SM summary reflects the SM's own leads
  // plus every ASM and BDE below them (the same scope the Sales Manager sees).
  const smScopeLeads = useMemo(() => {
    if (!smEmployee) return [];

    const asmIds = new Set(
      asmEmployees
        .map((asm) => String(asm.employee_id || '').toLowerCase().trim())
        .filter(Boolean)
    );

    return leads.filter((lead) => {
      if (leadMatchesEmployee(lead, smEmployee)) return true;
      if (
        lead.asm_id &&
        asmIds.has(String(lead.asm_id).toLowerCase().trim())
      ) {
        return true;
      }
      if (asmEmployees.some((asm) => leadMatchesEmployee(lead, asm))) return true;
      if (bdeEmployees.some((bde) => leadMatchesEmployee(lead, bde))) return true;
      return false;
    });
  }, [smEmployee, asmEmployees, bdeEmployees, leads]);

  const smMetrics = useMemo(
    () =>
      smEmployee
        ? buildPersonMetrics(smEmployee, smScopeLeads, employeeTasks)
        : null,
    [smEmployee, smScopeLeads, employeeTasks]
  );

  const asmRows = useMemo<PersonMetrics[]>(() => {
    return asmEmployees.map((asm) => {
      const teamBdes = bdeEmployees.filter(
        (bde) =>
          String(bde.reports_to || '').toLowerCase() ===
          String(asm.employee_id || '').toLowerCase()
      );

      const asmLeads = leads.filter((lead) => {
        if (
          String(lead.asm_id || '').toLowerCase() ===
          String(asm.employee_id || '').toLowerCase()
        ) {
          return true;
        }
        if (leadMatchesEmployee(lead, asm)) return true;
        if (teamBdes.some((bde) => leadMatchesEmployee(lead, bde))) return true;
        if (
          asm.team &&
          lead.team &&
          String(lead.team).toLowerCase() === String(asm.team).toLowerCase()
        ) {
          return true;
        }
        return false;
      });

      return {
        ...buildPersonMetrics(asm, asmLeads, employeeTasks),
        bdes_count: teamBdes.length,
        reports_to_name: smEmployee?.name || '—',
      };
    });
  }, [asmEmployees, bdeEmployees, leads, employeeTasks, smEmployee]);

  const bdeRows = useMemo<PersonMetrics[]>(() => {
    return bdeEmployees.map((bde) => {
      const bdeLeads = leads.filter((lead) => leadMatchesEmployee(lead, bde));
      const asm = employees.find(
        (employee) =>
          String(employee.employee_id || '').toLowerCase() ===
            String(bde.reports_to || '').toLowerCase() ||
          String(employee.name || '').toLowerCase() ===
            String(bde.reports_to || '').toLowerCase()
      );

      return {
        ...buildPersonMetrics(bde, bdeLeads, employeeTasks),
        reports_to_name: asm?.name || bde.reports_to || '—',
        team: bde.team || asm?.team || '—',
      };
    });
  }, [bdeEmployees, employees, leads, employeeTasks]);

  const activeMetrics = useMemo(() => {
    if (activeTab === 'SM') {
      return (
        smMetrics || {
          daily_target: 0,
          monthly_target: 0,
          leads_today: 0,
          leads_this_month: 0,
          total_leads: 0,
          total_followups: 0,
          pending_followups: 0,
        }
      );
    }
    return sumRows(activeTab === 'ASM' ? asmRows : bdeRows);
  }, [activeTab, smMetrics, asmRows, bdeRows]);

  const activeRows = activeTab === 'SM' ? asmRows : bdeRows;

  const filteredRows = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return activeRows;

    return activeRows.filter((row) => {
      const haystack = [
        row.name,
        row.employee_id,
        row.team,
        row.district,
        row.reports_to_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [activeRows, searchQuery]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredRows.slice(start, start + perPage);
  }, [filteredRows, currentPage, perPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  const tabs: Array<{
    key: RoleTab;
    label: string;
    title: string;
    icon: React.ElementType;
  }> = [
    { key: 'SM', label: 'SM', title: 'Sales Manager', icon: Shield },
    { key: 'ASM', label: 'ASM', title: 'Area Sales Manager', icon: Users },
    { key: 'BDE', label: 'BDE', title: 'Business Development Executive', icon: UserCheck },
  ];

  const tableTitle =
    activeTab === 'SM'
      ? 'ASM performance'
      : activeTab === 'ASM'
        ? 'BDE performance under ASMs'
        : 'BDE performance';

  const tableSubtitle =
    activeTab === 'SM'
      ? 'The same ASM data the Sales Manager sees, with targets, leads and follow-ups.'
      : activeTab === 'ASM'
        ? 'The same BDE data each ASM sees, with targets, leads and follow-ups.'
        : 'Individual BDE targets, leads and follow-up counts.';

  const emptyMessage =
    activeTab === 'SM'
      ? 'No ASMs yet. The Sales Manager creates ASMs from the SM app.'
      : activeTab === 'ASM'
        ? 'No BDEs yet. Each ASM creates BDEs from the ASM app.'
        : 'No BDEs yet. Once BDEs are created they appear here with their targets and follow-ups.';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted mb-1">
            <span>Performance</span>
            <span>&gt;</span>
            <span className="text-ink">Employee Tasks</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Employee Tasks</h1>
          <p className="text-xs text-muted mt-1">
            Daily and monthly targets, total leads, follow-ups and pending follow-ups for SM, ASM and BDE.
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

      {/* Role tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
        <div className="flex items-center gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                title={tab.title}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  isActive
                    ? 'bg-accent text-white border-accent shadow-sm'
                    : 'bg-surface text-muted border-line hover:bg-hover hover:text-ink'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <span className="text-[11px] text-muted">
          {tabs.find((tab) => tab.key === activeTab)?.title}
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4">
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Daily Target
            </span>
            <span className="p-1.5 rounded-lg bg-accent/10 text-accent">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{activeMetrics.daily_target}</span>
            <span className="text-xs text-muted">/ day</span>
          </div>
          <p className="text-[11px] text-muted mt-2">
            Achieved today: {activeMetrics.leads_today}
          </p>
        </div>

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
            <span className="text-2xl font-bold text-ink">{activeMetrics.monthly_target}</span>
            <span className="text-xs text-muted">/ month</span>
          </div>
          <p className="text-[11px] text-muted mt-2">
            Achieved this month: {activeMetrics.leads_this_month}
          </p>
        </div>

        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Total Leads
            </span>
            <span className="p-1.5 rounded-lg bg-accent/10 text-accent">
              <FileSpreadsheet className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{activeMetrics.total_leads}</span>
            <span className="text-xs text-muted">generated</span>
          </div>
          <p className="text-[11px] text-muted mt-2">All leads in this scope</p>
        </div>

        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Total Follow-ups
            </span>
            <span className="p-1.5 rounded-lg bg-accent/10 text-accent">
              <PhoneCall className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{activeMetrics.total_followups}</span>
            <span className="text-xs text-muted">recorded</span>
          </div>
          <p className="text-[11px] text-muted mt-2">Leads in follow-up status</p>
        </div>

        <div className="bg-surface border border-line rounded-xl p-4 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Pending Follow-ups
            </span>
            <span className="p-1.5 rounded-lg bg-warning/10 text-warning">
              <Hourglass className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">
              {activeMetrics.pending_followups}
            </span>
            <span className="text-xs text-muted">open</span>
          </div>
          <p className="text-[11px] text-muted mt-2">Still waiting for a follow-up</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-line">
          <div>
            <h2 className="text-sm font-bold text-ink">{tableTitle}</h2>
            <p className="text-[11px] text-muted mt-0.5">{tableSubtitle}</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={activeTab === 'SM' ? 'Search ASMs…' : 'Search BDEs…'}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-field border border-line rounded-lg text-xs text-ink placeholder-subtle focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <span className="text-xs text-muted whitespace-nowrap">
              Total: <strong className="text-ink">{filteredRows.length}</strong>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-muted font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">{activeTab === 'SM' ? 'ASM' : 'BDE'}</th>
                {activeTab !== 'SM' && <th className="py-3 px-4">ASM</th>}
                <th className="py-3 px-4">Daily target</th>
                <th className="py-3 px-4">Monthly target</th>
                <th className="py-3 px-4">Leads</th>
                <th className="py-3 px-4">Follow-ups</th>
                <th className="py-3 px-4">Pending</th>
                {activeTab === 'SM' && <th className="py-3 px-4">BDEs</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-2">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-accent" />
                      <span>Loading performance data…</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedRows.length > 0 ? (
                paginatedRows.map((row, index) => (
                  <tr
                    key={`${row.employee_id || row._id || row.name}-${index}`}
                    className="hover:bg-hover/60 transition"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-ink whitespace-nowrap">
                        {row.name || '—'}
                      </div>
                      <div className="text-[11px] text-muted font-mono whitespace-nowrap">
                        {row.employee_id || '—'}
                        {row.team ? ` · ${row.team}` : ''}
                      </div>
                    </td>
                    {activeTab !== 'SM' && (
                      <td className="py-3 px-4 text-muted whitespace-nowrap">
                        {row.reports_to_name || '—'}
                      </td>
                    )}
                    <td className="py-3 px-4 text-ink font-medium">
                      {row.daily_target || '—'}
                    </td>
                    <td className="py-3 px-4 text-ink font-medium">
                      {row.monthly_target || '—'}
                    </td>
                    <td className="py-3 px-4 text-ink">{row.total_leads}</td>
                    <td className="py-3 px-4 text-ink">{row.total_followups}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                          row.pending_followups > 0
                            ? 'bg-warning/10 text-warning border-warning/20'
                            : 'bg-success/10 text-success border-success/20'
                        }`}
                      >
                        {row.pending_followups > 0 ? (
                          <Hourglass className="w-3 h-3" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        {row.pending_followups}
                      </span>
                    </td>
                    {activeTab === 'SM' && (
                      <td className="py-3 px-4 text-muted">{row.bdes_count ?? 0}</td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-subtle"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          total={filteredRows.length}
          page={currentPage}
          perPage={perPage}
          onPageChange={setCurrentPage}
          onPerPageChange={setPerPage}
        />
      </div>

      {/* Scope note */}
      <div className="flex items-start gap-2 text-[11px] text-muted">
        <Target className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <p>
          Targets come from the existing EmployeeTask records. No new fields are created.
          The SM tab shows the ASM data the Sales Manager sees; the ASM tab shows the BDE data
          each ASM sees.
        </p>
      </div>
    </div>
  );
}
