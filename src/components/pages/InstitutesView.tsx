'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Eye,
  Trash2,
  X,
  Loader2,
  RefreshCw,
  Building2,
  Phone,
  Mail,
  MapPin,
  User,
  BadgeCheck,
} from 'lucide-react';
import { authHeaders } from '../../services/api';
import TablePagination from '@/components/ui/TablePagination';

interface InstituteItem {
  id: string;
  legacy_id?: number | null;
  institute_name: string;
  person_name: string;
  position?: string;
  phone: string;
  email?: string;
  district?: string;
  place?: string;
  notes?: string;
  created_by?: string;
  created_by_id?: string;
  created_at?: string | null;
  updated_at?: string | null;
}

interface InstitutesViewProps {
  showToast?: (type: 'success' | 'danger', message: string) => void;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const normalized = String(value).replace(/(\.\d{3})\d+/, '$1');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function InstitutesView({ showToast }: InstitutesViewProps) {
  const [institutes, setInstitutes] = useState<InstituteItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [perPage, setPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewing, setViewing] = useState<InstituteItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch('/api/institutes', {
        cache: 'no-store',
        headers: authHeaders(),
      });
      if (!res.ok) {
        throw new Error(`Request failed with ${res.status}`);
      }
      const json = await res.json();
      setInstitutes(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      console.error('Failed to load institutes:', err);
      if (!silent) showToast?.('danger', 'Failed to load institutes.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // New institutes added by ASMs from the app should appear as soon as the
    // admin comes back to this tab.
    const refreshOnFocus = () => loadData(true);
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnFocus);
    return () => {
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData(true);
    setIsRefreshing(false);
  };

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return institutes;

    return institutes.filter((item) =>
      [
        item.institute_name,
        item.person_name,
        item.position,
        item.phone,
        item.email,
        item.district,
        item.place,
        item.created_by,
        item.created_by_id,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [institutes, searchQuery]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, currentPage, perPage]);

  const handleDelete = async (item: InstituteItem) => {
    if (
      !window.confirm(
        `Delete institute "${item.institute_name}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingId(item.id);
    try {
      const res = await fetch(`/api/institutes/${item.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || json.success === false) {
        throw new Error(json.message || 'Failed to delete institute.');
      }

      showToast?.('success', 'Institute deleted successfully.');
      await loadData(true);
    } catch (err: any) {
      console.error('Delete institute failed:', err);
      showToast?.('danger', err.message || 'Failed to delete institute.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted mb-1">
            <span>Institute Management</span>
            <span className="text-subtle">&gt;</span>
            <span className="text-ink/80">Institutes</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Institutes</h1>
          <p className="text-xs text-muted mt-1">
            Institutes added by Area Sales Managers from the mobile app.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-surface border border-line rounded-lg text-[13px] text-ink/80">
          <Building2 className="w-4 h-4 text-accent" />
          <span>
            Total: <strong className="text-ink">{institutes.length}</strong>
          </span>
        </div>
      </div>

      {/* Table container */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 flex items-center justify-end gap-3 border-b border-line">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search institute, person, phone, ASM..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-field border border-line rounded-lg text-[13px] text-ink placeholder-subtle focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 border border-line rounded-lg text-muted hover:text-ink bg-field cursor-pointer disabled:opacity-50"
            title="Refresh institutes"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-ink/80 font-semibold text-[13px]">
                <th className="py-3.5 px-5">Institute</th>
                <th className="py-3.5 px-5">Contact Person</th>
                <th className="py-3.5 px-5">Position</th>
                <th className="py-3.5 px-5">Phone</th>
                <th className="py-3.5 px-5">District</th>
                <th className="py-3.5 px-5">Added By</th>
                <th className="py-3.5 px-5">Date</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-2 text-[13px]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-accent" />
                      <span>Loading institutes...</span>
                    </div>
                  </td>
                </tr>
              ) : paginated.length > 0 ? (
                paginated.map((item) => (
                  <tr key={item.id} className="transition text-ink hover:bg-hover/60">
                    <td className="py-3.5 px-5 font-medium text-ink">
                      {item.institute_name || '—'}
                    </td>
                    <td className="py-3.5 px-5 text-ink/80">{item.person_name || '—'}</td>
                    <td className="py-3.5 px-5 text-ink/80">{item.position || '—'}</td>
                    <td className="py-3.5 px-5 text-ink/80">{item.phone || '—'}</td>
                    <td className="py-3.5 px-5 text-ink/80">{item.district || '—'}</td>
                    <td className="py-3.5 px-5 text-ink/80">
                      {item.created_by ? (
                        <span>
                          {item.created_by}
                          {item.created_by_id ? (
                            <span className="text-subtle"> ({item.created_by_id})</span>
                          ) : null}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-muted">{formatDate(item.created_at)}</td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => setViewing(item)}
                          className="inline-flex items-center gap-1.5 text-[13px] text-ink/80 hover:text-ink transition cursor-pointer"
                        >
                          <Eye className="w-4 h-4 text-muted" />
                          <span>View</span>
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          disabled={deletingId === item.id}
                          className="inline-flex items-center gap-1.5 text-[13px] text-danger hover:text-danger transition disabled:opacity-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>{deletingId === item.id ? 'Deleting…' : 'Delete'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-subtle">
                    {institutes.length === 0
                      ? 'No institutes added yet. ASMs can add them from the mobile app.'
                      : 'No institutes match your search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <TablePagination
          total={filtered.length}
          page={currentPage}
          perPage={perPage}
          onPageChange={setCurrentPage}
          onPerPageChange={setPerPage}
        />
      </div>

      {/* View modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-elevated border border-line rounded-2xl shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-ink text-base">Institute details</h3>
              <button
                onClick={() => setViewing(null)}
                className="text-muted hover:text-ink p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-[13px]">
              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 text-accent mt-0.5" />
                <div>
                  <p className="text-muted text-[11px] uppercase tracking-wide">Institute</p>
                  <p className="text-ink font-medium">{viewing.institute_name || '—'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User className="w-4 h-4 text-accent mt-0.5" />
                <div>
                  <p className="text-muted text-[11px] uppercase tracking-wide">Contact person</p>
                  <p className="text-ink">
                    {viewing.person_name || '—'}
                    {viewing.position ? (
                      <span className="text-muted"> · {viewing.position}</span>
                    ) : null}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-accent mt-0.5" />
                <div>
                  <p className="text-muted text-[11px] uppercase tracking-wide">Phone</p>
                  <p className="text-ink">{viewing.phone || '—'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-accent mt-0.5" />
                <div>
                  <p className="text-muted text-[11px] uppercase tracking-wide">Email</p>
                  <p className="text-ink">{viewing.email || '—'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-accent mt-0.5" />
                <div>
                  <p className="text-muted text-[11px] uppercase tracking-wide">Location</p>
                  <p className="text-ink">
                    {[viewing.place, viewing.district].filter(Boolean).join(', ') || '—'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <BadgeCheck className="w-4 h-4 text-accent mt-0.5" />
                <div>
                  <p className="text-muted text-[11px] uppercase tracking-wide">Added by</p>
                  <p className="text-ink">
                    {viewing.created_by || '—'}
                    {viewing.created_by_id ? (
                      <span className="text-muted"> ({viewing.created_by_id})</span>
                    ) : null}
                  </p>
                  <p className="text-subtle text-[11px] mt-0.5">
                    {formatDate(viewing.created_at)}
                  </p>
                </div>
              </div>

              {viewing.notes ? (
                <div className="pt-3 border-t border-line">
                  <p className="text-muted text-[11px] uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-ink whitespace-pre-wrap">{viewing.notes}</p>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 pt-5">
              <button
                type="button"
                onClick={() => setViewing(null)}
                className="px-4 py-1.5 rounded-lg border border-line bg-active text-ink hover:bg-active text-xs font-medium transition cursor-pointer"
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
