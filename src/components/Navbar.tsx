'use client';

import React from 'react';
import Image from 'next/image';
import { Bell, Sun, Moon, LogOut } from 'lucide-react';
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
}: NavbarProps) {
  return (
    <header className="h-16 bg-[#0d1424] border-b border-[#1c283f] flex items-center justify-between px-4 lg:px-6 z-30 sticky top-0 shrink-0">
      <div className="flex items-center gap-3">
        <div
          onClick={onLogoClick}
          className="cursor-pointer relative w-28 h-10 flex items-center"
        >
          <Image
            src="/images/logo.png"
            alt="KIDE Logo"
            fill
            sizes="112px"
            priority
            className="object-contain"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/60 transition cursor-pointer"
            title="Notifications"
            suppressHydrationWarning
          >
            <Bell className="w-5 h-5" />
          </button>
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-[#121b2f] border border-[#202e47] rounded-xl shadow-2xl p-4 z-50 text-xs">
              <div className="font-semibold text-white mb-2">Notifications</div>
              <div className="py-2 text-slate-400 border-b border-slate-800">
                Daily sync completed for Ernakulam field force.
              </div>
              <div className="py-2 text-slate-400">All local CRM modules operational.</div>
            </div>
          )}
        </div>

        {/* User Profile Avatar "AU" */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-9 h-9 rounded-full bg-[#1e293b] border border-[#334155] flex items-center justify-center text-xs font-bold text-white hover:border-[#09929e] transition shadow-inner cursor-pointer"
            suppressHydrationWarning
          >
            AU
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-[#121b2f] border border-[#202e47] rounded-xl shadow-2xl py-2 z-50 text-xs">
              <div className="px-4 py-2 border-b border-slate-800/80">
                <div className="font-semibold text-white">{user?.name || 'Admin User'}</div>
                <div className="text-slate-400 text-[11px] truncate">{user?.email}</div>
              </div>
              <button
                onClick={toggleTheme}
                className="w-full text-left px-4 py-2 hover:bg-slate-800/60 flex items-center gap-2 text-slate-300 cursor-pointer"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
                <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 hover:bg-red-950/40 text-red-400 flex items-center gap-2 cursor-pointer"
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
