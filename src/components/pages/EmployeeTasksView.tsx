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
import TablePagination from '@/components/ui/TablePagination';

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
        <div className="flex items-center gap-2 text-xs text-muted mb-1">
          <span>Employee Tasks</span>
          <span className="text-subtle">&gt;</span>
          <span className="text-ink/80">List</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Employee Tasks</h1>
      </div>

      {/* Main Table Container */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-xl">
        {/* Search Toolbar matching Screenshot 1 (Right aligned) */}
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

        {/* Table matching Screenshot 1 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-ink/80 font-semibold text-[13px]">
                <th
                  onClick={() => handleSort('employee')}
                  className="py-3.5 px-6 cursor-pointer hover:text-ink select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Employee</span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted" />
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
            <tbody className="divide-y divide-line-2 text-[13px]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-accent" />
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
                      className="hover:bg-hover/60 transition text-ink"
                    >
                      <td className="py-3.5 px-6 font-normal text-ink">{item.employee || '—'}</td>
                      <td className="py-3.5 px-6 text-ink/80">{item.task_template || '—'}</td>
                      <td className="py-3.5 px-6 text-ink/80">{item.period_start || '—'}</td>
                      <td className="py-3.5 px-6 text-ink/80">{item.period_end || '—'}</td>
                      <td className="py-3.5 px-6 text-ink">{item.total_target ?? 15}</td>
                      <td className="py-3.5 px-6 text-ink">{item.achieved ?? 0}</td>
                      <td className="py-3.5 px-6">
                        {item.is_completed ? (
                          <svg className="w-4 h-4 text-success" viewBox="0 0 20 20" fill="none">
                            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M6 10l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-danger" viewBox="0 0 20 20" fill="none">
                            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <button
                          onClick={() => openViewModal(item)}
                          className="inline-flex items-center gap-1.5 text-[13px] text-ink/80 hover:text-ink transition cursor-pointer"
                        >
                          <Eye className="w-4 h-4 text-muted" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-subtle">
                    No employee tasks found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <TablePagination
          total={filteredTasks.length}
          page={currentPage}
          perPage={perPage}
          onPageChange={setCurrentPage}
          onPerPageChange={setPerPage}
        />
      </div>

      {/* VIEW MODAL: Show Task Progress & Quick Update */}
      {viewModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-elevated border border-line rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-line flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink">Employee Task Details</h3>
                <p className="text-xs text-muted">{viewModalItem.task_template}</p>
              </div>
              <button
                onClick={() => setViewModalItem(null)}
                className="text-muted hover:text-ink p-1 rounded-lg hover:bg-active transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-[13px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-field p-3 rounded-xl border border-line">
                  <span className="text-xs text-muted block mb-1">Employee</span>
                  <span className="font-medium text-ink">{viewModalItem.employee}</span>
                  {viewModalItem.employee_id && (
                    <span className="text-xs text-muted block font-mono">({viewModalItem.employee_id})</span>
                  )}
                </div>

                <div className="bg-field p-3 rounded-xl border border-line">
                  <span className="text-xs text-muted block mb-1">Status</span>
                  {viewModalItem.is_completed ? (
                    <span className="inline-flex items-center gap-1 text-success text-xs font-semibold">
                      Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-danger text-xs font-semibold">
                      In Progress
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-field p-3 rounded-xl border border-line">
                  <span className="text-xs text-muted block mb-1">Period Start</span>
                  <span className="text-ink">{viewModalItem.period_start}</span>
                </div>
                <div className="bg-field p-3 rounded-xl border border-line">
                  <span className="text-xs text-muted block mb-1">Period End</span>
                  <span className="text-ink">{viewModalItem.period_end}</span>
                </div>
              </div>

              {/* Progress Bar & Achieved Counter */}
              <div className="bg-field p-4 rounded-xl border border-line space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">Target Progress:</span>
                  <span className="font-semibold text-ink">
                    {viewModalItem.achieved} / {viewModalItem.total_target} (
                    {Math.round(((viewModalItem.achieved || 0) / (viewModalItem.total_target || 1)) * 100)}%)
                  </span>
                </div>

                <div className="w-full bg-active h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      viewModalItem.is_completed ? 'bg-emerald-500' : 'bg-accent'
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
                <div className="pt-2 border-t border-line flex items-center justify-between gap-3">
                  <span className="text-xs text-ink/80">Update Achieved:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={editAchievedVal}
                      onChange={(e) => setEditAchievedVal(Number(e.target.value))}
                      className="w-20 px-2.5 py-1 bg-elevated border border-line rounded-lg text-xs text-ink text-center focus:ring-1 focus:ring-accent"
                    />
                    <button
                      type="button"
                      disabled={isUpdatingAchieved}
                      onClick={() => handleUpdateAchieved(editAchievedVal)}
                      className="px-3 py-1 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition disabled:opacity-50 cursor-pointer"
                    >
                      {isUpdatingAchieved ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-surface border-t border-line flex justify-end">
              <button
                onClick={() => setViewModalItem(null)}
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
