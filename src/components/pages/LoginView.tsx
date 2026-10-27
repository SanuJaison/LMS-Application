'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Sun,
  Moon,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  KeyRound,
  ArrowRight,
} from 'lucide-react';
import { User } from '../../types';
import { loginUser } from '../../services/api';

interface LoginViewProps {
  onLoginSuccess: (user: User, token: string) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export default function LoginView({
  onLoginSuccess,
  isDarkMode,
  toggleTheme,
}: LoginViewProps) {
  // Form input states
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [capsLockActive, setCapsLockActive] = useState<boolean>(false);

  // Validation & Error states
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Initialize remembered email on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedEmail = localStorage.getItem('kide_crm_remembered_email');
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      } else {
        // Pre-fill with admin for convenience
        setEmail('admin@kide.com');
        setPassword('password123');
      }
    }
  }, []);

  // Validation functions
  const validateEmail = (val: string): boolean => {
    const trimmed = val.trim();
    if (!trimmed) {
      setEmailError('Email address or Employee ID is required.');
      return false;
    }
    // Check if it's an email address or valid employee ID
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    const isEmpId = /^EMP-[0-9A-Za-z]+$/i.test(trimmed) || trimmed.toLowerCase() === 'admin';
    if (!isEmail && !isEmpId) {
      setEmailError('Please enter a valid email address (e.g., admin@kide.com) or Employee ID.');
      return false;
    }
    setEmailError(null);
    return true;
  };

  const validatePassword = (val: string): boolean => {
    if (!val) {
      setPasswordError('Password is required.');
      return false;
    }
    if (val.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return false;
    }
    setPasswordError(null);
    return true;
  };

  // Quick fill admin credentials for testing
  const handleQuickFillAdmin = () => {
    setEmail('admin@kide.com');
    setPassword('password123');
    setEmailError(null);
    setPasswordError(null);
    setAuthError(null);
  };

  // Detect Caps Lock
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.getModifierState('CapsLock')) {
      setCapsLockActive(true);
    } else {
      setCapsLockActive(false);
    }
  };

  // Submit Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    setIsProcessing(true);

    try {
      const res = await loginUser(email.trim(), password);

      if (res && res.success && res.user && res.token) {
        // Check Role Authorization (admin, manager, or employee)
        if (res.user.role && res.user.role !== 'admin' && res.user.role !== 'manager' && (res.user.role as string) !== 'employee') {
          setAuthError('Access Denied: Your account role does not have authorization to access this CRM portal.');
          setIsProcessing(false);
          return;
        }

        // Handle remember me
        if (typeof window !== 'undefined') {
          if (rememberMe) {
            localStorage.setItem('kide_crm_remembered_email', email.trim());
          } else {
            localStorage.removeItem('kide_crm_remembered_email');
          }
          // Store token
          localStorage.setItem('auth_token', res.token);
        }

        setAuthSuccess(`Welcome back, ${res.user.name || 'Admin'}! Token authorized.`);
        
        // Brief timeout for smooth UX transition
        setTimeout(() => {
          onLoginSuccess(res.user!, res.token!);
        }, 400);
      } else {
        setAuthError(res?.message || 'Invalid email or password. Please verify credentials.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setAuthError('Connection failed: Unable to connect to authentication server. Please check MongoDB/Backend.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-app text-ink flex flex-col justify-center items-center p-4 relative overflow-hidden selection:bg-accent selection:text-white">
      {/* Background Decorative Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-gradient-to-tr from-accent/15 to-success/10 rounded-full blur-[110px] pointer-events-none" />

      {/* Top Right Theme Toggle */}
      <div className="absolute top-5 right-5 z-20">
        <button
          onClick={toggleTheme}
          type="button"
          aria-label="Toggle theme"
          className="p-2.5 rounded-xl bg-elevated/90 border border-line text-muted hover:text-ink hover:border-line transition shadow-lg cursor-pointer backdrop-blur-md"
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-warning" /> : <Moon className="w-4 h-4 text-accent" />}
        </button>
      </div>

      {/* Login Card Container */}
      <div className="w-full max-w-[450px] bg-elevated/90 border border-line rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl relative z-10 transition-all duration-200">
        {/* Top Header & Logo */}
        <div className="flex flex-col items-center mb-7">
          <div className="relative w-36 h-14 mb-3 flex items-center justify-center">
            <Image
              src="/images/logo.png"
              alt="KIDE CRM"
              fill
              priority
              className="object-contain drop-shadow-[0_2px_12px_rgba(9,146,158,0.3)]"
            />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-ink tracking-tight">Admin Portal Sign In</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-accent/10 border border-accent/30 text-accent">
              JWT HS256
            </span>
          </div>
          <p className="text-xs text-muted text-center">
            Kerala Institute Field CRM • Secure Role-Based Access
          </p>
        </div>

        {/* Auth Error Banner */}
        {authError && (
          <div className="mb-5 p-3.5 bg-danger/10 border border-danger/30 rounded-xl text-danger text-xs flex items-start gap-2.5 shadow-lg animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="w-4 h-4 shrink-0 text-danger mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block text-danger">Authentication Failed</span>
              <span className="text-danger/90 text-[11px] leading-relaxed">{authError}</span>
            </div>
          </div>
        )}

        {/* Auth Success Banner */}
        {authSuccess && (
          <div className="mb-5 p-3.5 bg-success/10 border border-success/30 rounded-xl text-success text-xs flex items-center gap-2.5 shadow-lg animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-success" />
            <span className="font-medium text-success">{authSuccess}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4" noValidate>
          {/* Email / Employee ID Field */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label
                htmlFor="login-email"
                className="text-xs font-semibold uppercase tracking-wider text-ink/80 flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5 text-accent" />
                Email / Employee ID <span className="text-danger">*</span>
              </label>
            </div>
            <div className="relative">
              <input
                id="login-email"
                type="text"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) validateEmail(e.target.value);
                }}
                onBlur={() => validateEmail(email)}
                placeholder="admin@kide.com"
                className={`w-full px-3.5 py-2.5 pl-3.5 bg-panel border ${
                  emailError
                    ? 'border-danger focus:ring-danger/40'
                    : 'border-line focus:border-accent focus:ring-accent/30'
                } rounded-xl text-sm text-ink placeholder-subtle focus:outline-none focus:ring-2 transition`}
              />
            </div>
            {emailError && (
              <p className="mt-1.5 text-xs text-danger flex items-center gap-1 animate-in fade-in">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{emailError}</span>
              </p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label
                htmlFor="login-password"
                className="text-xs font-semibold uppercase tracking-wider text-ink/80 flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-accent" />
                Password <span className="text-danger">*</span>
              </label>
              {capsLockActive && (
                <span className="text-[10px] font-medium text-warning flex items-center gap-1">
                  CapsLock ON
                </span>
              )}
            </div>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) validatePassword(e.target.value);
                }}
                onBlur={() => validatePassword(password)}
                onKeyDown={handleKeyDown}
                placeholder="••••••••••••"
                className={`w-full px-3.5 py-2.5 pr-10 bg-panel border ${
                  passwordError
                    ? 'border-danger focus:ring-danger/40'
                    : 'border-line focus:border-accent focus:ring-accent/30'
                } rounded-xl text-sm text-ink placeholder-subtle focus:outline-none focus:ring-2 transition`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {passwordError && (
              <p className="mt-1.5 text-xs text-danger flex items-center gap-1 animate-in fade-in">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{passwordError}</span>
              </p>
            )}
          </div>

          {/* Remember Me & Quick Test Fill */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-muted hover:text-ink/80">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded bg-panel border-line text-accent focus:ring-accent cursor-pointer"
              />
              <span>Remember me</span>
            </label>
            <button
              type="button"
              onClick={handleQuickFillAdmin}
              className="text-accent hover:text-accent font-medium text-xs flex items-center gap-1 cursor-pointer transition hover:underline"
              title="Click to fill default admin credentials"
            >
              <Sparkles className="w-3 h-3" />
              <span>Fill Admin Credentials</span>
            </button>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={isProcessing}
            className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-accent to-accent-hover hover:from-accent-hover hover:to-accent active:scale-[0.99] text-white font-medium text-sm rounded-xl shadow-lg shadow-accent/20 transition duration-150 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Authorizing JWT Session...</span>
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>Sign in with Authorization</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </form>

        {/* Footer Security Badges */}
        <div className="mt-6 pt-5 border-t border-line flex flex-col gap-2.5 text-center text-xs text-muted">
          <div className="flex items-center justify-center gap-2 text-[11px] text-muted">
            <ShieldCheck className="w-3.5 h-3.5 text-success" />
            <span>End-to-End Encrypted Token Authentication</span>
          </div>
          <div className="bg-panel/80 border border-line rounded-lg p-2.5 text-[11px] text-muted text-left">
            <div className="font-semibold text-ink/80 mb-1 flex items-center justify-between">
              <span>Default Credentials:</span>
              <span className="text-[10px] text-success font-mono">Role: Admin</span>
            </div>
            <div className="font-mono text-[11px] text-muted space-y-0.5">
              <div>Email: <span className="text-accent">admin@kide.com</span></div>
              <div>Password: <span className="text-accent">password123</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
