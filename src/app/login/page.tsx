'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoginView from '@/components/pages/LoginView';
import { User } from '@/types';

export default function LoginPage() {
  const router = useRouter();
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isVerifyingExistingSession, setIsVerifyingExistingSession] = useState<boolean>(true);

  // Check if theme or token exists on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const theme = localStorage.getItem('theme');
      if (theme === 'light') {
        setIsDarkMode(false);
        document.documentElement.classList.remove('dark');
      } else {
        setIsDarkMode(true);
        document.documentElement.classList.add('dark');
      }

      // Check for active token
      const token = localStorage.getItem('auth_token');
      const cachedSession = localStorage.getItem('user_session');
      if (token && cachedSession) {
        // Already logged in! Redirect to dashboard immediately!
        router.replace('/');
        return;
      }

      if (token) {
        // Verify token with backend
        fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(async (res) => {
            if (res.status === 401) {
              localStorage.removeItem('auth_token');
              localStorage.removeItem('user_session');
              setIsVerifyingExistingSession(false);
              return;
            }
            if (res.ok) {
              const data = await res.json().catch(() => ({}));
              if (data && data.success && data.user) {
                localStorage.setItem('user_session', JSON.stringify(data.user));
                router.replace('/');
                return;
              }
            }
            setIsVerifyingExistingSession(false);
          })
          .catch(() => {
            setIsVerifyingExistingSession(false);
          });
      } else {
        setIsVerifyingExistingSession(false);
      }
    }
  }, [router]);

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

  const handleLoginSuccess = (user: User, token?: string) => {
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('auth_token', token);
      }
      if (user) {
        localStorage.setItem('user_session', JSON.stringify(user));
      }
      const params = new URLSearchParams(window.location.search);
      const redirectPath = params.get('redirect') || '/';
      window.location.href = redirectPath;
    }
  };

  if (isVerifyingExistingSession) {
    return (
      <div className="min-h-screen bg-app flex flex-col items-center justify-center text-ink/80">
        <div className="w-8 h-8 border-2 border-accent/20 border-t-accent rounded-full animate-spin mb-4" />
        <p className="text-xs font-medium text-muted">Verifying session authorization...</p>
      </div>
    );
  }

  return (
    <LoginView
      onLoginSuccess={handleLoginSuccess}
      isDarkMode={isDarkMode}
      toggleTheme={toggleTheme}
    />
  );
}
