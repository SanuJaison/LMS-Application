'use client';

import React from 'react';
import Image from 'next/image';
import { Bell, Sun, Moon, LogOut, Menu, X } from 'lucide-react';
import { User } from '../types';

interface NavbarProps {
  user: User | null;
  isDarkMode: boolean;
  toggleTheme: () => void;
  handleLogout: () => void;
  notificationsOpen: boolean;
  setNotificationsOpen: (open: boolean) => void;
  userMenuOpen: boolean;
  setUserMenuOpen: (open: boolean) => void;
  onLogoClick: () => void;
  onToggleMobileSidebar?: () => void;
  isMobileSidebarOpen?: boolean;
}

export default function Navbar({
  user,
  isDarkMode,
  toggleTheme,
  handleLogout,
  notificationsOpen,
  setNotificationsOpen,
  userMenuOpen,
  setUserMenuOpen,
  onLogoClick,
  onToggleMobileSidebar,
  isMobileSidebarOpen = false,
}: NavbarProps) {
  return (
    <header className="h-16 bg-nav border-b border-line flex items-center justify-between px-3 sm:px-4 lg:px-6 z-30 sticky top-0 shrink-0">
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Hamburger Menu Toggle (visible on screens < lg) */}
        {onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="lg:hidden p-2 -ml-1 text-muted hover:text-ink hover:bg-hover rounded-lg transition cursor-pointer"
            aria-label="Toggle navigation menu"
            title={isMobileSidebarOpen ? 'Close Menu' : 'Open Menu'}
          >
            {isMobileSidebarOpen ? <X className="w-5 h-5 text-accent" /> : <Menu className="w-5 h-5" />}
          </button>
        )}

        <div
          onClick={onLogoClick}
          className="cursor-pointer relative w-24 sm:w-28 h-9 sm:h-10 flex items-center"
        >
          <Image
            src="/images/logo.png"
            alt="KIDE Logo"
            width={112}
            height={40}
            priority
            className="object-contain"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="p-2 rounded-full text-muted hover:text-ink hover:bg-hover transition cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
          </button>
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] bg-elevated border border-line rounded-xl shadow-2xl p-4 z-50 text-xs">
              <div className="font-semibold text-ink mb-2">Notifications</div>
              <div className="py-2 text-muted border-b border-line">
                Daily sync completed for Ernakulam field force.
              </div>
              <div className="py-2 text-muted">All local CRM modules operational.</div>
            </div>
          )}
        </div>

        {/* User Profile Avatar "AU" */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-9 h-9 rounded-full bg-line border border-line flex items-center justify-center text-xs font-bold text-ink hover:border-accent transition shadow-inner cursor-pointer"
          >
            AU
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 max-w-[calc(100vw-2rem)] bg-elevated border border-line rounded-xl shadow-2xl py-2 z-50 text-xs">
              <div className="px-4 py-2 border-b border-line">
                <div className="font-semibold text-ink">{user?.name || 'Admin User'}</div>
                <div className="text-muted text-[11px] truncate">{user?.email}</div>
              </div>
              <button
                onClick={toggleTheme}
                className="w-full text-left px-4 py-2 hover:bg-hover flex items-center gap-2 text-ink/80 cursor-pointer"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-warning" /> : <Moon className="w-4 h-4" />}
                <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 hover:bg-danger/10 text-danger flex items-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
