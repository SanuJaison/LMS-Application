'use client';

import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

export type TablePaginationProps = {
  /** Total number of rows after filtering. */
  total: number;
  /** Current 1-based page. */
  page: number;
  /** Rows per page. */
  perPage: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  /** Noun used in the "Showing x to y of z ___" label. */
  label?: string;
  perPageOptions?: number[];
  className?: string;
};

/**
 * Single pagination footer used by every list/table in the admin UI so the
 * spacing, colours and controls stay identical across pages.
 */
export default function TablePagination({
  total,
  page,
  perPage,
  onPageChange,
  onPerPageChange,
  label = 'results',
  perPageOptions = [10, 25, 50],
  className = '',
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const end = Math.min(currentPage * perPage, total);

  return (
    <div
      className={`px-5 py-3 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] text-muted ${className}`}
    >
      <span>
        Showing{' '}
        <strong className="font-semibold text-ink">{start}</strong> to{' '}
        <strong className="font-semibold text-ink">{end}</strong> of{' '}
        <strong className="font-semibold text-ink">{total}</strong> {label}
      </span>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5">
          <span>Per page</span>
          <span className="relative inline-block">
            <select
              value={perPage}
              onChange={(e) => {
                onPerPageChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="appearance-none bg-field border border-line rounded-lg pl-3 pr-8 py-1 text-ink text-[13px] focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
            >
              {perPageOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </span>
        </label>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous page"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-line text-ink/80 hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Prev</span>
          </button>
          <span className="px-2 text-ink whitespace-nowrap">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            aria-label="Next page"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-line text-ink/80 hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
