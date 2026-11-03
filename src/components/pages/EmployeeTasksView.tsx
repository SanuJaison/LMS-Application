'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Eye,
  X,
  Loader2,
  RefreshCw,
  Target,
  Calendar,
  Clock,
  Users,
  UserCheck,
  CheckCircle2,
  FileSpreadsheet,
  PhoneCall,
  Hourglass,
  IndianRupee,
  Shield,
  Layers,
  MapPin,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import {
  fetchResourceList,
  authHeaders,
} from '../../services/api';
import TablePagination from '@/components/ui/TablePagination';

interface EmployeeTasksViewProps {
  showToast?: (type: 'success' | 'danger', message: string) => void;
}

type RoleTab = 'SM' | 'ASM' | 'BDE';

export default function EmployeeTasksView({ showToast }: EmployeeTasksViewProps) {
  // Active Role Tab
  const [activeTab, setActiveTab] = useState<RoleTab>('SM');

  // Raw data from server
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [employees, setEmployees] = useState<any[]>([]);
  const [employeeTasks, setEmployeeTasks] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [asmsData, setAsmsData] = useState<any[]>([]);
  const [bdesData, setBdesData] = useState<any[]>([]);

  // Pagination & Modals
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(10);
  const [selectedAsmModal, setSelectedAsmModal] = useState<any | null>(null);
  const [selectedBdeModal, setSelectedBdeModal] = useState<any | null>(null);

  // Load all necessary data
  const loadData = async () => {
    try {
      setLoading(true);
      const [empRes, tasksRes, leadsRes] = await Promise.all([
        fetchResourceList('employees').catch(() => []),
        fetchResourceList('employeeTasks').catch(() => []),
        fetchResourceList('leads').catch(() => []),
      ]);

      const validEmployees = Array.isArray(empRes) ? empRes : [];
      const validTasks = Array.isArray(tasksRes) ? tasksRes : [];
      const validLeads = Array.isArray(leadsRes) ? leadsRes : [];

      setEmployees(validEmployees);
      setEmployeeTasks(validTasks);
      setLeads(validLeads);

      // Fetch ASM data from /api/sm/asms (includes daily/monthly target calculations)
      try {
        const asmRes = await fetch('/api/sm/asms', { headers: authHeaders() });
        if (asmRes.ok) {
          const asmJson = await asmRes.json();
          if (asmJson.success && Array.isArray(asmJson.data)) {
            setAsmsData(asmJson.data);
          }
        }
      } catch (err) {
        console.warn('Could not fetch /api/sm/asms directly:', err);
      }

      // Fetch BDE data from /api/asm/bdes (includes conversions & reports_to)
      try {
        const bdeRes = await fetch('/api/asm/bdes', { headers: authHeaders() });
        if (bdeRes.ok) {
          const bdeJson = await bdeRes.json();
          if (bdeJson.success && Array.isArray(bdeJson.data)) {
            setBdesData(bdeJson.data);
          }
        }
      } catch (err) {
        console.warn('Could not fetch /api/asm/bdes directly:', err);
      }
    } catch (err) {
      console.error('Failed to load employee tasks data:', err);
      showToast?.('danger', 'Failed to load employee tasks data');
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
  const currentMonthKey = todayIso.slice(0, 7);

  // Helper check functions
  const isLeadClosed = (l: any) => {
    const s = String(l.status || '').toLowerCase().trim();
    const adm = String(l.admission_status || '').toLowerCase().trim();
    return s === '4' || s === '5' || s === 'admitted' || s === 'closed' || s === 'won' || adm === 'admitted' || adm === 'closed' || adm === 'won';
  };

  const isFollowUpLead = (l: any) => {
    const s = String(l.status || '').toLowerCase().trim();
    const adm = String(l.admission_status || '').toLowerCase().trim();
    return adm === 'follow-up' || adm === 'interested' || s === '2' || s === '3' || (Array.isArray(l.followups) && l.followups.length > 0);
  };

  const isPendingFollowUpLead = (l: any) => {
    if (isLeadClosed(l)) return false;
    const s = String(l.status || '').toLowerCase().trim();
    const adm = String(l.admission_status || '').toLowerCase().trim();
    return adm === 'follow-up' || adm === 'interested' || s === '2' || s === '3' || Boolean(l.next_followup_date);
  };

  // 1. Identify SM
  const smEmployee = useMemo(() => {
    return employees.find(
      (e) =>
        e.designation?.toLowerCase() === 'sales manager' ||
        e.employee_id === 'SM001' ||
        /^SM/i.test(e.employee_id || '')
    );
  }, [employees]);

  // SM Specific Tasks
  const smTasks = useMemo(() => {
    if (!smEmployee) return [];
    return employeeTasks.filter(
      (t) =>
        t.employee_id === smEmployee.employee_id ||
        t.employee?.toLowerCase() === smEmployee.name?.toLowerCase() ||
        t.task_template?.toLowerCase().includes('sm target')
    );
  }, [employeeTasks, smEmployee]);

  // SM Targets & Stats
  const smDailyTargetRow = useMemo(() => {
    return smTasks.find(
      (t) =>
        t.task_template?.toLowerCase().includes('daily') ||
        t.period_start?.slice(0, 10) === todayIso
    );
  }, [smTasks, todayIso]);

  const smMonthlyTargetRow = useMemo(() => {
    return smTasks.find(
      (t) =>
        t.task_template?.toLowerCase().includes('monthly') ||
        t.period_start?.slice(0, 7) === currentMonthKey
    );
  }, [smTasks, currentMonthKey]);

  const smDailyTarget = smDailyTargetRow?.total_target ?? 15;
  const smDailyAchieved = leads.filter((l) => {
    const d = l.createdAt ? new Date(l.createdAt).toISOString().slice(0, 10) : '';
    return d === todayIso;
  }).length;

  const smMonthlyTarget =
    smMonthlyTargetRow?.total_target ??
    (smTasks.reduce((acc, t) => acc + (t.total_target || 0), 0) ||
      smDailyTarget * 26);

  const smMonthlyAchieved = leads.filter((l) => {
    const d = l.createdAt ? new Date(l.createdAt).toISOString().slice(0, 7) : '';
    return d === currentMonthKey;
  }).length;

  const smTotalLeads = leads.length;
  const smTotalFollowups = leads.filter(isFollowUpLead).length;
  const smTotalPendingFollowups = leads.filter(isPendingFollowUpLead).length;

  // 2. Build ASM List with combined data
  const processedAsms = useMemo(() => {
    const asmEmployees = employees.filter(
      (e) =>
        e.designation?.toLowerCase() === 'area sales manager' ||
        e.designation?.toLowerCase() === 'office team lead' ||
        /^ASM/i.test(e.employee_id || '')
    );

    return asmEmployees.map((asm) => {
      // Find matching entry from /api/sm/asms
      const apiAsm = asmsData.find(
        (a) => a.id === asm._id || a.employee_id === asm.employee_id
      );

      // Find BDEs reporting to this ASM
      const subordinates = employees.filter(
        (b) => String(b.reports_to || '') === String(asm.employee_id || '')
      );
      const subIds = new Set(subordinates.map((b) => b.employee_id?.toLowerCase()).filter(Boolean));
      const subNames = new Set(subordinates.map((b) => b.name?.toLowerCase().trim()).filter(Boolean));
      const asmIdLower = (asm.employee_id || '').toLowerCase();
      const asmNameLower = (asm.name || '').toLowerCase().trim();
      const asmTeamLower = (asm.team || '').toLowerCase().trim();

      // Find all leads in this ASM's subtree
      const asmLeads = leads.filter((l) => {
        const leadAsmId = String(l.asm_id || '').toLowerCase();
        if (leadAsmId && leadAsmId === asmIdLower) return true;
        const leadTeam = String(l.team || '').toLowerCase().trim();
        if (asmTeamLower && leadTeam && leadTeam === asmTeamLower) return true;
        const leadEmpId = String(l.employee_id || '').toLowerCase();
        if (leadEmpId && (leadEmpId === asmIdLower || subIds.has(leadEmpId))) return true;
        const leadEmpName = String(l.employee || '').toLowerCase().trim();
        if (leadEmpName && (leadEmpName === asmNameLower || subNames.has(leadEmpName))) return true;
        return false;
      });

      const totalLeads = asmLeads.length;
      const totalFollowups = asmLeads.filter(isFollowUpLead).length;
      const pendingFollowups = asmLeads.filter(isPendingFollowUpLead).length;
      const completedLeads = asmLeads.filter(isLeadClosed).length;

      // Targets: from API or calculated from leads
      const dailyTarget = apiAsm?.daily_target ?? (subordinates.length * 15 || 15);
      const dailyAchieved =
        apiAsm?.daily_achieved ??
        asmLeads.filter((l) => {
          const d = l.createdAt ? new Date(l.createdAt).toISOString().slice(0, 10) : '';
          return d === todayIso;
        }).length;

      const monthlyTarget = apiAsm?.monthly_target ?? dailyTarget * 26;
      const monthlyAchieved =
        apiAsm?.monthly_achieved ??
        asmLeads.filter((l) => {
          const d = l.createdAt ? new Date(l.createdAt).toISOString().slice(0, 7) : '';
          return d === currentMonthKey;
        }).length;

      return {
        _id: asm._id,
        id: asm.employee_id || asm._id,
        employee_id: asm.employee_id,
        name: asm.name,
        email: asm.email,
        contact_number: asm.contact_number,
        designation: asm.designation || 'Area Sales Manager',
        team: asm.team || apiAsm?.team || 'General Team',
        districts: apiAsm?.districts || (asm.district ? [asm.district] : []),
        bdes_count: subordinates.length || apiAsm?.bdes_count || 0,
        subordinates,
        salary: asm.salary ?? apiAsm?.salary ?? 0,
        incentive: asm.incentive ?? apiAsm?.incentive ?? 100,
        status: asm.status || 'active',

        daily_target: dailyTarget,
        daily_achieved: dailyAchieved,
        daily_pending: Math.max(0, dailyTarget - dailyAchieved),
        daily_percentage:
          dailyTarget > 0 ? Math.min(100, Math.round((dailyAchieved / dailyTarget) * 100)) : 0,

        monthly_target: monthlyTarget,
        monthly_achieved: monthlyAchieved,
        monthly_pending: Math.max(0, monthlyTarget - monthlyAchieved),
        monthly_percentage:
          monthlyTarget > 0 ? Math.min(100, Math.round((monthlyAchieved / monthlyTarget) * 100)) : 0,

        total_leads: totalLeads,
        total_followups: totalFollowups,
        pending_followups: pendingFollowups,
        completed_leads: completedLeads,
      };
    });
  }, [employees, asmsData, leads, todayIso, currentMonthKey]);

  // 3. Build BDE List with combined data
  const processedBdes = useMemo(() => {
    const bdeEmployees = employees.filter(
      (e) =>
        e.designation?.toLowerCase() === 'business development executive' ||
        e.designation?.toLowerCase() === 'tele-caller' ||
        e.designation?.toLowerCase() === 'telecaller' ||
        /^BDE/i.test(e.employee_id || '') ||
        /^TC/i.test(e.employee_id || '')
    );

    return bdeEmployees.map((bde) => {
      // Find matching entry from /api/asm/bdes
      const apiBde = bdesData.find(
        (b) => b.id === bde._id || b.employee_id === bde.employee_id
      );

      // Find ASM this BDE reports to
      const reportsToAsm = employees.find(
        (a) => a.employee_id === bde.reports_to || a.name?.toLowerCase() === bde.reports_to?.toLowerCase()
      );

      // Leads generated by this BDE
      const bdeLeads = leads.filter(
        (l) =>
          l.employee_id === bde.employee_id ||
          l.employee?.toLowerCase().trim() === bde.name?.toLowerCase().trim()
      );

      const totalLeads = bdeLeads.length;
      const totalFollowups = bdeLeads.filter(isFollowUpLead).length;
      const pendingFollowups = bdeLeads.filter(isPendingFollowUpLead).length;
      const admissions = bdeLeads.filter(isLeadClosed).length;
      const conversionRate = totalLeads > 0 ? Math.round((admissions / totalLeads) * 100) : 0;

      // Targets: from EmployeeTask or defaults
      const bdeDailyTask = employeeTasks.find(
        (t) =>
          (t.employee_id === bde.employee_id || t.employee?.toLowerCase() === bde.name?.toLowerCase()) &&
          (t.task_template?.toLowerCase().includes('daily') || t.period_start?.slice(0, 10) === todayIso)
      );

      const dailyTarget = bdeDailyTask?.total_target ?? 15;
      const dailyAchieved = bdeLeads.filter((l) => {
        const d = l.createdAt ? new Date(l.createdAt).toISOString().slice(0, 10) : '';
        return d === todayIso;
      }).length;

      const bdeMonthlyTask = employeeTasks.find(
        (t) =>
          (t.employee_id === bde.employee_id || t.employee?.toLowerCase() === bde.name?.toLowerCase()) &&
          (t.task_template?.toLowerCase().includes('monthly') || t.period_start?.slice(0, 7) === currentMonthKey)
      );

      const monthlyTarget = bdeMonthlyTask?.total_target ?? dailyTarget * 26;
      const monthlyAchieved = bdeLeads.filter((l) => {
        const d = l.createdAt ? new Date(l.createdAt).toISOString().slice(0, 7) : '';
        return d === currentMonthKey;
      }).length;

      return {
        _id: bde._id,
        id: bde.employee_id || bde._id,
        employee_id: bde.employee_id,
        name: bde.name,
        email: bde.email,
        contact_number: bde.contact_number,
        designation: bde.designation || 'Business Development Executive',
        reports_to: bde.reports_to || apiBde?.reports_to || '—',
        reports_to_name: reportsToAsm?.name || bde.reports_to || '—',
        team: bde.team || apiBde?.team || reportsToAsm?.team || '—',
        district: bde.district || apiBde?.district || '—',
        zone: bde.zone || apiBde?.zone || '—',
        salary: bde.salary ?? apiBde?.salary ?? 0,
        incentive: bde.incentive ?? apiBde?.incentive ?? 1000,
        status: bde.status || 'active',

        daily_target: dailyTarget,
        daily_achieved: dailyAchieved,
        daily_percentage:
          dailyTarget > 0 ? Math.min(100, Math.round((dailyAchieved / dailyTarget) * 100)) : 0,

        monthly_target: monthlyTarget,
        monthly_achieved: monthlyAchieved,
        monthly_percentage:
          monthlyTarget > 0 ? Math.min(100, Math.round((monthlyAchieved / monthlyTarget) * 100)) : 0,

        total_leads: totalLeads,
        total_followups: totalFollowups,
        pending_followups: pendingFollowups,
        admissions: admissions,
        conversion_rate: conversionRate,
      };
    });
  }, [employees, bdesData, leads, employeeTasks, todayIso, currentMonthKey]);

  // Compute Header Metric Cards based on Active Tab
  const activeTabMetrics = useMemo(() => {
    if (activeTab === 'SM') {
      return {
        dailyTarget: smDailyTarget,
        dailyAchieved: smDailyAchieved,
        monthlyTarget: smMonthlyTarget,
        monthlyAchieved: smMonthlyAchieved,
        totalLeads: smTotalLeads,
        totalFollowups: smTotalFollowups,
        totalPendingFollowups: smTotalPendingFollowups,
        entityCount: smEmployee ? 1 : 0,
        entityLabel: 'Sales Manager',
      };
    } else if (activeTab === 'ASM') {
      const dailyTargetSum = processedAsms.reduce((sum, a) => sum + (a.daily_target || 0), 0);
      const dailyAchievedSum = processedAsms.reduce((sum, a) => sum + (a.daily_achieved || 0), 0);
      const monthlyTargetSum = processedAsms.reduce((sum, a) => sum + (a.monthly_target || 0), 0);
      const monthlyAchievedSum = processedAsms.reduce((sum, a) => sum + (a.monthly_achieved || 0), 0);
      const totalLeadsSum = processedAsms.reduce((sum, a) => sum + (a.total_leads || 0), 0);
      const totalFollowupsSum = processedAsms.reduce((sum, a) => sum + (a.total_followups || 0), 0);
      const totalPendingSum = processedAsms.reduce((sum, a) => sum + (a.pending_followups || 0), 0);

      return {
        dailyTarget: dailyTargetSum,
        dailyAchieved: dailyAchievedSum,
        monthlyTarget: monthlyTargetSum,
        monthlyAchieved: monthlyAchievedSum,
        totalLeads: totalLeadsSum,
        totalFollowups: totalFollowupsSum,
        totalPendingFollowups: totalPendingSum,
        entityCount: processedAsms.length,
        entityLabel: 'Area Sales Managers',
      };
    } else {
      const dailyTargetSum = processedBdes.reduce((sum, b) => sum + (b.daily_target || 0), 0);
      const dailyAchievedSum = processedBdes.reduce((sum, b) => sum + (b.daily_achieved || 0), 0);
      const monthlyTargetSum = processedBdes.reduce((sum, b) => sum + (b.monthly_target || 0), 0);
      const monthlyAchievedSum = processedBdes.reduce((sum, b) => sum + (b.monthly_achieved || 0), 0);
      const totalLeadsSum = processedBdes.reduce((sum, b) => sum + (b.total_leads || 0), 0);
      const totalFollowupsSum = processedBdes.reduce((sum, b) => sum + (b.total_followups || 0), 0);
      const totalPendingSum = processedBdes.reduce((sum, b) => sum + (b.pending_followups || 0), 0);

      return {
        dailyTarget: dailyTargetSum,
        dailyAchieved: dailyAchievedSum,
        monthlyTarget: monthlyTargetSum,
        monthlyAchieved: monthlyAchievedSum,
        totalLeads: totalLeadsSum,
        totalFollowups: totalFollowupsSum,
        totalPendingFollowups: totalPendingSum,
        entityCount: processedBdes.length,
        entityLabel: 'Business Development Executives',
      };
    }
  }, [
    activeTab,
    smDailyTarget,
    smDailyAchieved,
    smMonthlyTarget,
    smMonthlyAchieved,
    smTotalLeads,
    smTotalFollowups,
    smTotalPendingFollowups,
    smEmployee,
    processedAsms,
    processedBdes,
  ]);

  // Filter Active Tab Lists with search
  const filteredAsms = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return processedAsms;
    return processedAsms.filter(
      (a) =>
        a.name?.toLowerCase().includes(q) ||
        a.employee_id?.toLowerCase().includes(q) ||
        a.team?.toLowerCase().includes(q) ||
        a.districts?.some((d: string) => d.toLowerCase().includes(q))
    );
  }, [processedAsms, searchQuery]);

  const filteredBdes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return processedBdes;
    return processedBdes.filter(
      (b) =>
        b.name?.toLowerCase().includes(q) ||
        b.employee_id?.toLowerCase().includes(q) ||
        b.team?.toLowerCase().includes(q) ||
        b.district?.toLowerCase().includes(q) ||
        b.reports_to_name?.toLowerCase().includes(q)
    );
  }, [processedBdes, searchQuery]);

  // Paginated data for ASM and BDE
  const paginatedAsms = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredAsms.slice(start, start + perPage);
  }, [filteredAsms, currentPage, perPage]);

  const paginatedBdes = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredBdes.slice(start, start + perPage);
  }, [filteredBdes, currentPage, perPage]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/50">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-ink">Employee Tasks & Performance</h1>
              <p className="text-sm text-muted">
                Track daily & monthly targets, leads generated, and follow-ups across SM, ASM, and BDE tiers
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
        </div>
      </div>

      {/* 3 Role Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-1">
        <button
          type="button"
          onClick={() => {
            setActiveTab('SM');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
            activeTab === 'SM'
              ? 'bg-primary text-white shadow-lg shadow-primary/25'
              : 'text-muted hover:text-ink hover:bg-hover'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Sales Manager (SM)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-mono ${
              activeTab === 'SM' ? 'bg-white/20 text-white' : 'bg-surface border border-border text-muted'
            }`}
          >
            {smEmployee ? 1 : 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('ASM');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
            activeTab === 'ASM'
              ? 'bg-primary text-white shadow-lg shadow-primary/25'
              : 'text-muted hover:text-ink hover:bg-hover'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Area Sales Managers (ASM)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-mono ${
              activeTab === 'ASM' ? 'bg-white/20 text-white' : 'bg-surface border border-border text-muted'
            }`}
          >
            {processedAsms.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('BDE');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
            activeTab === 'BDE'
              ? 'bg-primary text-white shadow-lg shadow-primary/25'
              : 'text-muted hover:text-ink hover:bg-hover'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Business Development Executives (BDE)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-mono ${
              activeTab === 'BDE' ? 'bg-white/20 text-white' : 'bg-surface border border-border text-muted'
            }`}
          >
            {processedBdes.length}
          </span>
        </button>
      </div>

      {/* Top 5 Summary Metrics Cards for Active Tab */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Daily Targets */}
        <div className="p-4 rounded-xl bg-surface border border-border/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Daily Targets (Today)
            </span>
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{activeTabMetrics.dailyAchieved}</span>
            <span className="text-sm text-muted">/ {activeTabMetrics.dailyTarget}</span>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted mb-1">
              <span>Progress</span>
              <span className="font-semibold text-ink">
                {activeTabMetrics.dailyTarget > 0
                  ? Math.min(100, Math.round((activeTabMetrics.dailyAchieved / activeTabMetrics.dailyTarget) * 100))
                  : 0}
                %
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{
                  width: `${
                    activeTabMetrics.dailyTarget > 0
                      ? Math.min(100, Math.round((activeTabMetrics.dailyAchieved / activeTabMetrics.dailyTarget) * 100))
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Monthly Targets */}
        <div className="p-4 rounded-xl bg-surface border border-border/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Monthly Targets
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{activeTabMetrics.monthlyAchieved}</span>
            <span className="text-sm text-muted">/ {activeTabMetrics.monthlyTarget}</span>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted mb-1">
              <span>Progress</span>
              <span className="font-semibold text-emerald-400">
                {activeTabMetrics.monthlyTarget > 0
                  ? Math.min(100, Math.round((activeTabMetrics.monthlyAchieved / activeTabMetrics.monthlyTarget) * 100))
                  : 0}
                %
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{
                  width: `${
                    activeTabMetrics.monthlyTarget > 0
                      ? Math.min(100, Math.round((activeTabMetrics.monthlyAchieved / activeTabMetrics.monthlyTarget) * 100))
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Total Leads Generated */}
        <div className="p-4 rounded-xl bg-surface border border-border/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Leads Generated
            </span>
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <FileSpreadsheet className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{activeTabMetrics.totalLeads}</span>
            <span className="text-xs text-muted">Total</span>
          </div>
          <p className="text-[11px] text-muted mt-3">
            {activeTab === 'SM' ? 'Statewide Leads' : activeTab === 'ASM' ? 'Across All ASM Teams' : 'Across All BDEs'}
          </p>
        </div>

        {/* Total Follow-ups */}
        <div className="p-4 rounded-xl bg-surface border border-border/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Total Follow-ups
            </span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <PhoneCall className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{activeTabMetrics.totalFollowups}</span>
            <span className="text-xs text-muted">Calls / Follow-ups</span>
          </div>
          <p className="text-[11px] text-muted mt-3">Active interactions logged</p>
        </div>

        {/* Total Pending Follow-ups */}
        <div className="p-4 rounded-xl bg-surface border border-border/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Pending Follow-ups
            </span>
            <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
              <Hourglass className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-400">
              {activeTabMetrics.totalPendingFollowups}
            </span>
            <span className="text-xs text-muted">Due</span>
          </div>
          <p className="text-[11px] text-muted mt-3">Requires executive action</p>
        </div>
      </div>

      {/* Search Bar for ASM / BDE */}
      {activeTab !== 'SM' && (
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={`Search ${activeTab === 'ASM' ? 'ASMs by name, ID, team, district...' : 'BDEs by name, ID, team, reporting ASM...'}`}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-surface border border-border text-ink placeholder:text-muted focus:outline-none focus:border-primary text-xs"
            />
          </div>
          <span className="text-xs text-muted font-medium">
            Showing {activeTab === 'ASM' ? filteredAsms.length : filteredBdes.length} {activeTab}s
          </span>
        </div>
      )}

      {/* TAB CONTENT: 1. SALES MANAGER (SM) */}
      {activeTab === 'SM' && (
        <div className="space-y-6">
          {smEmployee ? (
            <div className="p-6 rounded-2xl bg-surface border border-border/60">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-border/50">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-primary/25">
                    {smEmployee.name?.charAt(0)?.toUpperCase() || 'S'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-bold text-ink">{smEmployee.name}</h2>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-primary border border-primary/30">
                        Sales Manager
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-mono bg-surface border border-border text-muted">
                        {smEmployee.employee_id || 'SM001'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-1.5">
                      {smEmployee.email || 'sm@kidecrm.com'} • {smEmployee.contact_number || '+91 9746543243'} • Overall Head of Kerala Sales Operations
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="px-4 py-2.5 rounded-xl bg-[#1e293b]/50 border border-border">
                    <span className="text-[11px] uppercase tracking-wider text-muted font-medium block">
                      Monthly Salary
                    </span>
                    <span className="text-base font-bold text-ink flex items-center">
                      <IndianRupee className="w-3.5 h-3.5" />
                      {Number(smEmployee.salary || 0).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="px-4 py-2.5 rounded-xl bg-[#1e293b]/50 border border-border">
                    <span className="text-[11px] uppercase tracking-wider text-muted font-medium block">
                      Incentive / Admission
                    </span>
                    <span className="text-base font-bold text-emerald-400 flex items-center">
                      <IndianRupee className="w-3.5 h-3.5" />
                      {Number(smEmployee.incentive || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* SM Detailed Operational Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
                <div className="p-4 rounded-xl bg-[#1e293b]/40 border border-border/50">
                  <span className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
                    Daily Target Breakdown
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-bold text-ink">
                      {smDailyAchieved} / {smDailyTarget} Achieved
                    </span>
                    <span className="text-xs font-semibold text-primary">
                      {smDailyTarget > 0 ? Math.round((smDailyAchieved / smDailyTarget) * 100) : 0}%
                    </span>
                  </div>
                  <p className="text-[11px] text-muted mt-2">
                    Pending for today: {Math.max(0, smDailyTarget - smDailyAchieved)}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#1e293b]/40 border border-border/50">
                  <span className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
                    Monthly Target Breakdown
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-bold text-ink">
                      {smMonthlyAchieved} / {smMonthlyTarget} Achieved
                    </span>
                    <span className="text-xs font-semibold text-emerald-400">
                      {smMonthlyTarget > 0 ? Math.round((smMonthlyAchieved / smMonthlyTarget) * 100) : 0}%
                    </span>
                  </div>
                  <p className="text-[11px] text-muted mt-2">
                    Pending for {currentMonthKey}: {Math.max(0, smMonthlyTarget - smMonthlyAchieved)}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#1e293b]/40 border border-border/50">
                  <span className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
                    Follow-ups Ratio
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-bold text-amber-400">
                      {smTotalFollowups} Total / {smTotalPendingFollowups} Pending
                    </span>
                    <span className="text-xs font-semibold text-rose-400">
                      {smTotalLeads > 0 ? Math.round((smTotalPendingFollowups / smTotalLeads) * 100) : 0}%
                    </span>
                  </div>
                  <p className="text-[11px] text-muted mt-2">
                    Active pending follow-ups out of {smTotalLeads} total leads
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-surface border border-border rounded-2xl text-muted">
              <Shield className="w-12 h-12 mx-auto text-muted/30 mb-2" />
              <p className="font-semibold text-ink">No Sales Manager Found</p>
              <p className="text-xs text-muted mt-1">Please create a Sales Manager in the Employees section.</p>
            </div>
          )}

          {/* SM Targets Table */}
          <div className="rounded-2xl bg-surface border border-border/60 overflow-hidden">
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink">Assigned Targets & Task Records for SM</h3>
                <p className="text-xs text-muted">Daily & monthly targets assigned to the Sales Manager</p>
              </div>
              <span className="text-xs font-medium text-muted bg-surface/80 border border-border px-2.5 py-1 rounded-lg">
                {smTasks.length} {smTasks.length === 1 ? 'Record' : 'Records'}
              </span>
            </div>

            {smTasks.length === 0 ? (
              <div className="p-8 text-center text-muted text-xs">
                No custom target tasks assigned yet for SM. You can assign targets under the <strong>SM Targets</strong> section in the sidebar.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#1e293b]/70 border-b border-border text-muted font-semibold">
                    <tr>
                      <th className="py-3 px-4">Task / Target</th>
                      <th className="py-3 px-4">Period</th>
                      <th className="py-3 px-4">Metric</th>
                      <th className="py-3 px-4">Target</th>
                      <th className="py-3 px-4">Achieved</th>
                      <th className="py-3 px-4">Progress</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 text-ink">
                    {smTasks.map((t) => {
                      const id = (t._id || t.id) as string;
                      const isDaily = t.task_template?.toLowerCase().includes('daily');
                      const targetCount = t.total_target || 15;
                      const achievedCount = t.achieved || 0;
                      const pct = targetCount > 0 ? Math.min(100, Math.round((achievedCount / targetCount) * 100)) : 0;

                      return (
                        <tr key={id} className="hover:bg-hover/40 transition">
                          <td className="py-3.5 px-4 font-semibold text-ink flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${isDaily ? 'bg-primary' : 'bg-emerald-400'}`} />
                            {t.task_template || 'SM Target'}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-muted">
                            {t.period_start} {t.period_end && t.period_end !== t.period_start ? `→ ${t.period_end}` : ''}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-md bg-surface border border-border text-muted">
                              {t.metric_type || 'Leads Generated'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-ink">{targetCount}</td>
                          <td className="py-3.5 px-4 font-bold text-emerald-400">{achievedCount}</td>
                          <td className="py-3.5 px-4 min-w-[120px]">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-400' : 'bg-primary'}`}
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
                          <td className="py-3.5 px-4 text-muted max-w-[200px] truncate">{t.notes || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: 2. AREA SALES MANAGERS (ASM) */}
      {activeTab === 'ASM' && (
        <div className="rounded-2xl bg-surface border border-border/60 overflow-hidden">
          <div className="p-4 border-b border-border/50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-ink">Area Sales Managers (ASM)</h3>
              <p className="text-xs text-muted">
                Showing all ASM performance data visible to the Sales Manager (Teams, Targets, Leads & Follow-ups)
              </p>
            </div>
            <span className="text-xs font-medium text-muted bg-surface/80 border border-border px-2.5 py-1 rounded-lg">
              {filteredAsms.length} {filteredAsms.length === 1 ? 'ASM' : 'ASMs'}
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted mt-3">Loading ASM performance data...</p>
            </div>
          ) : filteredAsms.length === 0 ? (
            <div className="p-12 text-center text-muted">
              <Users className="w-10 h-10 mx-auto text-muted/40 mb-2" />
              <p className="text-sm font-medium">No Area Sales Managers Found</p>
              <p className="text-xs text-muted/80 mt-1">
                ASMs are created by the Sales Manager from the mobile application.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#1e293b]/70 border-b border-border text-muted font-semibold">
                  <tr>
                    <th className="py-3 px-4">ASM Employee</th>
                    <th className="py-3 px-4">Team & Districts</th>
                    <th className="py-3 px-4">Team Size</th>
                    <th className="py-3 px-4">Daily Targets</th>
                    <th className="py-3 px-4">Monthly Targets</th>
                    <th className="py-3 px-4">Total Leads</th>
                    <th className="py-3 px-4">Follow-ups</th>
                    <th className="py-3 px-4">Pending</th>
                    <th className="py-3 px-4">Admissions</th>
                    <th className="py-3 px-4">Salary & Incentive</th>
                    <th className="py-3 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 text-ink">
                  {paginatedAsms.map((asm) => {
                    return (
                      <tr key={asm.id} className="hover:bg-hover/40 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-ink">{asm.name}</div>
                          <div className="text-[11px] text-muted font-mono">{asm.employee_id}</div>
                          <div className="text-[11px] text-muted">{asm.contact_number || asm.email}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                            {asm.team}
                          </span>
                          <div className="text-[11px] text-muted mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-muted/70 flex-shrink-0" />
                            <span className="truncate max-w-[150px]">
                              {Array.isArray(asm.districts) && asm.districts.length > 0
                                ? asm.districts.join(', ')
                                : 'All Team Districts'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-surface border border-border text-ink">
                            {asm.bdes_count} BDE{asm.bdes_count === 1 ? '' : 's'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 min-w-[110px]">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-bold text-ink">
                              {asm.daily_achieved} / {asm.daily_target}
                            </span>
                            <span className="font-semibold text-primary">{asm.daily_percentage}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${asm.daily_percentage}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-3.5 px-4 min-w-[110px]">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-bold text-ink">
                              {asm.monthly_achieved} / {asm.monthly_target}
                            </span>
                            <span className="font-semibold text-emerald-400">{asm.monthly_percentage}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${asm.monthly_percentage}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-ink">{asm.total_leads}</td>
                        <td className="py-3.5 px-4 font-bold text-amber-400">{asm.total_followups}</td>
                        <td className="py-3.5 px-4 font-bold text-rose-400">{asm.pending_followups}</td>
                        <td className="py-3.5 px-4 font-bold text-emerald-400">{asm.completed_leads}</td>
                        <td className="py-3.5 px-4">
                          <div className="text-[11px] text-ink font-semibold flex items-center">
                            <IndianRupee className="w-3 h-3" />
                            {Number(asm.salary || 0).toLocaleString('en-IN')}
                          </div>
                          <div className="text-[10px] text-emerald-400 flex items-center">
                            +₹{Number(asm.incentive || 0)} / close
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedAsmModal(asm)}
                            className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition cursor-pointer"
                            title="View ASM Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filteredAsms.length > 0 && (
            <div className="p-4 border-t border-border/50">
              <TablePagination
                page={currentPage}
                perPage={perPage}
                total={filteredAsms.length}
                onPageChange={setCurrentPage}
                onPerPageChange={(n) => {
                  setPerPage(n);
                  setCurrentPage(1);
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: 3. BUSINESS DEVELOPMENT EXECUTIVES (BDE) */}
      {activeTab === 'BDE' && (
        <div className="rounded-2xl bg-surface border border-border/60 overflow-hidden">
          <div className="p-4 border-b border-border/50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-ink">Business Development Executives (BDE)</h3>
              <p className="text-xs text-muted">
                Showing all BDE performance data visible to Area Sales Managers (Reports To, Leads, Targets & Follow-ups)
              </p>
            </div>
            <span className="text-xs font-medium text-muted bg-surface/80 border border-border px-2.5 py-1 rounded-lg">
              {filteredBdes.length} {filteredBdes.length === 1 ? 'BDE' : 'BDEs'}
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted mt-3">Loading BDE performance data...</p>
            </div>
          ) : filteredBdes.length === 0 ? (
            <div className="p-12 text-center text-muted">
              <UserCheck className="w-10 h-10 mx-auto text-muted/40 mb-2" />
              <p className="text-sm font-medium">No BDEs Found</p>
              <p className="text-xs text-muted/80 mt-1">
                BDEs are created by Area Sales Managers from the mobile application.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#1e293b]/70 border-b border-border text-muted font-semibold">
                  <tr>
                    <th className="py-3 px-4">BDE Employee</th>
                    <th className="py-3 px-4">Reports To (ASM)</th>
                    <th className="py-3 px-4">Team & District</th>
                    <th className="py-3 px-4">Daily Targets</th>
                    <th className="py-3 px-4">Monthly Targets</th>
                    <th className="py-3 px-4">Leads Generated</th>
                    <th className="py-3 px-4">Follow-ups</th>
                    <th className="py-3 px-4">Pending</th>
                    <th className="py-3 px-4">Admissions</th>
                    <th className="py-3 px-4">Conversion</th>
                    <th className="py-3 px-4">Salary & Incentive</th>
                    <th className="py-3 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 text-ink">
                  {paginatedBdes.map((bde) => {
                    return (
                      <tr key={bde.id} className="hover:bg-hover/40 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-ink">{bde.name}</div>
                          <div className="text-[11px] text-muted font-mono">{bde.employee_id}</div>
                          <div className="text-[11px] text-muted">{bde.contact_number || bde.email}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-surface border border-border text-ink">
                            {bde.reports_to_name}
                          </span>
                          <div className="text-[10px] text-muted font-mono mt-0.5">{bde.reports_to}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-[11px] font-medium text-ink">{bde.team}</div>
                          <div className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-muted/70 flex-shrink-0" />
                            <span>{bde.district}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 min-w-[100px]">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-bold text-ink">
                              {bde.daily_achieved} / {bde.daily_target}
                            </span>
                            <span className="font-semibold text-primary">{bde.daily_percentage}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${bde.daily_percentage}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-3.5 px-4 min-w-[100px]">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-bold text-ink">
                              {bde.monthly_achieved} / {bde.monthly_target}
                            </span>
                            <span className="font-semibold text-emerald-400">{bde.monthly_percentage}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${bde.monthly_percentage}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-ink">{bde.total_leads}</td>
                        <td className="py-3.5 px-4 font-bold text-amber-400">{bde.total_followups}</td>
                        <td className="py-3.5 px-4 font-bold text-rose-400">{bde.pending_followups}</td>
                        <td className="py-3.5 px-4 font-bold text-emerald-400">{bde.admissions}</td>
                        <td className="py-3.5 px-4 font-semibold text-ink">{bde.conversion_rate}%</td>
                        <td className="py-3.5 px-4">
                          <div className="text-[11px] text-ink font-semibold flex items-center">
                            <IndianRupee className="w-3 h-3" />
                            {Number(bde.salary || 0).toLocaleString('en-IN')}
                          </div>
                          <div className="text-[10px] text-emerald-400 flex items-center">
                            +₹{Number(bde.incentive || 0)} / close
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedBdeModal(bde)}
                            className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition cursor-pointer"
                            title="View BDE Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filteredBdes.length > 0 && (
            <div className="p-4 border-t border-border/50">
              <TablePagination
                page={currentPage}
                perPage={perPage}
                total={filteredBdes.length}
                onPageChange={setCurrentPage}
                onPerPageChange={(n) => {
                  setPerPage(n);
                  setCurrentPage(1);
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* ASM Details Modal */}
      {selectedAsmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-ink text-sm">ASM Profile & Subordinate Team</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAsmModal(null)}
                className="p-1 rounded-lg text-muted hover:text-ink hover:bg-hover transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#1e293b]/50 border border-border">
                <div>
                  <h4 className="font-bold text-ink text-sm">{selectedAsmModal.name}</h4>
                  <p className="text-muted font-mono">{selectedAsmModal.employee_id} • {selectedAsmModal.team}</p>
                  <p className="text-muted">{selectedAsmModal.email || 'asm@kidecrm.com'} • {selectedAsmModal.contact_number}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-muted block">Salary & Incentive</span>
                  <span className="font-bold text-ink">₹{Number(selectedAsmModal.salary).toLocaleString('en-IN')}</span>
                  <span className="text-emerald-400 block text-[11px]">+₹{selectedAsmModal.incentive} / close</span>
                </div>
              </div>

              <div>
                <h5 className="font-semibold text-muted uppercase tracking-wider mb-2">Assigned Districts</h5>
                <div className="flex flex-wrap gap-1.5">
                  {Array.isArray(selectedAsmModal.districts) && selectedAsmModal.districts.length > 0 ? (
                    selectedAsmModal.districts.map((d: string) => (
                      <span key={d} className="px-2.5 py-1 rounded-lg bg-surface border border-border text-ink font-medium">
                        {d}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted">All Team Districts Assigned</span>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-semibold text-muted uppercase tracking-wider">Subordinate BDEs</h5>
                  <span className="text-muted font-mono">{selectedAsmModal.subordinates?.length || 0} Executives</span>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {selectedAsmModal.subordinates && selectedAsmModal.subordinates.length > 0 ? (
                    selectedAsmModal.subordinates.map((sub: any) => (
                      <div key={sub._id || sub.employee_id} className="p-2 rounded-lg bg-hover/40 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-ink">{sub.name}</span>
                          <span className="text-muted font-mono ml-2">({sub.employee_id})</span>
                        </div>
                        <span className="text-muted">{sub.district || 'District'}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted text-center py-3">No BDEs created under this ASM yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end p-4 border-t border-border bg-[#1e293b]/40">
              <button
                type="button"
                onClick={() => setSelectedAsmModal(null)}
                className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BDE Details Modal */}
      {selectedBdeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-ink text-sm">BDE Performance Overview</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBdeModal(null)}
                className="p-1 rounded-lg text-muted hover:text-ink hover:bg-hover transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-[#1e293b]/50 border border-border">
                <h4 className="font-bold text-ink text-sm">{selectedBdeModal.name}</h4>
                <p className="text-muted font-mono">{selectedBdeModal.employee_id} • {selectedBdeModal.designation}</p>
                <p className="text-muted mt-1">Reports to ASM: <strong>{selectedBdeModal.reports_to_name}</strong> ({selectedBdeModal.reports_to})</p>
                <p className="text-muted">Assigned: {selectedBdeModal.team} • {selectedBdeModal.district}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-surface border border-border text-center">
                  <span className="text-[10px] uppercase text-muted block mb-1">Total Leads</span>
                  <span className="text-lg font-bold text-ink">{selectedBdeModal.total_leads}</span>
                </div>
                <div className="p-3 rounded-xl bg-surface border border-border text-center">
                  <span className="text-[10px] uppercase text-muted block mb-1">Admissions Closed</span>
                  <span className="text-lg font-bold text-emerald-400">{selectedBdeModal.admissions}</span>
                </div>
                <div className="p-3 rounded-xl bg-surface border border-border text-center">
                  <span className="text-[10px] uppercase text-muted block mb-1">Total Follow-ups</span>
                  <span className="text-lg font-bold text-amber-400">{selectedBdeModal.total_followups}</span>
                </div>
                <div className="p-3 rounded-xl bg-surface border border-border text-center">
                  <span className="text-[10px] uppercase text-muted block mb-1">Pending Follow-ups</span>
                  <span className="text-lg font-bold text-rose-400">{selectedBdeModal.pending_followups}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#1e293b]/40 border border-border flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase text-muted block">Compensation</span>
                  <span className="font-bold text-ink">Salary: ₹{Number(selectedBdeModal.salary).toLocaleString('en-IN')}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-muted block">Per Admission Close</span>
                  <span className="font-bold text-emerald-400">+₹{Number(selectedBdeModal.incentive)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end p-4 border-t border-border bg-[#1e293b]/40">
              <button
                type="button"
                onClick={() => setSelectedBdeModal(null)}
                className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
