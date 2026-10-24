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
  const totalPages = Math.ceil(filteredRecords.length / perPage) || 1;
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
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
          <span>Attendance Records</span>
          <span className="text-slate-500">&gt;</span>
          <span className="text-slate-300">List</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Attendance Records</h1>
      </div>

      {/* Main Table Container */}
      <div className="bg-[#0b1322] border border-[#1b263b] rounded-xl overflow-hidden shadow-xl">
        {/* Search Toolbar matching Screenshot 2 (Right aligned) */}
        <div className="p-4 flex items-center justify-end border-b border-[#1b263b]">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-[#080d1a] border border-slate-700/60 rounded-lg text-[13px] text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#09929e]"
            />
          </div>
        </div>

        {/* Table matching Screenshot 2 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1c283f] bg-[#0c1322] text-slate-300 font-semibold text-[13px]">
                <th
                  onClick={() => handleSort('name')}
                  className="py-3.5 px-6 cursor-pointer hover:text-white select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Employee Name</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('employee_id')}
                  className="py-3.5 px-6 cursor-pointer hover:text-white select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Employee ID</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('designation')}
                  className="py-3.5 px-6 cursor-pointer hover:text-white select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Designation</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('totalLogs')}
                  className="py-3.5 px-6 cursor-pointer hover:text-white select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Total Logs</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-6 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#172236] text-[13px]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-[#09929e]" />
                      <span>Loading attendance records...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedRecords.length > 0 ? (
                paginatedRecords.map((item) => (
                  <tr key={item.id} className="hover:bg-[#131c2e]/60 transition text-slate-200">
                    <td className="py-3.5 px-6 font-normal text-white">{item.name}</td>
                    <td className="py-3.5 px-6 text-slate-300">{item.employee_id}</td>
                    <td className="py-3.5 px-6 text-slate-300">
                      {item.designation}
                    </td>
                    <td className="py-3.5 px-6 text-slate-200">{item.totalLogs}</td>
                    <td className="py-3.5 px-6 text-right">
                      <button
                        onClick={() => setViewEmployee(item)}
                        className="inline-flex items-center gap-1.5 text-[13px] text-slate-300 hover:text-white transition cursor-pointer"
                      >
                        <Eye className="w-4 h-4 text-slate-400" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    No attendance records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#1c283f] flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] text-slate-400">
          <span>
            {filteredRecords.length > 0
              ? `Showing ${(currentPage - 1) * perPage + 1} to ${Math.min(
                  currentPage * perPage,
                  filteredRecords.length
                )} of ${filteredRecords.length} results`
              : 'Showing 0 results'}
          </span>

          <div className="flex items-center gap-2">
            <span>Per page</span>
            <div className="relative inline-block">
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="appearance-none bg-[#080d1a] border border-slate-700/80 rounded-lg pl-3 pr-8 py-1 text-white text-[13px] focus:outline-none focus:ring-1 focus:ring-[#09929e] cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* VIEW MODAL: Show all check-in logs for employee */}
      {viewEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#101728] border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-700/70 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Attendance Logs</h3>
                <p className="text-xs text-slate-400">
                  {viewEmployee.name} ({viewEmployee.employee_id || '—'}) - {viewEmployee.designation || 'Staff'}
                </p>
              </div>
              <button
                onClick={() => setViewEmployee(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
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
                      className="p-3 bg-[#080d1a] border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-white block mb-0.5">{log.date || 'Today'}</span>
                        <span className="text-slate-400">
                          {log.district || 'Ernakulam'} • {log.hours_worked || 8} hrs logged
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-300 font-mono block">
                          {log.check_in || '09:00 AM'} - {log.check_out || '06:00 PM'}
                        </span>
                        <span
                          className={`inline-block px-2 py-0.5 mt-1 rounded text-[10px] font-semibold ${
                            log.status === 'ONLINE'
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {log.status || 'ONLINE'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No detailed log entries found for this employee yet.
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 bg-[#0b1322] border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setViewEmployee(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition cursor-pointer"
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
