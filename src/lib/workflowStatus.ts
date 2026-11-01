/**
 * Shared status labels for the two four-step approval workflows:
 *
 *   BDE -> ASM -> SM -> Admin/Accounts -> Payment
 *
 * Internally the request keeps a granular stage ("Submitted to ASM",
 * "Forwarded to SM", "Forwarded to Accounts") so the approval history is
 * auditable. Every dashboard shows the same simplified label:
 *
 *   Pending   - still somewhere in the ASM -> SM -> Accounts chain
 *   Approved  - admin/accounts sanctioned the payment
 *   Paid      - payment disbursed and a transaction reference stored
 *   Rejected  - rejected at any step (amount refunded for withdrawals)
 */

export type DisplayStatus = 'Pending' | 'Approved' | 'Paid' | 'Rejected';

export function displayStatus(status: string | null | undefined): DisplayStatus {
  const value = String(status || '').trim();
  if (value === 'Approved') return 'Approved';
  if (value === 'Paid') return 'Paid';
  if (value === 'Rejected') return 'Rejected';
  return 'Pending';
}

/** Numeric status used by the mobile wallet widget. */
export function displayStatusNumber(status: string | null | undefined): number {
  const label = displayStatus(status);
  if (label === 'Approved') return 2;
  if (label === 'Paid') return 3;
  if (label === 'Rejected') return 4;
  return 1;
}

/**
 * The stage a request must be in before an action can run.
 * `null` means the action is allowed from any non-final stage (reject).
 */
export const STAGE_BY_ACTION: Record<string, string | null> = {
  forward_to_sm: 'Submitted to ASM',
  asm_approve: 'Submitted to ASM',
  forward_to_accounts: 'Forwarded to SM',
  sm_approve: 'Forwarded to SM',
  sanction: 'Forwarded to Accounts',
  approve: 'Forwarded to Accounts',
  accounts_approve: 'Forwarded to Accounts',
  pay: 'Approved',
  mark_paid: 'Approved',
  reject: null,
};

/** True when the request has already reached a final state. */
export function isFinalStatus(status: string | null | undefined): boolean {
  return ['Approved', 'Paid', 'Rejected'].includes(String(status || ''));
}

/**
 * Validate a workflow transition. Returns an error message or null.
 */
export function transitionProblem(
  action: string,
  currentStatus: string | null | undefined
): string | null {
  const current = String(currentStatus || 'Submitted to ASM');
  const expected = STAGE_BY_ACTION[action];

  // Paid and Rejected are terminal. Approved is terminal for every action
  // except `pay` / `mark_paid`, which move Approved -> Paid.
  if (current === 'Paid' || current === 'Rejected') {
    return `This request is already ${current} and cannot be changed.`;
  }
  if (current === 'Approved' && !['pay', 'mark_paid'].includes(action)) {
    return `This request is already Approved and cannot be changed.`;
  }

  if (expected && current !== expected) {
    return `Invalid step: "${action}" requires status "${expected}", but the request is currently "${current}".`;
  }

  return null;
}
