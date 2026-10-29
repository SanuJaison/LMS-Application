'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Search,
  RefreshCw,
  Users,
  TrendingUp,
  CheckSquare,
  Clock,
  Wallet,
  CalendarDays,
  LogIn,
  ShieldCheck,
} from 'lucide-react';
import { fetchResourceList } from '../../services/api';
import TablePagination from '@/components/ui/TablePagination';

interface ActivityItem {
  id?: string;
  _id?: string;
  description: string;
  subject_type?: string;
  causer_name?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Icon + colour per subject type. Keys match `subject_type` written by
 * `src/lib/activityLog.ts` callers.
 */
const SUBJECT_STYLES: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; badge: string }
> = {
  Lead: { icon: TrendingUp, badge: 'bg-blue-500/10 text-blue-500 border-blue-500/25' },
  Employee: { icon: Users, badge: 'bg-accent/10 text-accent border-accent/25' },
  Task: { icon: CheckSquare, badge: 'bg-violet-500/10 text-violet-500 border-violet-500/25' },
  Attendance: { icon: Clock, badge: 'bg-success/10 text-success border-success/25' },
  Wallet: { icon: Wallet, badge: 'bg-amber-500/10 text-amber-500 border-amber-500/25' },
  Leave: { icon: CalendarDays, badge: 'bg-rose-500/10 text-rose-500 border-rose-500/25' },
  Auth: { icon: LogIn, badge: 'bg-sky-500/10 text-sky-500 border-sky-500/25' },
  Role: { icon: ShieldCheck, badge: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/25' },
  General: { icon: Activity, badge: 'bg-surface-2 text-muted border-line' },
};

function styleFor(subject?: string) {
  return SUBJECT_STYLES[subject || 'General'] || SUBJECT_STYLES.General;
}

/** IST calendar day for grouping: YYYY-MM-DD. */
function istDayKey(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function dayLabel(key: string): string {
  if (!key) return 'Unknown date';
  const today = istDayKey(new Date().toISOString());
  if (key === today) return 'Today';

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  if (key === istDayKey(yesterday)) return 'Yesterday';

  const parsed = new Date(`${key}T00:00:00+05:30`);
  if (Number.isNaN(parsed.getTime())) return key;
  return parsed.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fullTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function relativeTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const diff = Date.now() - date.getTime();
  if (diff < 0) return 'just now';

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;

  return fullTime(value);
}

export default function ActivitiesView() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [subjectFilter, setSubjectFilter] = useState<string>('All');
  const [causerFilter, setCauserFilter] = useState<string>('All');

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(10);

  const loadActivities = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const rows = await fetchResourceList('activities');
      const sorted = [...rows].sort((a: any, b: any) => {
        const aTime = new Date(a.createdAt || a.updatedAt || 0).getTime();
        const bTime = new Date(b.createdAt || b.updatedAt || 0).getTime();
        return bTime - aTime;
      });
      setActivities(sorted as ActivityItem[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  const subjectOptions = useMemo(() => {
    return Array.from(
      new Set(activities.map((a) => a.subject_type || 'General').filter(Boolean))
    ).sort();
  }, [activities]);

  const causerOptions = useMemo(() => {
    return Array.from(
      new Set(activities.map((a) => a.causer_name || 'System').filter(Boolean))
    ).sort();
  }, [activities]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return activities.filter((item) => {
      if (subjectFilter !== 'All' && (item.subject_type || 'General') !== subjectFilter) {
        return false;
      }
      if (causerFilter !== 'All' && (item.causer_name || 'System') !== causerFilter) {
        return false;
      }
      if (!q) return true;
      return (
        (item.description || '').toLowerCase().includes(q) ||
        (item.subject_type || '').toLowerCase().includes(q) ||
        (item.causer_name || '').toLowerCase().includes(q)
      );
    });
  }, [activities, searchQuery, subjectFilter, causerFilter]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, currentPage, perPage]);

  // Group the visible page by IST calendar day for the timeline headings.
  const grouped = useMemo(() => {
    const groups: { key: string; label: string; items: ActivityItem[] }[] = [];
    paginated.forEach((item) => {
      const key = istDayKey(item.createdAt || item.updatedAt);
      let group = groups.find((g) => g.key === key);
      if (!group) {
        group = { key, label: dayLabel(key), items: [] };
        groups.push(group);
      }
      group.items.push(item);
    });
    return groups;
  }, [paginated]);

  const todayCount = useMemo(() => {
    const today = istDayKey(new Date().toISOString());
    return activities.filter((a) => istDayKey(a.createdAt || a.updatedAt) === today).length;
  }, [activities]);

  const hasFilters = searchQuery.trim() !== '' || subjectFilter !== 'All' || causerFilter !== 'All';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Activities</h1>
          <p className="text-xs text-muted mt-0.5">
            Audit trail of every change made from the admin panel and the mobile app
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-4 text-xs text-muted">
            <span>
              <strong className="text-ink font-semibold">{activities.length}</strong> events
            </span>
            <span>
              <strong className="text-ink font-semibold">{todayCount}</strong> today
            </span>
          </div>
          <button
            type="button"
            onClick={() => loadActivities(true)}
            disabled={refreshing}
            className="px-3.5 py-1.5 bg-elevated border border-line hover:bg-hover text-ink text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-elevated border border-line rounded-xl shadow-sm p-3.5 flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search activity, person or type..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-8 pr-3 py-2 bg-field border border-line rounded-lg text-xs text-ink placeholder-subtle focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={subjectFilter}
            onChange={(e) => {
              setSubjectFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="appearance-none px-3 py-2 bg-field border border-line rounded-lg text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer min-w-[140px]"
          >
            <option value="All">All types</option>
            {subjectOptions.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>

          <select
            value={causerFilter}
            onChange={(e) => {
              setCauserFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="appearance-none px-3 py-2 bg-field border border-line rounded-lg text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer min-w-[150px]"
          >
            <option value="All">All people</option>
            {causerOptions.map((causer) => (
              <option key={causer} value={causer}>
                {causer}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-elevated border border-line rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5">
          {loading ? (
            <div className="py-14 text-center text-xs text-subtle">Loading activities...</div>
          ) : filtered.length === 0 ? (
            <div className="py-14 text-center">
              <div className="mx-auto w-11 h-11 rounded-full bg-surface-2 border border-line flex items-center justify-center mb-3">
                <Activity className="w-5 h-5 text-muted" />
              </div>
              <p className="text-sm font-semibold text-ink">
                {hasFilters ? 'No activities match your filters' : 'No activity recorded yet'}
              </p>
              <p className="text-xs text-muted mt-1 max-w-md mx-auto">
                {hasFilters
                  ? 'Try a different search term or clear the type/person filters.'
                  : 'Creating or editing leads, employees, tasks, attendance, wallets and leaves will show up here automatically.'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map((group) => (
                <div key={group.key || group.label}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                      {group.label}
                    </span>
                    <span className="flex-1 h-px bg-line" />
                  </div>

                  <ol className="relative border-l border-line ml-4 pl-6 space-y-5">
                    {group.items.map((item, idx) => {
                      const subject = item.subject_type || 'General';
                      const style = styleFor(subject);
                      const Icon = style.icon;

                      return (
                        <li
                          key={item.id || item._id || `${group.key}-${idx}`}
                          className="relative"
                        >
                          <span
                            className={`absolute -left-[38px] top-0 h-7 w-7 rounded-full border flex items-center justify-center bg-elevated ${style.badge}`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </span>

                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[13px] text-ink leading-relaxed">
                              {item.description}
                            </p>
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${style.badge}`}
                            >
                              {subject}
                            </span>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                            <span className="font-medium text-ink/70">
                              {item.causer_name || 'System'}
                            </span>
                            <span className="text-subtle">•</span>
                            <span>{relativeTime(item.createdAt || item.updatedAt)}</span>
                            <span className="text-subtle">•</span>
                            <span>{fullTime(item.createdAt || item.updatedAt)} IST</span>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </div>

        {!loading && filtered.length > 0 ? (
          <TablePagination
            total={filtered.length}
            page={currentPage}
            perPage={perPage}
            onPageChange={setCurrentPage}
            onPerPageChange={setPerPage}
            perPageOptions={[10, 25, 50]}
            label="activities"
          />
        ) : null}
      </div>
    </div>
  );
}
