'use client';

import React from 'react';
import {
  Home,
  Activity,
  Briefcase,
  GraduationCap,
  MapPin,
  Users,
  Users2,
  Globe,
  UserPlus,
  Building2,
  CheckSquare,
  Layers,
  Clock,
  CalendarX,
  Wallet,
  CreditCard,
  Settings as SettingsIcon,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  expandedGroups: Record<string, boolean>;
  toggleGroup: (groupKey: string) => void;
  rolesCount?: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({
  activeTab,
  onTabChange,
  expandedGroups,
  toggleGroup,
  rolesCount = 1,
  isOpenMobile = false,
  onCloseMobile,
}: SidebarProps) {
  const handleNav = (tab: string) => {
    onTabChange(tab);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Drawer Backdrop Overlay */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Responsive drawer on mobile/tablet, static sidebar on desktop) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 max-w-[85vw] bg-[#0a101d] border-r border-[#1a253a] flex flex-col overflow-y-auto select-none text-[13px] transition-transform duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        } lg:static lg:w-64 lg:z-auto lg:translate-x-0 shrink-0`}
      >
        {/* Mobile Header with Close Button */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3.5 border-b border-[#1a253a] bg-[#0c1322]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white tracking-wider uppercase">Navigation</span>
            <span className="text-[10px] font-semibold text-[#09929e] bg-[#09929e]/15 px-2 py-0.5 rounded border border-[#09929e]/30">CRM</span>
          </div>
          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 space-y-1">
        {/* Top Standalone Links */}
        <button
          onClick={() => handleNav('dashboard')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-[#1b263b] text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <Home className="w-4 h-4 text-[#09929e]" />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => handleNav('activities')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
            activeTab === 'activities'
              ? 'bg-[#1b263b] text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <Activity className="w-4 h-4 text-slate-400" />
          <span>Activities</span>
        </button>

        <button
          onClick={() => handleNav('designations')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
            activeTab === 'designations'
              ? 'bg-[#1b263b] text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <Briefcase className="w-4 h-4 text-slate-400" />
          <span>Designations</span>
        </button>

        <button
          onClick={() => handleNav('courses')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
            activeTab === 'courses'
              ? 'bg-[#1b263b] text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <GraduationCap className="w-4 h-4 text-slate-400" />
          <span>Courses</span>
        </button>

        {/* Group: Employee Hierarchy */}
        <div className="pt-2">
          <button
            onClick={() => toggleGroup('employeeHierarchy')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 uppercase tracking-wider cursor-pointer"
          >
            <span>Employee Hierarchy</span>
            {expandedGroups.employeeHierarchy ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          {expandedGroups.employeeHierarchy && (
            <div className="space-y-0.5 mt-1 pl-2">
              <button
                onClick={() => handleNav('districts')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'districts'
                    ? 'bg-[#15233e] text-white font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <MapPin className="w-4 h-4" />
                <span>Districts</span>
              </button>
              <button
                id="nav-employees"
                onClick={() => handleNav('employees')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'employees'
                    ? 'bg-[#15233e] text-[#38bdf8] font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <Users className="w-4 h-4 text-[#38bdf8]" />
                <span>Employees</span>
              </button>
              <button
                onClick={() => handleNav('teams')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'teams'
                    ? 'bg-[#15233e] text-white font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <Users2 className="w-4 h-4" />
                <span>Teams</span>
              </button>
              <button
                onClick={() => handleNav('zones')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'zones'
                    ? 'bg-[#15233e] text-white font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span>Zones</span>
              </button>
            </div>
          )}
        </div>

        {/* Group: Lead Management */}
        <div className="pt-2">
          <button
            onClick={() => toggleGroup('leadManagement')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 uppercase tracking-wider cursor-pointer"
          >
            <span>Lead Management</span>
            {expandedGroups.leadManagement ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          {expandedGroups.leadManagement && (
            <div className="space-y-0.5 mt-1 pl-2">
              <button
                onClick={() => handleNav('leads')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'leads'
                    ? 'bg-[#1b263b] text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>Leads</span>
              </button>
            </div>
          )}
        </div>

        {/* Group: Institute Management */}
        <div className="pt-2">
          <button
            onClick={() => toggleGroup('instituteManagement')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 uppercase tracking-wider cursor-pointer"
          >
            <span>Institute Management</span>
            {expandedGroups.instituteManagement ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          {expandedGroups.instituteManagement && (
            <div className="space-y-0.5 mt-1 pl-2">
              <button
                onClick={() => handleNav('institutes')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'institutes'
                    ? 'bg-[#1b263b] text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Institutes</span>
              </button>
            </div>
          )}
        </div>

        {/* Group: Task Management */}
        <div className="pt-2">
          <button
            onClick={() => toggleGroup('taskManagement')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 uppercase tracking-wider cursor-pointer"
          >
            <span>Task Management</span>
            {expandedGroups.taskManagement ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          {expandedGroups.taskManagement && (
            <div className="space-y-0.5 mt-1 pl-2">
              <button
                onClick={() => handleNav('employeeTasks')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'employeeTasks'
                    ? 'bg-[#1b263b] text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                <span>Employee Tasks</span>
              </button>
              <button
                onClick={() => handleNav('taskTemplates')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'taskTemplates'
                    ? 'bg-[#1b263b] text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Task Templates</span>
              </button>
            </div>
          )}
        </div>

        {/* Group: Field Activity */}
        <div className="pt-2">
          <button
            onClick={() => toggleGroup('fieldActivity')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 uppercase tracking-wider cursor-pointer"
          >
            <span>Field Activity</span>
            {expandedGroups.fieldActivity ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          {expandedGroups.fieldActivity && (
            <div className="space-y-0.5 mt-1 pl-2">
              <button
                onClick={() => handleNav('attendanceRecords')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'attendanceRecords'
                    ? 'bg-[#1b263b] text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Attendance Records</span>
              </button>
              <button
                onClick={() => handleNav('leaves')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'leaves'
                    ? 'bg-[#1b263b] text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <CalendarX className="w-4 h-4" />
                <span>Leaves</span>
              </button>
            </div>
          )}
        </div>

        {/* Group: Finances */}
        <div className="pt-2">
          <button
            onClick={() => toggleGroup('finances')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 uppercase tracking-wider cursor-pointer"
          >
            <span>Finances</span>
            {expandedGroups.finances ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          {expandedGroups.finances && (
            <div className="space-y-0.5 mt-1 pl-2">
              <button
                onClick={() => handleNav('wallets')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'wallets'
                    ? 'bg-[#1b263b] text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <Wallet className="w-4 h-4" />
                <span>Wallets</span>
              </button>
              <button
                onClick={() => handleNav('walletWithdrawRequests')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'walletWithdrawRequests'
                    ? 'bg-[#1b263b] text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Wallet Withdraw Requests</span>
              </button>
            </div>
          )}
        </div>

        {/* Group: System Settings */}
        <div className="pt-2">
          <button
            onClick={() => toggleGroup('systemSettings')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 uppercase tracking-wider cursor-pointer"
          >
            <span>System Settings</span>
            {expandedGroups.systemSettings ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          {expandedGroups.systemSettings && (
            <div className="space-y-0.5 mt-1 pl-2">
              <button
                onClick={() => handleNav('settings')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-[#1b263b] text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <SettingsIcon className="w-4 h-4" />
                <span>Settings</span>
              </button>
            </div>
          )}
        </div>

        {/* Group: Roles & Permissions */}
        <div className="pt-2">
          <button
            onClick={() => toggleGroup('rolesPermissions')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 uppercase tracking-wider cursor-pointer"
          >
            <span>Roles & Permissions</span>
            {expandedGroups.rolesPermissions ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          {expandedGroups.rolesPermissions && (
            <div className="space-y-0.5 mt-1 pl-2">
              <button
                onClick={() => handleNav('roles')}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'roles'
                    ? 'bg-[#1b263b] text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Roles</span>
                </div>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#142338] text-cyan-400 border border-cyan-800/60">
                  {rolesCount}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  </>
);
}
