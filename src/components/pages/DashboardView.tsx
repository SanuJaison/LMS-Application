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

export default function DashboardView() {
  const [selectedZone, setSelectedZone] = useState<string>('Central Zone');
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

  const totalAttendancePages =
    Math.ceil(filteredAttendance.length / attendancePerPage) || 1;

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

  // Lead Generation Trend (Last 12 Months) Coordinates
  const trendPoints = useMemo(() => {
    if (!statsData?.leadGenerationTrend) return '';
    const data = statsData.leadGenerationTrend.data || [];
    const max = 16;
    const width = 500;
    const height = 180;
    const step = width / (data.length - 1 || 1);

    return data
      .map((val: number, idx: number) => {
        const x = idx * step;
        const y = height - (val / max) * height * 0.85 - 10;
        return `${x},${y}`;
      })
      .join(' ');
  }, [statsData?.leadGenerationTrend]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Dashboard Title & Top Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Filter by Zone */}
          <div className="flex flex-col">
            <label className="text-[11px] font-semibold text-slate-400 mb-1">
              Filter by Zone
            </label>
            <div className="relative inline-flex items-center">
              <select
                value={selectedZone}
                onChange={(e) => {
                  setSelectedZone(e.target.value);
                  setSelectedDistrict('');
                }}
                className="appearance-none bg-[#101726] border border-[#1e2a42] rounded-lg px-3.5 py-1.5 pr-8 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#09929e] shadow-sm cursor-pointer"
              >
                <option value="All Zones">All Zones</option>
                {zonesList.map((z) => (
                  <option key={z.id} value={z.name}>
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
                  className="absolute right-6 text-slate-400 hover:text-white text-xs cursor-pointer"
                  title="Clear zone filter"
                >
                  ×
                </button>
              ) : null}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Filter by District */}
          <div className="flex flex-col">
            <label className="text-[11px] font-semibold text-slate-400 mb-1">
              Filter by District
            </label>
            <div className="relative inline-flex items-center">
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="appearance-none bg-[#101726] border border-[#1e2a42] rounded-lg px-3.5 py-1.5 pr-8 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#09929e] shadow-sm cursor-pointer"
              >
                <option value="">All Districts</option>
                {districtsList
                  .filter((d) => {
                    if (!selectedZone || selectedZone === 'All Zones') return true;
                    return d.zoneName === selectedZone;
                  })
                  .map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* 3 KPI Stats Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Leads Card */}
        <div className="bg-[#101726] border border-[#1e2a42] rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 mb-1">Total Leads</div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {statsData?.totalLeads ?? 15}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-400">
            <Users className="w-3.5 h-3.5 text-[#09929e]" />
            <span>All time leads captured</span>
          </div>
        </div>

        {/* New Leads Today Card */}
        <div className="bg-[#101726] border border-[#1e2a42] rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 mb-1">New Leads Today</div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {statsData?.newLeadsToday ?? 2}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-emerald-400">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Leads generated today</span>
          </div>
        </div>

        {/* Active Field Force Card */}
        <div className="bg-[#101726] border border-[#1e2a42] rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 mb-1">Active Field Force</div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {statsData?.activeFieldForce || '5 / 6'}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-400">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Employees currently checked In ((•))</span>
          </div>
        </div>
      </div>

      {/* CHARTS ROW 1: Leads by Status & Leads Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads by Status (Donut Chart) */}
        <div className="bg-[#101726] border border-[#1e2a42] rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div className="font-semibold text-white text-sm mb-4">Leads by Status</div>
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
                <span className="text-2xl font-bold text-white">
                  {statsData?.totalLeads ?? 15}
                </span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                  Leads
                </span>
              </div>
            </div>

            {/* Donut Legend */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-6 text-[11px] text-slate-300">
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

        {/* Leads Chart (Line Chart May - Oct) */}
        <div className="bg-[#101726] border border-[#1e2a42] rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div className="font-semibold text-white text-sm mb-2">Leads Chart</div>
          <div className="h-56 w-full pt-4">
            <svg viewBox="0 0 500 200" className="w-full h-full">
              <line x1="40" y1="20" x2="480" y2="20" stroke="#1e2a42" strokeDasharray="3 3" />
              <line x1="40" y1="70" x2="480" y2="70" stroke="#1e2a42" strokeDasharray="3 3" />
              <line x1="40" y1="120" x2="480" y2="120" stroke="#1e2a42" strokeDasharray="3 3" />
              <line x1="40" y1="170" x2="480" y2="170" stroke="#1e2a42" />

              <text x="25" y="25" fill="#64748b" fontSize="10">16</text>
              <text x="25" y="75" fill="#64748b" fontSize="10">10</text>
              <text x="25" y="125" fill="#64748b" fontSize="10">4</text>
              <text x="25" y="175" fill="#64748b" fontSize="10">0</text>

              {['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'].map((m, idx) => (
                <text
                  key={m}
                  x={60 + idx * 80}
                  y="192"
                  fill="#64748b"
                  fontSize="10"
                  textAnchor="middle"
                >
                  {m}
                </text>
              ))}

              <polyline
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2.5"
                points="60,170 140,170 220,170 300,25 380,170 460,150"
              />
              {[
                [60, 170],
                [140, 170],
                [220, 170],
                [300, 25],
                [380, 170],
                [460, 150],
              ].map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r="3.5" fill="#3b82f6" stroke="#0e1526" strokeWidth="1.5" />
              ))}

              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                points="60,170 140,170 220,170 300,100 380,170 460,170"
              />
              {[
                [60, 170],
                [140, 170],
                [220, 170],
                [300, 100],
                [380, 170],
                [460, 170],
              ].map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r="3.5" fill="#10b981" stroke="#0e1526" strokeWidth="1.5" />
              ))}
            </svg>
          </div>
          <div className="flex justify-center gap-6 mt-4 text-xs text-slate-300">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-[#3b82f6] rounded-sm" />
              <span>Leads Created</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-[#10b981] rounded-sm" />
              <span>Leads Won</span>
            </div>
          </div>
        </div>
      </div>

      {/* CHARTS ROW 2: Lead Generation Trend & Leads by District */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Generation Trend (Last 12 Months) */}
        <div className="bg-[#101726] border border-[#1e2a42] rounded-xl p-5 shadow-sm">
          <div className="font-semibold text-white text-sm mb-3">
            Lead Generation Trend (Last 12 Months)
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
                points={trendPoints}
              />
              <polygon
                fill="url(#trendGradient)"
                points={`0,170 ${trendPoints} 500,170`}
              />
            </svg>
          </div>
        </div>

        {/* Leads by District */}
        <div className="bg-[#101726] border border-[#1e2a42] rounded-xl p-5 shadow-sm">
          <div className="font-semibold text-white text-sm mb-4">Leads by District</div>
          <div className="space-y-3 pt-1">
            {(statsData?.leadsByDistrict?.labels || ['Ernakulam', 'Trivandrum', 'Kozhikode', 'Thrissur', 'Kottayam']).map(
              (districtName, idx) => {
                const count = statsData?.leadsByDistrict?.data[idx] || (12 - idx * 2);
                const pct = Math.round((count / 15) * 100);
                return (
                  <div key={districtName} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">{districtName}</span>
                      <span className="text-slate-400 font-mono">{count} leads</span>
                    </div>
                    <div className="w-full bg-[#1b253b] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#09929e] h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>
      </div>

      {/* LIVE ATTENDANCE TABLE */}
      <div className="bg-[#101726] border border-[#1e2a42] rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#1c283f] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#09929e]" />
            <h2 className="font-semibold text-white text-sm">Live Attendance</h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search attendance..."
                value={attendanceSearch}
                onChange={(e) => {
                  setAttendanceSearch(e.target.value);
                  setAttendancePage(1);
                }}
                className="pl-8 pr-3 py-1 bg-[#0b1120] border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#09929e] w-48"
              />
            </div>
          </div>
        </div>

        {/* Attendance Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#1c283f] bg-[#0c1322] text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-6">Name</th>
                <th className="py-3 px-6">Designation</th>
                <th className="py-3 px-6">District</th>
                <th className="py-3 px-6 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#172236]">
              {paginatedAttendance.length > 0 ? (
                paginatedAttendance.map((row: AttendanceRecord) => (
                  <tr key={row.id} className="hover:bg-[#131c2e]/60 transition">
                    <td className="py-3.5 px-6 font-medium text-white">{row.name}</td>
                    <td className="py-3.5 px-6 text-slate-300">{row.designation || '—'}</td>
                    <td className="py-3.5 px-6 text-slate-300">{row.district}</td>
                    <td className="py-3.5 px-6 text-center">
                      {row.status === 'ONLINE' ? (
                        <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider bg-[#143625] text-[#34d399] border border-[#065f46]">
                          ONLINE
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider bg-[#3f1618] text-[#f87171] border border-[#7f1d1d]">
                          OFFLINE
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    No attendance records match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Attendance Pagination */}
        <div className="px-6 py-3 border-t border-[#1c283f] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Per page</span>
            <select
              value={attendancePerPage}
              onChange={(e) => {
                setAttendancePerPage(Number(e.target.value));
                setAttendancePage(1);
              }}
              className="bg-[#0b1120] border border-slate-700/80 rounded px-2 py-1 text-xs text-white"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span>
              Page {attendancePage} of {totalAttendancePages}
            </span>
            <button
              disabled={attendancePage <= 1}
              onClick={() => setAttendancePage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded border border-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white cursor-pointer"
            >
              Prev
            </button>
            <button
              disabled={attendancePage >= totalAttendancePages}
              onClick={() => setAttendancePage((p) => Math.min(totalAttendancePages, p + 1))}
              className="px-2.5 py-1 rounded border border-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
