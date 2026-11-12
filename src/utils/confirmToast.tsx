'use client';

import React from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, Trash2 } from 'lucide-react';

export interface ConfirmToastOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning';
}

/**
 * Displays an interactive confirmation alert using react-hot-toast
 * and resolves to `true` if the user clicks Confirm, or `false` if Cancelled.
 */
export function confirmDeleteToast({
  title,
  message,
  confirmText = 'Confirm Delete',
  cancelText = 'Cancel',
  variant = 'danger',
}: ConfirmToastOptions): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: boolean, toastId: string) => {
      if (settled) return;
      settled = true;
      toast.dismiss(toastId);
      resolve(result);
    };

    toast.custom(
      (t) => (
        <div
          className={`${
            t.visible ? 'animate-in fade-in zoom-in-95 duration-150' : 'animate-out fade-out duration-150'
          } max-w-md w-full bg-elevated border border-line rounded-2xl shadow-2xl p-4 sm:p-5 pointer-events-auto text-ink`}
        >
          <div className="flex items-start gap-3.5">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                variant === 'warning'
                  ? 'bg-warning/10 text-warning border-warning/30'
                  : 'bg-danger/10 text-danger border-danger/30'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-ink">{title}</h4>
              <p className="text-xs text-muted mt-1 leading-relaxed">{message}</p>
              <div className="mt-4 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => finish(false, t.id)}
                  className="px-3.5 py-1.5 rounded-lg border border-line bg-surface hover:bg-hover text-xs font-semibold text-ink/80 hover:text-ink transition cursor-pointer"
                >
                  {cancelText}
                </button>
                <button
                  type="button"
                  onClick={() => finish(true, t.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-danger hover:bg-danger/90 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{confirmText}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        id: 'admin-confirm-delete-toast',
        duration: Infinity,
        position: 'top-center',
      }
    );
  });
}
