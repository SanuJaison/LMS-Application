'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  TrendingUp,
  Radio,
  Clock,
  Search,
  ChevronDown,
} from 'lucide-react';
import {
  Zone,
  District,
  DashboardStats,
  AttendanceRecord,
  DonutSlice,
} from '../../types';
import {
  fetchZones,
  fetchDistricts,
  fetchDashboardStats,
} from '../../services/api';
import TablePagination from '@/components/ui/TablePagination';

export default function DashboardView() {
  const [selectedZone, setSelectedZone] = useState<string>('All Zones');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [zonesList, setZonesList] = useState<Zone[]>([]);
  const [districtsList, setDistrictsList] = useState<District[]>([]);
  const [statsData, setStatsData] = useState<DashboardStats | null>(null);

  const [attendanceSearch, setAttendanceSearch] = useState<string>('');
  const [attendancePage, setAttendancePage] = useState<number>(1);
  const [attendancePerPage, setAttendancePerPage] = useState<number>(5);

  // Load Zones & Districts options
  useEffect(() => {
    fetchZones().then((zones) => setZonesList(zones));
    fetchDistricts().then((districts) => setDistrictsList(districts));
  }, []);

  // Load Dashboard Analytics
  useEffect(() => {
    fetchDashboardStats(selectedZone, selectedDistrict).then((data) => {
      setStatsData(data);
    });
  }, [selectedZone, selectedDistrict]);

  // A filter change produces a different row set; always start at page 1.
  useEffect(() => {
    setAttendancePage(1);
  }, [selectedZone, selectedDistrict]);

  // Filtered live attendance
  const filteredAttendance = useMemo(() => {
    const list = statsData?.attendancePreview || statsData?.liveAttendance || [];
    if (!list.length) return [];
    if (!attendanceSearch.trim()) return list;
    const q = attendanceSearch.toLowerCase();
    return list.filter(
      (a: AttendanceRecord) =>
        a.name.toLowerCase().includes(q) ||
        (a.designation && a.designation.toLowerCase().includes(q)) ||
        a.district.toLowerCase().includes(q)
    );
  }, [statsData?.attendancePreview, statsData?.liveAttendance, attendanceSearch]);

  const paginatedAttendance = useMemo(() => {
    const start = (attendancePage - 1) * attendancePerPage;
    return filteredAttendance.slice(start, start + attendancePerPage);
  }, [filteredAttendance, attendancePage, attendancePerPage]);

  // Donut Chart Calculations
  const donutData = useMemo<DonutSlice[]>(() => {
    if (!statsData?.leadsByStatus) return [];
    const labels = statsData.leadsByStatus.labels;
    const values = statsData.leadsByStatus.data;
    const colors = statsData.leadsByStatus.colors;
    const total = values.reduce((acc: number, val: number) => acc + val, 0) || 1;

    let cumulative = 0;
    return values.map((val: number, idx: number) => {
      const percentage = (val / total) * 100;
      const strokeDasharray = `${percentage} ${100 - percentage}`;
      const strokeDashoffset = -cumulative;
      cumulative += percentage;
      return {
        label: labels[idx],
        value: val,
        percentage: Math.round(percentage),
        color: colors[idx],
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [statsData?.leadsByStatus]);

  // Dynamic coordinates for Leads Created Line Chart
  const createdTrendCoords = useMemo(() => {
    const list = statsData?.leadGenerationTrend?.data || [];
    if (!list.length) return [];
    const maxVal = Math.max(...list, 5);
    const step = 420 / (list.length - 1 || 1);
    return list.map((val, idx) => {
      const cx = 50 + idx * step;
      const cy = 170 - (val / maxVal) * 140;
      return { cx, cy, val };
    });
  }, [statsData?.leadGenerationTrend?.data]);

  // Dynamic coordinates for Leads Won Line Chart
  const wonTrendCoords = useMemo<{ cx: number; cy: number; val: number }[]>(() => {
    const list: number[] = (statsData?.leadGenerationTrend as any)?.wonData || [];
    if (!list.length) return [];
    const createdList = statsData?.leadGenerationTrend?.data || [];
    const maxVal = Math.max(...createdList, 5);
    const step = 420 / (list.length - 1 || 1);
    return list.map((val: number, idx: number) => {
      const cx = 50 + idx * step;
      const cy = 170 - (val / maxVal) * 140;
      return { cx, cy, val };
    });
  }, [statsData?.leadGenerationTrend]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Dashboard Title & Top Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h1 className="text-2xl font-bold text-ink tracking-tight">Dashboard</h1>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full sm:w-auto">
          {/* Filter by Zone */}
          <div className="flex flex-col flex-1 sm:flex-initial min-w-[130px]">
            <label className="text-[11px] font-semibold text-muted mb-1">
              Filter by Zone
            </label>
            <div className="relative inline-flex items-center w-full">
              <select
                value={selectedZone}
                onChange={(e) => {
                  setSelectedZone(e.target.value);
                  setSelectedDistrict('');
                }}
                className="w-full appearance-none bg-elevated border border-line rounded-lg px-3.5 py-1.5 pr-8 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent shadow-sm cursor-pointer"
              >
                <option value="All Zones">All Zones</option>
                {zonesList.map((z, idx) => (
                  <option key={z.id || (z as any)._id || z.name || `zone-${idx}`} value={z.name}>
                    {z.name}
                  </option>
                ))}
              </select>
              {selectedZone && selectedZone !== 'All Zones' ? (
                <button
                  onClick={() => {
                    setSelectedZone('All Zones');
                    setSelectedDistrict('');
                  }}
                  className="absolute right-6 text-muted hover:text-ink text-xs cursor-pointer"
                  title="Clear zone filter"
                >
                  ×
                </button>
              ) : null}
              <ChevronDown className="w-3.5 h-3.5 text-muted absolute right-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Filter by District */}
          <div className="flex flex-col flex-1 sm:flex-initial min-w-[130px]">
            <label className="text-[11px] font-semibold text-muted mb-1">
              Filter by District
            </label>
            <div className="relative inline-flex items-center w-full">
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="w-full appearance-none bg-elevated border border-line rounded-lg px-3.5 py-1.5 pr-8 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent shadow-sm cursor-pointer"
              >
                <option value="">All Districts</option>
                {districtsList
                  .filter((d) => {
                    if (!selectedZone || selectedZone === 'All Zones') return true;
                    return (d.zoneName || (d as any).zone) === selectedZone;
                  })
                  .map((d, idx) => (
                    <option key={d.id || (d as any)._id || d.name || `dist-${idx}`} value={d.name}>
                      {d.name}
                    </option>
                  ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-muted absolute right-2.5 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* 3 KPI Stats Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Total Leads Card */}
        <div className="bg-elevated border border-line rounded-xl p-4 sm:p-5 shadow-sm">
          <div className="text-xs font-semibold text-muted mb-1">Total Leads</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
            {statsData?.totalLeads ?? 0}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted">
            <Users className="w-3.5 h-3.5 text-accent" />
            <span>All time leads captured</span>
          </div>
        </div>

        {/* New Leads Today Card */}
        <div className="bg-elevated border border-line rounded-xl p-4 sm:p-5 shadow-sm">
          <div className="text-xs font-semibold text-muted mb-1">New Leads Today</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
            {statsData?.newLeadsToday ?? 0}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-success">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Leads generated today</span>
          </div>
        </div>

        {/* Active Field Force Card */}
        <div className="bg-elevated border border-line rounded-xl p-4 sm:p-5 shadow-sm sm:col-span-2 lg:col-span-1">
          <div className="text-xs font-semibold text-muted mb-1">Active Field Force</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
            {statsData?.activeFieldForce || '0 / 0 Active'}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted">
            <Radio className="w-3.5 h-3.5 text-success animate-pulse" />
            <span>Employees currently checked In ((•))</span>
          </div>
        </div>
      </div>

      {/* CHARTS ROW 1: Leads by Status & Leads Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Leads by Status (Donut Chart) */}
        <div className="bg-elevated border border-line rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div className="font-semibold text-ink text-sm mb-4">Leads by Status</div>
          <div className="flex flex-col items-center justify-center my-auto">
            <div className="relative w-48 h-48">
              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                {donutData.map((slice: DonutSlice, i: number) => (
                  <circle
                    key={i}
                    cx="18"
                    cy="18"
                    r="15.91549430918954"
                    fill="transparent"
                    stroke={slice.color}
                    strokeWidth="3.2"
                    strokeDasharray={slice.strokeDasharray}
                    strokeDashoffset={slice.strokeDashoffset}
                    className="transition-all duration-500 hover:opacity-80"
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-ink">
                  {statsData?.totalLeads ?? 0}
                </span>
                <span className="text-[10px] text-muted uppercase tracking-wider">
                  Leads
                </span>
              </div>
            </div>

            {/* Donut Legend */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-6 text-[11px] text-ink/80">
              {donutData.map((slice: DonutSlice, idx: number) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span>
                    {slice.label} ({slice.value})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Leads Chart (Dynamic Monthly Line Chart) */}
        <div className="bg-elevated border border-line rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div className="font-semibold text-ink text-sm mb-2">Leads Monthly Performance</div>
          <div className="h-56 w-full pt-4">
            <svg viewBox="0 0 500 200" className="w-full h-full">
              <line x1="40" y1="20" x2="480" y2="20" className="stroke-line" strokeDasharray="3 3" />
              <line x1="40" y1="70" x2="480" y2="70" className="stroke-line" strokeDasharray="3 3" />
              <line x1="40" y1="120" x2="480" y2="120" className="stroke-line" strokeDasharray="3 3" />
              <line x1="40" y1="170" x2="480" y2="170" className="stroke-line" />

              <text x="20" y="25" className="fill-subtle" fontSize="10">
                {Math.max(...(statsData?.leadGenerationTrend?.data || [5]), 5)}
              </text>
              <text x="20" y="95" className="fill-subtle" fontSize="10">
                {Math.round(Math.max(...(statsData?.leadGenerationTrend?.data || [5]), 5) / 2)}
              </text>
              <text x="20" y="175" className="fill-subtle" fontSize="10">0</text>

              {(statsData?.leadGenerationTrend?.months || ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']).map((m, idx, arr) => {
                const step = 420 / (arr.length - 1 || 1);
                return (
                  <text
                    key={m}
                    x={50 + idx * step}
                    y="192"
                    className="fill-subtle"
                    fontSize="10"
                    textAnchor="middle"
                  >
                    {m}
                  </text>
                );
              })}

              {/* Dynamic Created Leads Polyline */}
              {createdTrendCoords.length > 0 && (
                <>
                  <polyline
                    fill="none"
                    className="stroke-blue-500"
                    strokeWidth="2.5"
                    points={createdTrendCoords.map((c) => `${c.cx},${c.cy}`).join(' ')}
                  />
                  {createdTrendCoords.map((c, i) => (
                    <circle
                      key={i}
                      cx={c.cx}
                      cy={c.cy}
                      r="3.5"
                      className="fill-blue-500 stroke-elevated"
                      strokeWidth="1.5"
                    />
                  ))}
                </>
              )}

              {/* Dynamic Won Leads Polyline */}
              {wonTrendCoords.length > 0 && (
                <>
                  <polyline
                    fill="none"
                    className="stroke-emerald-500"
                    strokeWidth="2.5"
                    points={wonTrendCoords.map((c) => `${c.cx},${c.cy}`).join(' ')}
                  />
                  {wonTrendCoords.map((c, i) => (
                    <circle
                      key={i}
                      cx={c.cx}
                      cy={c.cy}
                      r="3.5"
                      className="fill-emerald-500 stroke-elevated"
                      strokeWidth="1.5"
                    />
                  ))}
                </>
              )}
            </svg>
          </div>
          <div className="flex justify-center gap-6 mt-4 text-xs text-ink/80">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-blue-500 rounded-sm" />
              <span>Leads Created</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-emerald-500 rounded-sm" />
              <span>Leads Won / Admitted</span>
            </div>
          </div>
        </div>
      </div>

      {/* CHARTS ROW 2: Lead Generation Trend & Leads by District */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Lead Generation Trend Area Chart */}
        <div className="bg-elevated border border-line rounded-xl p-4 sm:p-5 shadow-sm">
          <div className="font-semibold text-ink text-sm mb-3">
            Lead Generation Trend
          </div>
          <div className="h-48 w-full pt-2">
            <svg viewBox="0 0 500 180" className="w-full h-full">
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#09929e" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#09929e" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <polyline
                fill="none"
                stroke="#09929e"
                strokeWidth="2.5"
                points={createdTrendCoords.map((c) => `${c.cx},${c.cy}`).join(' ')}
              />
              <polygon
                fill="url(#trendGradient)"
                points={`0,170 ${createdTrendCoords.map((c) => `${c.cx},${c.cy}`).join(' ')} 500,170`}
              />
            </svg>
          </div>
        </div>

        {/* Leads by District */}
        <div className="bg-elevated border border-line rounded-xl p-4 sm:p-5 shadow-sm">
          <div className="font-semibold text-ink text-sm mb-4">Leads by District</div>
          <div className="space-y-3 pt-1">
            {statsData?.leadsByDistrict?.labels && statsData.leadsByDistrict.labels.length > 0 ? (
              statsData.leadsByDistrict.labels.map((districtName, idx) => {
                const count = statsData.leadsByDistrict.data[idx] || 0;
                const total = statsData.totalLeads || 1;
                const pct = Math.min(100, Math.round((count / total) * 100));
                return (
                  <div key={districtName} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-ink/80 font-medium">{districtName}</span>
                      <span className="text-muted font-mono">
                        {count} lead{count === 1 ? '' : 's'} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-line h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-accent h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-xs text-subtle">
                No district leads captured yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LIVE ATTENDANCE TABLE */}
      <div className="bg-elevated border border-line rounded-xl shadow-sm overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-line flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent" />
            <h2 className="font-semibold text-ink text-sm">Live Attendance</h2>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search attendance..."
                value={attendanceSearch}
                onChange={(e) => {
                  setAttendanceSearch(e.target.value);
                  setAttendancePage(1);
                }}
                className="pl-8 pr-3 py-1.5 bg-app border border-line rounded-lg text-xs text-ink placeholder-subtle focus:outline-none focus:ring-1 focus:ring-accent w-full"
              />
            </div>
          </div>
        </div>

        {/* Attendance Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-muted font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-6">Name</th>
                <th className="py-3 px-6">Designation</th>
                <th className="py-3 px-6">District</th>
                <th className="py-3 px-6 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-2">
              {paginatedAttendance.length > 0 ? (
                paginatedAttendance.map((row: AttendanceRecord, idx) => (
                  <tr key={row.id || (row as any)._id || `att-${idx}`} className="hover:bg-hover/60 transition">
                    <td className="py-3.5 px-6 font-medium text-ink">{row.name}</td>
                    <td className="py-3.5 px-6 text-ink/80">{row.designation || '—'}</td>
                    <td className="py-3.5 px-6 text-ink/80">{row.district}</td>
                    <td className="py-3.5 px-6 text-center">
                      {row.status === 'ONLINE' ? (
                        <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider bg-success/10 text-success border border-success/30">
                          ONLINE
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider bg-danger/10 text-danger border border-danger/30">
                          OFFLINE
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-subtle">
                    No attendance records match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <TablePagination
          total={filteredAttendance.length}
          page={attendancePage}
          perPage={attendancePerPage}
          onPageChange={setAttendancePage}
          onPerPageChange={setAttendancePerPage}
          perPageOptions={[5, 10, 25, 50]}
          label="records"
        />
      </div>
    </div>
  );
}
