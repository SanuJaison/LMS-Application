import { Lead } from '@/models/lead';

/**
 * Returns the next sequential custom Student ID: STU-001, STU-002, STU-003...
 */
export async function getNextStudentId(): Promise<string> {
  const leads = await Lead.find(
    { student_id: { $regex: /^STU-\d+$/i } },
    { student_id: 1 }
  ).lean();

  let maxNum = 0;
  for (const lead of leads) {
    const match = String((lead as any).student_id || '').trim().match(/^STU-(\d+)$/i);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `STU-${String(nextNum).padStart(3, '0')}`;
}
