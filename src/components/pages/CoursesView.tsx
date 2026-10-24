'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Eye,
  Pencil,
  Trash2,
  X,
  Plus,
  Loader2,
} from 'lucide-react';
import {
  fetchResourceList,
  createResourceItem,
  updateResourceItem,
  deleteResourceItem,
} from '../../services/api';

interface CourseItem {
  _id?: string;
  id?: string;
  name: string;
  fee?: number;
  duration?: string;
  status?: string;
  createdAt?: string;
}

interface CoursesViewProps {
  showToast?: (type: 'success' | 'danger', message: string) => void;
}

export default function CoursesView({ showToast }: CoursesViewProps) {
  // Data state
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Table controls
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [perPage, setPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Modals state
  const [viewModalItem, setViewModalItem] = useState<CourseItem | null>(null);
  const [formModalOpen, setFormModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<CourseItem | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form Field
  const [formName, setFormName] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchResourceList('courses');
      setCourses(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to load courses:', err);
      showToast?.('danger', 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const rowId = (item: CourseItem) => (item._id || item.id || '').toString();

  // Filtered courses
  const filteredCourses = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return courses;
    return courses.filter((c) => c.name?.toLowerCase().includes(q));
  }, [courses, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredCourses.length / perPage) || 1;
  const paginatedCourses = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredCourses.slice(start, start + perPage);
  }, [filteredCourses, currentPage, perPage]);

  // Selection handlers
  const allVisibleSelected =
    paginatedCourses.length > 0 &&
    paginatedCourses.every((item) => selectedIds.includes(rowId(item)));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleIds = paginatedCourses.map(rowId);
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      const visibleIds = paginatedCourses.map(rowId);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Open Create Modal
  const openCreateModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (item: CourseItem) => {
    setEditingItem(item);
    setFormName(item.name || '');
    setFormModalOpen(true);
  };

  // Save (Create / Update)
  const handleSaveCourse = async (e: React.FormEvent, keepOpen = false) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast?.('danger', 'Course name is required.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingItem) {
        await updateResourceItem('courses', {
          id: rowId(editingItem),
          _id: rowId(editingItem),
          name: formName.trim(),
        });
        showToast?.('success', 'Course updated successfully!');
        setFormModalOpen(false);
        setEditingItem(null);
      } else {
        await createResourceItem('courses', { name: formName.trim() });
        showToast?.('success', 'Course created successfully!');
        if (keepOpen) {
          setFormName('');
        } else {
          setFormModalOpen(false);
        }
      }
      await loadData();
    } catch (err) {
      console.error('Error saving course:', err);
      showToast?.('danger', 'Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete single
  const handleDeleteCourse = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this course?')) return;
    setIsDeleting(id);
    try {
      await deleteResourceItem('courses', id);
      showToast?.('success', 'Course deleted successfully!');
      setSelectedIds((prev) => prev.filter((i) => i !== id));
      await loadData();
    } catch {
      showToast?.('danger', 'Failed to delete course.');
    } finally {
      setIsDeleting(null);
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected courses?`)) return;
    try {
      await deleteResourceItem('courses', selectedIds);
      showToast?.('success', `${selectedIds.length} courses deleted successfully!`);
      setSelectedIds([]);
      await loadData();
    } catch {
      showToast?.('danger', 'Failed to delete selected courses.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span>Courses</span>
            <span>&gt;</span>
            <span className="text-slate-200">List</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Courses</h1>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#09929e] hover:bg-[#08818c] text-white text-xs font-semibold rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New course</span>
        </button>
      </div>

      {/* Main Table Container */}
      <div className="bg-[#0b1322] border border-[#1b263b] rounded-xl overflow-hidden shadow-xl">
        {/* Search & Bulk Actions Toolbar */}
        <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[#1b263b]">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search courses..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-[#080d1a] border border-slate-700/70 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#09929e]"
            />
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>
              Total: <strong className="text-white">{filteredCourses.length}</strong>
            </span>
          </div>
        </div>

        {/* Bulk Selection Notification Bar */}
        {selectedIds.length > 0 && (
          <div className="bg-[#10243e] px-4 py-2 flex items-center justify-between text-xs border-b border-[#1b263b]">
            <span className="text-slate-200">
              <strong className="text-white">{selectedIds.length}</strong> course(s) selected
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedIds([])}
                className="text-slate-300 hover:text-white underline text-xs"
              >
                Deselect all
              </button>
              <button
                onClick={handleBulkDelete}
                className="text-red-400 hover:text-red-300 font-semibold text-xs flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete selected</span>
              </button>
            </div>
          </div>
        )}

        {/* Courses Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#1c283f] bg-[#0c1322] text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    className="accent-[#09929e] cursor-pointer"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    title="Select all"
                  />
                </th>
                <th className="py-3 px-5">Name</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#172236]">
              {loading ? (
                <tr>
                  <td colSpan={3} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-[#09929e]" />
                      <span>Loading courses...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedCourses.length > 0 ? (
                paginatedCourses.map((item, idx) => {
                  const id = rowId(item) || String(idx);
                  const isSelected = selectedIds.includes(id);

                  return (
                    <tr
                      key={id}
                      className={`transition ${
                        isSelected ? 'bg-[#0e2233]' : 'hover:bg-[#131c2e]/60'
                      }`}
                    >
                      <td
                        className={`py-3 px-4 border-l-2 ${
                          isSelected ? 'border-[#09929e]' : 'border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="accent-[#09929e] cursor-pointer"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(id)}
                        />
                      </td>
                      <td className="py-3 px-5 font-medium text-white">{item.name || '—'}</td>
                      <td className="py-3 px-5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => setViewModalItem(item)}
                            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-[#09929e] transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                          <button
                            onClick={() => openEditModal(item)}
                            className="inline-flex items-center gap-1 text-xs text-[#09929e] hover:underline transition cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteCourse(id)}
                            disabled={isDeleting === id}
                            className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 hover:underline transition disabled:opacity-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{isDeleting === id ? 'Deleting…' : 'Delete'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-slate-500">
                    No courses found. Click &quot;New course&quot; to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="px-5 py-3 border-t border-[#1c283f] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
          <span>
            Showing{' '}
            <strong className="text-white">
              {filteredCourses.length > 0 ? (currentPage - 1) * perPage + 1 : 0}
            </strong>{' '}
            to{' '}
            <strong className="text-white">
              {Math.min(currentPage * perPage, filteredCourses.length)}
            </strong>{' '}
            of <strong className="text-white">{filteredCourses.length}</strong> results
          </span>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              Per page:
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-[#080d1a] border border-slate-700 rounded px-1.5 py-0.5 text-white text-[11px] focus:outline-none focus:ring-1 focus:ring-[#09929e]"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-2 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="px-2 text-white">
                  {currentPage} / {totalPages}
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* VIEW MODAL */}
      {viewModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-[#111827] border border-slate-700 rounded-2xl shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-white text-base">View course</h3>
              <button
                onClick={() => setViewModalItem(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs space-y-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Name</label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={viewModalItem.name || '—'}
                  className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-slate-300 text-xs cursor-not-allowed"
                />
              </div>
            </div>

            <div className="flex items-center justify-start gap-2 pt-5">
              <button
                type="button"
                onClick={() => setViewModalItem(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-600 bg-[#1b263b] text-slate-200 hover:bg-slate-700 text-xs font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {formModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-[#111827] border border-slate-700 rounded-2xl shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-white text-base">
                {editingItem ? 'Edit course' : 'Create course'}
              </h3>
              <button
                onClick={() => setFormModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => handleSaveCourse(e, false)} className="text-xs">
              <div className="mb-5">
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Full-Stack Web Development"
                  className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setFormModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
                >
                  Cancel
                </button>
                {!editingItem && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={(e) => handleSaveCourse(e, true)}
                    className="px-3.5 py-1.5 rounded-lg border border-[#09929e] text-[#09929e] hover:bg-[#09929e]/10 text-xs disabled:opacity-60"
                  >
                    {isSaving ? 'Saving…' : 'Create & create another'}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 rounded-lg bg-[#09929e] hover:bg-[#08818c] text-white font-semibold text-xs disabled:opacity-60"
                >
                  {isSaving ? 'Saving…' : editingItem ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
