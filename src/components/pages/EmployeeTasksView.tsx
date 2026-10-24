'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Eye,
  X,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import {
  fetchResourceList,
  updateResourceItem,
} from '../../services/api';

export interface EmployeeTaskItem {
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

interface EmployeeTasksViewProps {
  showToast?: (type: 'success' | 'danger', message: string) => void;
}

export default function EmployeeTasksView({ showToast }: EmployeeTasksViewProps) {
  // Data State
  const [tasks, setTasks] = useState<EmployeeTaskItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Table controls
  const [perPage, setPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Modals state
  const [viewModalItem, setViewModalItem] = useState<EmployeeTaskItem | null>(null);
  const [isUpdatingAchieved, setIsUpdatingAchieved] = useState<boolean>(false);
  const [editAchievedVal, setEditAchievedVal] = useState<number>(0);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchResourceList('employeeTasks');
      setTasks(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to load employee tasks:', err);
      showToast?.('danger', 'Failed to load employee tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const rowId = (item: EmployeeTaskItem) => (item._id || item.id || '').toString();

  // Filtered & Sorted (preserves server order by default: Aug 18 first, Aug 19 second)
  const filteredTasks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let result = tasks;

    if (q) {
      result = result.filter(
        (t) =>
          t.employee?.toLowerCase().includes(q) ||
          t.task_template?.toLowerCase().includes(q) ||
          t.period_start?.toLowerCase().includes(q) ||
          t.period_end?.toLowerCase().includes(q)
      );
    }

    if (!sortField) {
      return result;
    }

    return [...result].sort((a: any, b: any) => {
      const valA = a[sortField] ?? '';
      const valB = b[sortField] ?? '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [tasks, searchQuery, sortField, sortAsc]);

  // Pagination
  const totalPages = Math.ceil(filteredTasks.length / perPage) || 1;
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredTasks.slice(start, start + perPage);
  }, [filteredTasks, currentPage, perPage]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Open View Modal
  const openViewModal = (item: EmployeeTaskItem) => {
    setViewModalItem(item);
    setEditAchievedVal(item.achieved || 0);
  };

  // Quick increment / update achieved count
  const handleUpdateAchieved = async (newVal: number) => {
    if (!viewModalItem) return;
    setIsUpdatingAchieved(true);
    try {
      const isCompleted = newVal >= (viewModalItem.total_target || 15);
      const res = await updateResourceItem('employeeTasks', {
        id: rowId(viewModalItem),
        _id: rowId(viewModalItem),
        achieved: newVal,
        is_completed: isCompleted,
      });

      if (res) {
        setViewModalItem((prev) =>
          prev ? { ...prev, achieved: newVal, is_completed: isCompleted } : null
        );
        showToast?.('success', 'Task progress updated!');
        await loadData();
      }
    } catch {
      showToast?.('danger', 'Failed to update task progress.');
    } finally {
      setIsUpdatingAchieved(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Breadcrumb matching Screenshot 1 */}
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
          <span>Employee Tasks</span>
          <span className="text-slate-500">&gt;</span>
          <span className="text-slate-300">List</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Employee Tasks</h1>
      </div>

      {/* Main Table Container */}
      <div className="bg-[#0b1322] border border-[#1b263b] rounded-xl overflow-hidden shadow-xl">
        {/* Search Toolbar matching Screenshot 1 (Right aligned) */}
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

        {/* Table matching Screenshot 1 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1c283f] bg-[#0c1322] text-slate-300 font-semibold text-[13px]">
                <th
                  onClick={() => handleSort('employee')}
                  className="py-3.5 px-6 cursor-pointer hover:text-white select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Employee</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-6 font-semibold">Task template</th>
                <th className="py-3.5 px-6 font-semibold">Period start</th>
                <th className="py-3.5 px-6 font-semibold">Period end</th>
                <th className="py-3.5 px-6 font-semibold">Total target</th>
                <th className="py-3.5 px-6 font-semibold">Achieved</th>
                <th className="py-3.5 px-6 font-semibold">Is completed</th>
                <th className="py-3.5 px-6 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#172236] text-[13px]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-[#09929e]" />
                      <span>Loading employee tasks...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedTasks.length > 0 ? (
                paginatedTasks.map((item, idx) => {
                  const id = rowId(item) || String(idx);

                  return (
                    <tr
                      key={id}
                      className="hover:bg-[#131c2e]/60 transition text-slate-200"
                    >
                      <td className="py-3.5 px-6 font-normal text-white">{item.employee || '—'}</td>
                      <td className="py-3.5 px-6 text-slate-300">{item.task_template || '—'}</td>
                      <td className="py-3.5 px-6 text-slate-300">{item.period_start || '—'}</td>
                      <td className="py-3.5 px-6 text-slate-300">{item.period_end || '—'}</td>
                      <td className="py-3.5 px-6 text-slate-200">{item.total_target ?? 15}</td>
                      <td className="py-3.5 px-6 text-slate-200">{item.achieved ?? 0}</td>
                      <td className="py-3.5 px-6">
                        {item.is_completed ? (
                          <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 20 20" fill="none">
                            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M6 10l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-rose-500" viewBox="0 0 20 20" fill="none">
                            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <button
                          onClick={() => openViewModal(item)}
                          className="inline-flex items-center gap-1.5 text-[13px] text-slate-300 hover:text-white transition cursor-pointer"
                        >
                          <Eye className="w-4 h-4 text-slate-400" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No employee tasks found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="px-6 py-3.5 border-t border-[#1c283f] flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] text-slate-400">
          <span>
            {filteredTasks.length > 0
              ? `Showing ${(currentPage - 1) * perPage + 1} to ${Math.min(
                  currentPage * perPage,
                  filteredTasks.length
                )} of ${filteredTasks.length} results`
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

      {/* VIEW MODAL: Show Task Progress & Quick Update */}
      {viewModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#101728] border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-700/70 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Employee Task Details</h3>
                <p className="text-xs text-slate-400">{viewModalItem.task_template}</p>
              </div>
              <button
                onClick={() => setViewModalItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-[13px]">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#080d1a] p-3 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Employee</span>
                  <span className="font-medium text-white">{viewModalItem.employee}</span>
                  {viewModalItem.employee_id && (
                    <span className="text-xs text-slate-400 block font-mono">({viewModalItem.employee_id})</span>
                  )}
                </div>

                <div className="bg-[#080d1a] p-3 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Status</span>
                  {viewModalItem.is_completed ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                      Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-rose-400 text-xs font-semibold">
                      In Progress
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#080d1a] p-3 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Period Start</span>
                  <span className="text-white">{viewModalItem.period_start}</span>
                </div>
                <div className="bg-[#080d1a] p-3 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Period End</span>
                  <span className="text-white">{viewModalItem.period_end}</span>
                </div>
              </div>

              {/* Progress Bar & Achieved Counter */}
              <div className="bg-[#080d1a] p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Target Progress:</span>
                  <span className="font-semibold text-white">
                    {viewModalItem.achieved} / {viewModalItem.total_target} (
                    {Math.round(((viewModalItem.achieved || 0) / (viewModalItem.total_target || 1)) * 100)}%)
                  </span>
                </div>

                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      viewModalItem.is_completed ? 'bg-emerald-500' : 'bg-[#09929e]'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(((viewModalItem.achieved || 0) / (viewModalItem.total_target || 1)) * 100)
                      )}%`,
                    }}
                  />
                </div>

                {/* Quick Achieved increment / editor */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-300">Update Achieved:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={editAchievedVal}
                      onChange={(e) => setEditAchievedVal(Number(e.target.value))}
                      className="w-20 px-2.5 py-1 bg-[#101728] border border-slate-700 rounded-lg text-xs text-white text-center focus:ring-1 focus:ring-[#09929e]"
                    />
                    <button
                      type="button"
                      disabled={isUpdatingAchieved}
                      onClick={() => handleUpdateAchieved(editAchievedVal)}
                      className="px-3 py-1 bg-[#09929e] hover:bg-[#08818c] text-white text-xs font-medium rounded-lg transition disabled:opacity-50 cursor-pointer"
                    >
                      {isUpdatingAchieved ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-[#0b1322] border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setViewModalItem(null)}
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
