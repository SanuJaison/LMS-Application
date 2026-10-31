'use client';

import React, { useState, useEffect } from 'react';
import { User } from '../types';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import LoginView from '@/components/pages/LoginView';
import DashboardView from '@/components/pages/DashboardView';
import EmployeesView from '@/components/pages/EmployeesView';
import TeamsView from '@/components/pages/TeamsView';
import ZonesView from '@/components/pages/ZonesView';
import DistrictsView from '@/components/pages/DistrictsView';
import CoursesView from '@/components/pages/CoursesView';
import DesignationsView from '@/components/pages/DesignationsView';
import TaskTemplatesView from '@/components/pages/TaskTemplatesView';
import EmployeeTasksView from '@/components/pages/EmployeeTasksView';
import AttendanceRecordsView from '@/components/pages/AttendanceRecordsView';
import WalletsView from '@/components/pages/WalletsView';
import LeadsView from '@/components/pages/LeadsView';
import InstitutesView from '@/components/pages/InstitutesView';
import LeavesView from '@/components/pages/LeavesView';
import WalletWithdrawRequestsView from '@/components/pages/WalletWithdrawRequestsView';
import RolesView from '@/components/pages/RolesView';
import ActivitiesView from '@/components/pages/ActivitiesView';
import AccountsView from '@/components/pages/AccountsView';
import GenericResourceView from '@/components/pages/GenericResourceView';
import { CheckCircle, AlertCircle } from 'lucide-react';

export default function KeralaCRMApp() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(false);
  const [user, setUser] = useState<User>({
    id: 'usr-admin',
    name: 'Admin User',
    email: 'admin@kide.com',
    role: 'admin',
  });

  // Navigation & View State
  // Start from a deterministic value so server and client render the same
  // markup. The URL ?tab= is applied in the effect below after hydration.
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [rolesCount, setRolesCount] = useState<number>(1);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  // Toast Notifications
  const [toast, setToast] = useState<{ type: 'success' | 'danger'; message: string } | null>(null);

  const showToast = (type: 'success' | 'danger', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  // Verify JWT token on initial load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => res.json())
          .then((data) => {
            if (data && data.success && data.user) {
              setUser(data.user);
              setIsAuthenticated(true);
            }
          })
          .catch((err) => {
            console.error('Session verification error:', err);
          })
          .finally(() => {
            setIsCheckingAuth(false);
          });
      } else {
        setIsCheckingAuth(false);
      }
    }
  }, []);

  // Collapsible Sidebar Groups
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    employeeHierarchy: true,
    leadManagement: true,
    instituteManagement: true,
    taskManagement: true,
    fieldActivity: true,
    finances: true,
    systemSettings: true,
    rolesPermissions: true,
  });

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  // URL Tab Synchronization
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState(null, '', url.toString());
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam) {
        setActiveTab(tabParam);
      } else {
        setActiveTab('dashboard');
      }
    }
  }, []);

  // Theme Management
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        if (next) {
          document.documentElement.classList.add('dark');
          localStorage.setItem('theme', 'dark');
        } else {
          document.documentElement.classList.remove('dark');
          localStorage.setItem('theme', 'light');
        }
      }
      return next;
    });
  };

  // Logout Handler
  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
    setIsAuthenticated(false);
    setUserMenuOpen(false);
    showToast('success', 'Logged out successfully.');
  };

  // 1. Session verification spinner
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-app flex flex-col items-center justify-center text-ink/80">
        <div className="w-8 h-8 border-2 border-accent/20 border-t-accent rounded-full animate-spin mb-4" />
        <p className="text-xs font-medium text-muted">Verifying session authorization...</p>
      </div>
    );
  }

  // 2. Unauthenticated Login Screen
  if (!isAuthenticated) {
    return (
      <LoginView
        onLoginSuccess={(loggedInUser) => {
          setUser(loggedInUser);
          setIsAuthenticated(true);
          showToast('success', `Welcome back, ${loggedInUser.name || 'Admin'}! Authorized.`);
        }}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
      />
    );
  }

  // 3. Authenticated Dashboard & CRM Layout
  return (
    <div className="min-h-screen bg-app text-ink flex flex-col font-sans selection:bg-accent selection:text-white">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-4 left-4 sm:left-auto sm:right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl border text-sm animate-in fade-in slide-in-from-top-2 bg-elevated border-line text-ink max-w-[calc(100vw-2rem)] sm:max-w-sm">
          {toast.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-success" />
          ) : (
            <AlertCircle className="w-5 h-5 text-danger" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        user={user}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        handleLogout={handleLogout}
        notificationsOpen={notificationsOpen}
        setNotificationsOpen={setNotificationsOpen}
        userMenuOpen={userMenuOpen}
        setUserMenuOpen={setUserMenuOpen}
        onLogoClick={() => handleTabChange('dashboard')}
      />

      {/* Main Container: Sidebar + Active Page View */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        {/* Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          expandedGroups={expandedGroups}
          toggleGroup={toggleGroup}
        />

        {/* Dynamic Page Viewport */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-8 bg-panel min-w-0">
          {activeTab === 'dashboard' ? (
            <DashboardView />
          ) : activeTab === 'employees' ? (
            <EmployeesView showToast={showToast} />
          ) : activeTab === 'teams' ? (
            <TeamsView showToast={showToast} />
          ) : activeTab === 'zones' ? (
            <ZonesView showToast={showToast} />
          ) : activeTab === 'districts' ? (
            <DistrictsView showToast={showToast} />
          ) : activeTab === 'courses' ? (
            <CoursesView showToast={showToast} />
          ) : activeTab === 'designations' ? (
            <DesignationsView showToast={showToast} />
          ) : activeTab === 'taskTemplates' || activeTab === 'task-templates' ? (
            <TaskTemplatesView
              showToast={showToast}
              onNavigateToTasks={() => handleTabChange('employeeTasks')}
            />
          ) : activeTab === 'employeeTasks' || activeTab === 'employee-tasks' ? (
            <EmployeeTasksView showToast={showToast} />
          ) : activeTab === 'attendanceRecords' || activeTab === 'attendance' || activeTab === 'attendance-records' ? (
            <AttendanceRecordsView showToast={showToast} />
          ) : activeTab === 'wallets' ? (
            <WalletsView showToast={showToast} />
          ) : activeTab === 'leads' ? (
            <LeadsView showToast={showToast} />
          ) : activeTab === 'institutes' ? (
            <InstitutesView showToast={showToast} />
          ) : activeTab === 'leaves' ? (
            <LeavesView showToast={showToast} />
          ) : activeTab === 'walletWithdrawRequests' || activeTab === 'wallet-withdraw-requests' ? (
            <WalletWithdrawRequestsView showToast={showToast} />
          ) : activeTab === 'roles' ? (
            <RolesView showToast={showToast} onRolesUpdated={setRolesCount} />
          ) : activeTab === 'activities' ? (
            <ActivitiesView />
          ) : activeTab === 'accounts' ? (
            <AccountsView showToast={showToast} />
          ) : (
            <GenericResourceView activeTab={activeTab} showToast={showToast} />
          )}
        </main>
      </div>
    </div>
  );
}
