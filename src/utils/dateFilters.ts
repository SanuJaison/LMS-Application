const MONTH_NAMES_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_MAP: Record<string, string> = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
};

/**
 * Extracts a normalized "YYYY-MM" month key from any date string, Date object,
 * or human-readable period (e.g. "2026-11-07", "Aug 25, 2026", "November 2026").
 */
export function extractMonthKey(raw: any): string {
  if (!raw) return '';
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  const str = String(raw).trim();
  if (!str) return '';

  // 1. ISO-like YYYY-MM or YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}`;
  }

  // 2. DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const mm = dmyMatch[2].padStart(2, '0');
    return `${dmyMatch[3]}-${mm}`;
  }

  // 3. Month name + Year (e.g. "Aug 25, 2026", "November 2026", "25 Aug 2026")
  const wordYearMatch = str.match(/([a-zA-Z]{3,9})[\s,\-\d]*?(\d{4})/);
  if (wordYearMatch) {
    const mKey = wordYearMatch[1].toLowerCase();
    const mm = MONTH_MAP[mKey] || MONTH_MAP[mKey.slice(0, 3)];
    if (mm) {
      return `${wordYearMatch[2]}-${mm}`;
    }
  }

  // 4. Fallback Date parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  return '';
}

/**
 * Formats a "YYYY-MM" month key into a human-friendly label like "November 2026".
 */
export function formatMonthLabel(monthKey: string): string {
  const match = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return monthKey;
  const year = match[1];
  const monthIdx = parseInt(match[2], 10) - 1;
  const monthName = MONTH_NAMES_FULL[monthIdx];
  return monthName ? `${monthName} ${year}` : monthKey;
}

/**
 * Returns a sorted list of month options (`{ value: 'YYYY-MM', label: 'Month YYYY' }`)
 * covering all 12 months of the current year plus any additional months found in data.
 */
export function buildMonthOptions(
  dataDates: any[] = []
): Array<{ value: string; label: string }> {
  const currentYear = new Date().getFullYear();
  const keys = new Set<string>();

  for (let m = 1; m <= 12; m++) {
    keys.add(`${currentYear}-${String(m).padStart(2, '0')}`);
  }

  for (const raw of dataDates) {
    const k = extractMonthKey(raw);
    if (k) keys.add(k);
  }

  return Array.from(keys)
    .sort((a, b) => b.localeCompare(a))
    .map((value) => ({
      value,
      label: formatMonthLabel(value),
    }));
}

/**
 * Checks whether any of the candidate date values on a record match the selected "YYYY-MM" monthKey.
 */
export function matchesMonthFilter(
  monthFilter: string,
  ...candidateDates: any[]
): boolean {
  if (!monthFilter || monthFilter === 'all') return true;
  for (const candidate of candidateDates) {
    if (!candidate) continue;
    if (extractMonthKey(candidate) === monthFilter) {
      return true;
    }
  }
  return false;
}
