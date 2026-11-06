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
  CheckSquare,
  Layers,
  Target,
  Clock,
  CalendarX,
  Wallet,
  CreditCard,
  Building2,
  Settings as SettingsIcon,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  expandedGroups: Record<string, boolean>;
  toggleGroup: (groupKey: string) => void;
}

export default function Sidebar({
  activeTab,
  onTabChange,
  expandedGroups,
  toggleGroup,
}: SidebarProps) {
  return (
    <aside className="w-64 bg-side border-r border-line flex flex-col overflow-y-auto shrink-0 select-none text-[13px]">
      <div className="p-3 space-y-1">
        {/* Top Standalone Links */}
        <button suppressHydrationWarning
          onClick={() => onTabChange('dashboard')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-active text-ink shadow-sm'
              : 'text-muted hover:text-ink hover:bg-hover'
          }`}
        >
          <Home className="w-4 h-4 text-accent" />
          <span>Dashboard</span>
        </button>

        <button suppressHydrationWarning
          onClick={() => onTabChange('activities')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
            activeTab === 'activities'
              ? 'bg-active text-ink shadow-sm'
              : 'text-muted hover:text-ink hover:bg-hover'
          }`}
        >
          <Activity className="w-4 h-4 text-muted" />
          <span>Activities</span>
        </button>

        <button suppressHydrationWarning
          onClick={() => onTabChange('designations')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
            activeTab === 'designations'
              ? 'bg-active text-ink shadow-sm'
              : 'text-muted hover:text-ink hover:bg-hover'
          }`}
        >
          <Briefcase className="w-4 h-4 text-muted" />
          <span>Designations</span>
        </button>

        <button suppressHydrationWarning
          onClick={() => onTabChange('courses')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
            activeTab === 'courses'
              ? 'bg-active text-ink shadow-sm'
              : 'text-muted hover:text-ink hover:bg-hover'
          }`}
        >
          <GraduationCap className="w-4 h-4 text-muted" />
          <span>Courses</span>
        </button>

        {/* Group: Employee Hierarchy */}
        <div className="pt-2">
          <button suppressHydrationWarning
            onClick={() => toggleGroup('employeeHierarchy')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink uppercase tracking-wider cursor-pointer"
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
              <button suppressHydrationWarning
                onClick={() => onTabChange('districts')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'districts'
                    ? 'bg-active text-ink font-medium'
                    : 'text-muted hover:text-ink hover:bg-hover'
                }`}
              >
                <MapPin className="w-4 h-4" />
                <span>Districts</span>
              </button>
              <button suppressHydrationWarning
                id="nav-employees"
                onClick={() => onTabChange('employees')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'employees'
                    ? 'bg-active text-accent font-medium'
                    : 'text-muted hover:text-ink hover:bg-hover'
                }`}
              >
                <Users className="w-4 h-4 text-accent" />
                <span>Employees</span>
              </button>
              <button suppressHydrationWarning
                onClick={() => onTabChange('teams')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'teams'
                    ? 'bg-active text-ink font-medium'
                    : 'text-muted hover:text-ink hover:bg-hover'
                }`}
              >
                <Users2 className="w-4 h-4" />
                <span>Teams</span>
              </button>
              <button suppressHydrationWarning
                onClick={() => onTabChange('zones')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'zones'
                    ? 'bg-active text-ink font-medium'
                    : 'text-muted hover:text-ink hover:bg-hover'
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
          <button suppressHydrationWarning
            onClick={() => toggleGroup('leadManagement')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink uppercase tracking-wider cursor-pointer"
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
              <button suppressHydrationWarning
                onClick={() => onTabChange('leads')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'leads'
                    ? 'bg-active text-ink'
                    : 'text-muted hover:text-ink hover:bg-hover'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>Leads</span>
              </button>
            </div>
          )}
        </div>

        {/* Group: Task Management */}
        <div className="pt-2">
          <button suppressHydrationWarning
            onClick={() => toggleGroup('taskManagement')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink uppercase tracking-wider cursor-pointer"
          >
            <span>Targets &amp; Performance</span>
            {expandedGroups.taskManagement ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          {expandedGroups.taskManagement && (
            <div className="space-y-0.5 mt-1 pl-2">
              <button suppressHydrationWarning
                onClick={() => onTabChange('employeeTasks')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'employeeTasks'
                    ? 'bg-active text-ink'
                    : 'text-muted hover:text-ink hover:bg-hover'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                <span>Employee Tasks</span>
              </button>
              <button suppressHydrationWarning
                onClick={() => onTabChange('taskTemplates')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'taskTemplates'
                    ? 'bg-active text-ink'
                    : 'text-muted hover:text-ink hover:bg-hover'
                }`}
              >
                <Target className="w-4 h-4" />
                <span>SM Targets</span>
              </button>
            </div>
          )}
        </div>

        {/* Group: Field Activity */}
        <div className="pt-2">
          <button suppressHydrationWarning
            onClick={() => toggleGroup('fieldActivity')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink uppercase tracking-wider cursor-pointer"
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
              <button suppressHydrationWarning
                onClick={() => onTabChange('attendanceRecords')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'attendanceRecords'
                    ? 'bg-active text-ink'
                    : 'text-muted hover:text-ink hover:bg-hover'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Attendance Records</span>
              </button>
              <button suppressHydrationWarning
                onClick={() => onTabChange('leaves')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'leaves'
                    ? 'bg-active text-ink'
                    : 'text-muted hover:text-ink hover:bg-hover'
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
          <button suppressHydrationWarning
            onClick={() => toggleGroup('finances')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink uppercase tracking-wider cursor-pointer"
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
              <button suppressHydrationWarning
                onClick={() => onTabChange('accounts')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'accounts'
                    ? 'bg-active text-ink'
                    : 'text-muted hover:text-ink hover:bg-hover'
                }`}
              >
                <Building2 className="w-4 h-4 text-accent" />
                <span>Accounts &amp; Finance</span>
              </button>
              <button suppressHydrationWarning
                onClick={() => onTabChange('wallets')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'wallets'
                    ? 'bg-active text-ink'
                    : 'text-muted hover:text-ink hover:bg-hover'
                }`}
              >
                <Wallet className="w-4 h-4" />
                <span>Wallets</span>
              </button>
              <button suppressHydrationWarning
                onClick={() => onTabChange('walletWithdrawRequests')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'walletWithdrawRequests'
                    ? 'bg-active text-ink'
                    : 'text-muted hover:text-ink hover:bg-hover'
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
          <button suppressHydrationWarning
            onClick={() => toggleGroup('systemSettings')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink uppercase tracking-wider cursor-pointer"
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
              <button suppressHydrationWarning
                onClick={() => onTabChange('settings')}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-active text-ink'
                    : 'text-muted hover:text-ink hover:bg-hover'
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
          <button suppressHydrationWarning
            onClick={() => toggleGroup('rolesPermissions')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink uppercase tracking-wider cursor-pointer"
          >
            <span>Roles &amp; Permissions</span>
            {expandedGroups.rolesPermissions ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          {expandedGroups.rolesPermissions && (
            <div className="space-y-0.5 mt-1 pl-2">
              <button suppressHydrationWarning
                onClick={() => onTabChange('roles')}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'roles'
                    ? 'bg-active text-ink'
                    : 'text-muted hover:text-ink hover:bg-hover'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Roles</span>
                </div>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-accent/15 text-accent border border-accent/30">
                  3
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
