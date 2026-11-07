'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Eye,
  X,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { fetchResourceList } from '../../services/api';
import TablePagination from '@/components/ui/TablePagination';
import { buildMonthOptions, matchesMonthFilter } from '@/utils/dateFilters';

interface AttendanceSummaryItem {
  id: string;
  name: string;
  employee_id: string;
  designation: string;
  totalLogs: number;
}

interface AttendanceRecordsViewProps {
  showToast?: (type: 'success' | 'danger', message: string) => void;
}

export default function AttendanceRecordsView({ showToast }: AttendanceRecordsViewProps) {
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [designationFilter, setDesignationFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalMonthFilter, setModalMonthFilter] = useState<string>('all');

  const [perPage, setPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sortField, setSortField] = useState<'name' | 'employee_id' | 'designation' | 'totalLogs' | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // View Modal state
  const [viewEmployee, setViewEmployee] = useState<AttendanceSummaryItem | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [employeesRes, logsRes] = await Promise.all([
        fetchResourceList('employees'),
        fetchResourceList('attendance'),
      ]);

      const emps = Array.isArray(employeesRes) ? employeesRes : [];
      const logs = Array.isArray(logsRes) ? logsRes : [];
      setEmployeesList(emps);
      setAttendanceLogs(logs);
    } catch (err) {
      console.error('Failed to load attendance records:', err);
      showToast?.('danger', 'Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const monthOptions = useMemo(
    () =>
      buildMonthOptions(
        attendanceLogs.flatMap((l: any) => [l.date, l.createdAt, l.updatedAt])
      ),
    [attendanceLogs]
  );

  const designationOptions = useMemo(() => {
    const set = new Set<string>();
    employeesList.forEach((e: any) => {
      const d = (e.designation || '').trim();
      if (d) set.add(d);
    });
    return Array.from(set).sort();
  }, [employeesList]);

  // Filter attendance logs by selected month, date, and online/offline status
  const scopedLogs = useMemo(() => {
    return attendanceLogs.filter((log: any) => {
      if (monthFilter !== 'all' && !matchesMonthFilter(monthFilter, log.date, log.createdAt)) {
        return false;
      }
      if (dateFilter && String(log.date || '').slice(0, 10) !== dateFilter) {
        return false;
      }
      if (statusFilter === 'ONLINE' || statusFilter === 'OFFLINE') {
        if (String(log.status || '').toUpperCase() !== statusFilter) {
          return false;
        }
      }
      return true;
    });
  }, [attendanceLogs, monthFilter, dateFilter, statusFilter]);

  // Aggregate total logs per employee using scopedLogs
  const records = useMemo<AttendanceSummaryItem[]>(() => {
    return employeesList.map((emp: any) => {
      const empName = emp.name || '';
      const empId = emp.employee_id || '';
      const count = scopedLogs.filter(
        (log: any) =>
          log.name?.toLowerCase().trim() === empName.toLowerCase().trim() ||
          (log.employee_id && log.employee_id.trim() === empId.trim())
      ).length;

      return {
        id: (emp._id || emp.id || empName).toString(),
        name: empName,
        employee_id: empId || '',
        designation: emp.designation || '',
        totalLogs: count,
      };
    });
  }, [employeesList, scopedLogs]);

  const hasActiveFilters =
    monthFilter !== 'all' ||
    Boolean(dateFilter) ||
    designationFilter !== 'all' ||
    statusFilter !== 'all' ||
    Boolean(searchQuery.trim());

  const clearFilters = () => {
    setMonthFilter('all');
    setDateFilter('');
    setDesignationFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
    setCurrentPage(1);
  };

  // Filter & Sort
  const filteredRecords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let res = records;

    if (designationFilter !== 'all') {
      const target = designationFilter.toLowerCase();
      res = res.filter((r) => (r.designation || '').toLowerCase() === target);
    }

    if (statusFilter === 'with_logs' || statusFilter === 'ONLINE' || statusFilter === 'OFFLINE') {
      res = res.filter((r) => r.totalLogs > 0);
    } else if (statusFilter === 'no_logs') {
      res = res.filter((r) => r.totalLogs === 0);
    }

    if (q) {
      res = res.filter(
        (r) =>
          r.name?.toLowerCase().includes(q) ||
          r.employee_id?.toLowerCase().includes(q) ||
          r.designation?.toLowerCase().includes(q)
      );
    }

    if (!sortField) {
      return res;
    }

    return [...res].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'totalLogs') {
        cmp = a.totalLogs - b.totalLogs;
      } else {
        cmp = (a[sortField] || '').localeCompare(b[sortField] || '');
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [records, designationFilter, statusFilter, searchQuery, sortField, sortAsc]);

  // Pagination
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredRecords.slice(start, start + perPage);
  }, [filteredRecords, currentPage, perPage]);

  const handleSort = (field: 'name' | 'employee_id' | 'designation' | 'totalLogs') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Specific employee logs for View Modal
  const employeeLogs = useMemo(() => {
    if (!viewEmployee) return [];
    const activeModalMonth = modalMonthFilter !== 'all' ? modalMonthFilter : monthFilter;
    return attendanceLogs.filter((log) => {
      const sameEmp =
        log.name?.toLowerCase().trim() === viewEmployee.name.toLowerCase().trim() ||
        (log.employee_id && log.employee_id.trim() === viewEmployee.employee_id.trim());
      if (!sameEmp) return false;
      if (activeModalMonth !== 'all' && !matchesMonthFilter(activeModalMonth, log.date, log.createdAt)) {
        return false;
      }
      if (dateFilter && String(log.date || '').slice(0, 10) !== dateFilter) {
        return false;
      }
      return true;
    });
  }, [viewEmployee, attendanceLogs, modalMonthFilter, monthFilter, dateFilter]);

  const formatLogTime = (log: any) => {
    if (!log.check_in && !log.check_out) return '—';
    return `${log.check_in || '—'} - ${log.check_out || '—'}`;
  };

  const formatLogHours = (log: any) => {
    if (log.check_in && !log.check_out) return 'still checked in';
    if (!log.check_out) return '—';
    const hours = Number(log.hours_worked);
    return `${Number.isFinite(hours) ? hours : 0} hrs logged`;
  };

  const openEmployeeLogs = async (item: AttendanceSummaryItem) => {
    setModalMonthFilter(monthFilter);
    setViewEmployee(item);
    try {
      const logsRes = await fetchResourceList('attendance');
      if (Array.isArray(logsRes)) setAttendanceLogs(logsRes);
    } catch (err) {
      console.error('Failed to refresh attendance logs:', err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Breadcrumb & Heading */}
      <div>
        <div className="flex items-center gap-2 text-xs text-muted mb-1">
          <span>Attendance Records</span>
          <span className="text-subtle">&gt;</span>
          <span className="text-ink/80">List</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Attendance Records</h1>
      </div>

      {/* Main Table Container */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-xl">
        {/* Search & Filters Toolbar */}
        <div className="p-4 flex flex-col gap-3 border-b border-line">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={monthFilter}
                onChange={(e) => {
                  setMonthFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 bg-field border border-line rounded-lg text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
              >
                <option value="all">All Months</option>
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                title="Filter by specific date"
                className="px-3 py-1.5 bg-field border border-line rounded-lg text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
              />

              <select
                value={designationFilter}
                onChange={(e) => {
                  setDesignationFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 bg-field border border-line rounded-lg text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
              >
                <option value="all">All Designations</option>
                {designationOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 bg-field border border-line rounded-lg text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
              >
                <option value="all">All Log Statuses</option>
                <option value="with_logs">Has Logs (&gt; 0)</option>
                <option value="no_logs">No Logs (0)</option>
                <option value="ONLINE">Checked In (ONLINE)</option>
                <option value="OFFLINE">Checked Out (OFFLINE)</option>
              </select>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-hover hover:bg-active text-xs font-medium text-muted hover:text-ink border border-line transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search employee, ID, designation..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 bg-field border border-line rounded-lg text-[13px] text-ink placeholder-subtle focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-ink/80 font-semibold text-[13px]">
                <th
                  onClick={() => handleSort('name')}
                  className="py-3.5 px-6 cursor-pointer hover:text-ink select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Employee Name</span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('employee_id')}
                  className="py-3.5 px-6 cursor-pointer hover:text-ink select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Employee ID</span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('designation')}
                  className="py-3.5 px-6 cursor-pointer hover:text-ink select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Designation</span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('totalLogs')}
                  className="py-3.5 px-6 cursor-pointer hover:text-ink select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Total Logs</span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted" />
                  </div>
                </th>
                <th className="py-3.5 px-6 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-2 text-[13px]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-accent" />
                      <span>Loading attendance records...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedRecords.length > 0 ? (
                paginatedRecords.map((item) => (
                  <tr key={item.id} className="hover:bg-hover/60 transition text-ink">
                    <td className="py-3.5 px-6 font-normal text-ink">{item.name}</td>
                    <td className="py-3.5 px-6 text-ink/80">{item.employee_id}</td>
                    <td className="py-3.5 px-6 text-ink/80">
                      {item.designation}
                    </td>
                    <td className="py-3.5 px-6 text-ink">{item.totalLogs}</td>
                    <td className="py-3.5 px-6 text-right">
                      <button
                        onClick={() => openEmployeeLogs(item)}
                        className="inline-flex items-center gap-1.5 text-[13px] text-ink/80 hover:text-ink transition cursor-pointer"
                      >
                        <Eye className="w-4 h-4 text-muted" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-subtle">
                    No attendance records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <TablePagination
          total={filteredRecords.length}
          page={currentPage}
          perPage={perPage}
          onPageChange={setCurrentPage}
          onPerPageChange={setPerPage}
        />
      </div>

      {/* VIEW MODAL: Show all check-in logs for employee */}
      {viewEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-elevated border border-line rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-line flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-ink">Attendance Logs</h3>
                <p className="text-xs text-muted">
                  {viewEmployee.name} ({viewEmployee.employee_id || '—'}) - {viewEmployee.designation || 'Staff'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={modalMonthFilter}
                  onChange={(e) => setModalMonthFilter(e.target.value)}
                  className="px-2.5 py-1 bg-field border border-line rounded-lg text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
                >
                  <option value="all">All Months</option>
                  {monthOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setViewEmployee(null)}
                  className="text-muted hover:text-ink p-1 rounded-lg hover:bg-active transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
              {employeeLogs.length > 0 ? (
                <div className="space-y-2">
                  {employeeLogs.map((log: any, idx: number) => (
                    <div
                      key={log._id || log.id || idx}
                      className="p-3 bg-field border border-line rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-ink block mb-0.5">{log.date || '—'}</span>
                        <span className="text-muted">
                          {log.district || '—'} • {formatLogHours(log)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-ink/80 font-mono block">
                          {formatLogTime(log)}
                        </span>
                        <span
                          className={`inline-block px-2 py-0.5 mt-1 rounded text-[10px] font-semibold ${
                            log.status === 'ONLINE'
                              ? 'bg-success/10 text-success border border-success/30'
                              : 'bg-active text-muted border border-line'
                          }`}
                        >
                          {log.status || '—'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-subtle text-xs">
                  No detailed log entries found for this employee in the selected period.
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 bg-surface border-t border-line flex justify-end">
              <button
                onClick={() => setViewEmployee(null)}
                className="px-4 py-2 bg-active hover:bg-active text-ink/80 text-xs font-medium rounded-lg transition cursor-pointer"
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
