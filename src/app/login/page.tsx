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
      if (token) {
        // Verify token with backend
        fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => res.json())
          .then((data) => {
            if (data && data.success && data.user) {
              // Valid session -> redirect to dashboard
              router.replace('/');
            } else {
              // Token expired/invalid
              localStorage.removeItem('auth_token');
              setIsVerifyingExistingSession(false);
            }
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
