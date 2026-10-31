'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
} from 'lucide-react';
import {
  fetchResourceList,
  createResourceItem,
  updateResourceItem,
  deleteResourceItem,
} from '../../services/api';

interface GenericResourceViewProps {
  activeTab: string;
  showToast?: (type: 'success' | 'danger', message: string) => void;
}

export default function GenericResourceView({
  activeTab,
  showToast,
}: GenericResourceViewProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal State
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Form Fields
  const [formName, setFormName] = useState<string>('');
  const [formContact, setFormContact] = useState<string>('');
  const [formDetail, setFormDetail] = useState<string>('');
  const [formStatus, setFormStatus] = useState<string>('active');

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchResourceList(activeTab);
      setData(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error(`Failed to load ${activeTab}:`, err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setSearchQuery('');
  }, [activeTab]);

  // Filtered Records
  const filteredData = data.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const str = JSON.stringify(item).toLowerCase();
    return str.includes(q);
  });

  const openNewModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormContact('');
    setFormDetail('');
    setFormStatus(activeTab === 'leads' ? '1' : 'active');
    setModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setFormName(item.name || item.title || '');
    setFormContact(item.email || item.phone || item.contact || '');
    setFormDetail(item.description || item.course || item.designation || '');
    setFormStatus(item.status ? String(item.status) : 'active');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    try {
      setSaving(true);
      const payload: Record<string, any> = {
        name: formName.trim(),
        title: formName.trim(),
        email: formContact.includes('@')
          ? formContact.trim()
          : `${formName.toLowerCase().replace(/\s+/g, '')}@kide.com`,
        phone: formContact.trim(),
        contact: formContact.trim(),
        status: activeTab === 'leads' ? parseInt(formStatus) || 1 : formStatus.toLowerCase(),
      };

      if (formDetail.trim()) {
        if (activeTab === 'leads') {
          payload.course = formDetail.trim();
        } else {
          payload.description = formDetail.trim();
        }
      }

      let res;
      if (editingItem) {
        payload.id = editingItem.id || editingItem._id;
        res = await updateResourceItem(activeTab, payload);
      } else {
        res = await createResourceItem(activeTab, payload);
      }

      if (res && res.success !== false) {
        setModalOpen(false);
        setEditingItem(null);
        loadData();
        showToast?.(
          'success',
          `${editingItem ? 'Updated' : 'New'} ${activeTab.replace(/s$/, '')} saved successfully!`
        );
      } else {
        showToast?.('danger', res?.message || 'Failed to save record');
      }
    } catch (err) {
      console.error('Save error:', err);
      showToast?.('danger', 'Failed to save record');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: any) => {
    const id = item.id || item._id;
    if (!id) return;

    if (!confirm(`Are you sure you want to delete this ${activeTab.replace(/s$/, '')}?`)) return;

    try {
      const res = await deleteResourceItem(activeTab, id);
      if (res && res.success !== false) {
        showToast?.('success', 'Record deleted successfully');
        loadData();
      } else {
        showToast?.('danger', 'Failed to delete record');
      }
    } catch {
      showToast?.('danger', 'Failed to delete record');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white capitalize tracking-tight">
            {activeTab.replace(/([A-Z])/g, ' $1').trim()}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage {activeTab.replace(/([A-Z])/g, ' $1').toLowerCase()} records
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openNewModal}
            className="px-3.5 py-1.5 bg-[#09929e] hover:bg-[#08818c] text-white text-xs font-semibold rounded-lg shadow flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New {activeTab.replace(/s$/, '')}</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-[#101726] border border-[#1e2a42] rounded-xl shadow-sm overflow-hidden">
        <div className="p-3.5 border-b border-[#1c283f] flex items-center justify-between">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#0b1120] border border-slate-700/70 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#09929e]"
            />
          </div>
          <span className="text-xs text-slate-400">Total: {filteredData.length}</span>
        </div>

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 text-[#09929e] animate-spin" />
            <span className="text-xs">Loading records...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1c283f] bg-[#0c1322] text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-5">ID / Code</th>
                  <th className="py-3 px-5">Name / Title</th>
                  <th className="py-3 px-5">Details / Relation</th>
                  <th className="py-3 px-5">Status / Badge</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#172236]">
                {filteredData.length > 0 ? (
                  filteredData.map((item, idx) => {
                    const id = item.id || item._id || `item-${idx}`;
                    return (
                      <tr key={id} className="hover:bg-[#131c2e]/60 transition">
                        <td className="py-3 px-5 font-mono text-slate-400 text-[11px]">
                          {item.employee_id || item.code || String(id).slice(-6)}
                        </td>
                        <td className="py-3 px-5 font-medium text-white">
                          {item.name || item.title || item.employee || '—'}
                        </td>
                        <td className="py-3 px-5 text-slate-300">
                          {item.description ||
                            item.designation ||
                            item.zoneName ||
                            item.course ||
                            item.contact_number ||
                            item.email ||
                            '—'}
                        </td>
                        <td className="py-3 px-5">
                          {item.status !== undefined ? (
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                String(item.status).toLowerCase() === 'active' ||
                                item.status === 'ONLINE' ||
                                item.status === 4 ||
                                item.status === 1
                                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}
                            >
                              {String(item.status)}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-3 px-5 text-right whitespace-nowrap">
                          <button
                            onClick={() => openEditModal(item)}
                            className="inline-flex items-center gap-1 text-[#09929e] hover:text-[#08818c] text-xs font-semibold mr-3 transition cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 text-xs font-semibold transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      No {activeTab} records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl bg-[#111827] border border-slate-700 rounded-2xl shadow-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-white text-base">
                {editingItem ? 'Edit' : 'New'} {activeTab.replace(/s$/, '')}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Name / Title</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Enter name..."
                  className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Contact / Email</label>
                <input
                  type="text"
                  value={formContact}
                  onChange={(e) => setFormContact(e.target.value)}
                  placeholder="e.g. email or phone..."
                  className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {activeTab === 'leads' ? 'Course' : 'Details / Notes'}
                </label>
                <input
                  type="text"
                  value={formDetail}
                  onChange={(e) => setFormDetail(e.target.value)}
                  placeholder="Additional details..."
                  className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none"
                />
              </div>

              {activeTab === 'leads' ? (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none"
                  >
                    <option value="1">1: New</option>
                    <option value="2">2: Contacted</option>
                    <option value="3">3: In Progress</option>
                    <option value="4">4: Won</option>
                    <option value="5">5: Lost</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg bg-[#09929e] hover:bg-[#08818c] text-white font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingItem ? 'Update Record' : 'Save Record'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
