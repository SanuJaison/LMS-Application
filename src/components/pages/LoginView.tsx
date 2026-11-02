'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Sun, Moon, AlertCircle } from 'lucide-react';
import { User } from '../../types';
import { loginUser } from '../../services/api';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export default function LoginView({
  onLoginSuccess,
  isDarkMode,
  toggleTheme,
}: LoginViewProps) {
  const [email, setEmail] = useState<string>('admin@kide.com');
  const [password, setPassword] = useState<string>('password123');
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsProcessing(true);

    try {
      const res = await loginUser(email, password);
      if (res && res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setAuthError(res?.message || 'Invalid email or password.');
      }
    } catch {
      setAuthError('Unable to connect to authentication service.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-app text-ink flex flex-col justify-center items-center p-4 selection:bg-accent selection:text-white">
      {/* Top Right Theme Toggle */}
      <div className="absolute top-4 right-4">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-elevated/90 border border-line text-muted hover:text-ink transition-colors cursor-pointer"
        >
          {isDarkMode ? <Sun className="w-5 h-5 text-warning" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      <div className="w-full max-w-[440px] bg-elevated/90 border border-line rounded-2xl shadow-2xl p-8 backdrop-blur-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-40 h-16 mb-2">
            <Image
              src="/images/logo.png"
              alt="KIDE CRM"
              fill
              sizes="160px"
              priority
              className="object-contain"
            />
          </div>
          <h1 className="text-xl font-bold text-ink tracking-tight">Sign in</h1>
          <p className="text-xs text-muted mt-1">Kerala Field CRM & Operations Portal</p>
        </div>

        {authError && (
          <div className="mb-6 p-3.5 bg-danger/10 border border-danger/40 rounded-xl text-danger text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-danger" />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink/80 mb-1.5">
              Email address / Employee ID <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@kide.com"
              className="w-full px-3.5 py-2.5 bg-field border border-line rounded-lg text-sm text-ink placeholder-subtle focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink/80">
                Password <span className="text-danger">*</span>
              </label>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 bg-field border border-line rounded-lg text-sm text-ink placeholder-subtle focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition"
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-muted hover:text-ink/80">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded bg-field border-line text-accent focus:ring-accent"
              />
              Remember me
            </label>
            <span className="text-subtle text-[11px]">(Default: admin@kide.com / password123)</span>
          </div>

          <button
            type="submit"
            disabled={isProcessing}
            className="w-full py-2.5 px-4 bg-accent hover:bg-accent-hover active:bg-accent-hover text-ink font-medium text-sm rounded-lg shadow-md hover:shadow-accent/20 transition duration-150 flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-line text-center">
          <span className="text-xs text-subtle">
            KIDE Kerala CRM • Frontend Architecture Mode
          </span>
        </div>
      </div>
    </div>
  );
}
