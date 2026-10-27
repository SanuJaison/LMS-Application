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
  const [records, setRecords] = useState<AttendanceSummaryItem[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [perPage, setPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sortField, setSortField] = useState<'name' | 'employee_id' | 'designation' | 'totalLogs' | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // View Modal state
  const [viewEmployee, setViewEmployee] = useState<AttendanceSummaryItem | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch employees and attendance logs from MongoDB Atlas
      const [employeesRes, logsRes] = await Promise.all([
        fetchResourceList('employees'),
        fetchResourceList('attendance'),
      ]);

      const emps = Array.isArray(employeesRes) ? employeesRes : [];
      const logs = Array.isArray(logsRes) ? logsRes : [];
      setAttendanceLogs(logs);

      // Aggregate total logs per employee
      const aggregated: AttendanceSummaryItem[] = emps.map((emp: any) => {
        const empName = emp.name || '';
        const empId = emp.employee_id || '';
        const count = logs.filter(
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

      setRecords(aggregated);
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

  // Filter & Sort (preserves MongoDB order by default: Aslam, Devika, Tony, Nabeel, Alpha, Meera, Shilpa, Arya)
  const filteredRecords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let res = records;

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
  }, [records, searchQuery, sortField, sortAsc]);

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
    return attendanceLogs.filter(
      (log) =>
        log.name?.toLowerCase().trim() === viewEmployee.name.toLowerCase().trim() ||
        (log.employee_id && log.employee_id.trim() === viewEmployee.employee_id.trim())
    );
  }, [viewEmployee, attendanceLogs]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Breadcrumb & Heading matching Screenshot 2 */}
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
        {/* Search Toolbar matching Screenshot 2 (Right aligned) */}
        <div className="p-4 flex items-center justify-end border-b border-line">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-field border border-line rounded-lg text-[13px] text-ink placeholder-subtle focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        {/* Table matching Screenshot 2 */}
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
                        onClick={() => setViewEmployee(item)}
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
            <div className="px-6 py-4 border-b border-line flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink">Attendance Logs</h3>
                <p className="text-xs text-muted">
                  {viewEmployee.name} ({viewEmployee.employee_id || '—'}) - {viewEmployee.designation || 'Staff'}
                </p>
              </div>
              <button
                onClick={() => setViewEmployee(null)}
                className="text-muted hover:text-ink p-1 rounded-lg hover:bg-active transition"
              >
                <X className="w-5 h-5" />
              </button>
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
                        <span className="font-semibold text-ink block mb-0.5">{log.date || 'Today'}</span>
                        <span className="text-muted">
                          {log.district || 'Ernakulam'} • {log.hours_worked || 8} hrs logged
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-ink/80 font-mono block">
                          {log.check_in || '09:00 AM'} - {log.check_out || '06:00 PM'}
                        </span>
                        <span
                          className={`inline-block px-2 py-0.5 mt-1 rounded text-[10px] font-semibold ${
                            log.status === 'ONLINE'
                              ? 'bg-success/10 text-success border border-success/30'
                              : 'bg-active text-muted border border-line'
                          }`}
                        >
                          {log.status || 'ONLINE'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-subtle text-xs">
                  No detailed log entries found for this employee yet.
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
