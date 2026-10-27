/**
 * Seed tasks and leads for the hierarchy test accounts:
 *   BDEs under BDM004 : BDE002, BDE004, BDE005, BDE006
 *   BDMs under ASM001 : BDM001, BDM004
 *
 * Safe to re-run: each task/lead is checked before it is inserted.
 *
 * Usage:
 *   node scripts/seed-team-data.mjs --dry-run
 *   node scripts/seed-team-data.mjs
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const mongoose = require('mongoose');

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.trim().startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [
          line.slice(0, index).trim(),
          line.slice(index + 1).trim().replace(/^["']|["']$/g, ''),
        ];
      })
  );
}

const env = loadEnv();
const uri = process.env.MONGODB_URL || env.MONGODB_URL;
if (!uri) {
  console.error('MONGODB_URL is not set (checked the environment and .env).');
  process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');

const SEED = {
  BDE002: {
    tasks: [
      { template: 'Daily Lead Generation', target: 15, achieved: 15, completed: true, metric: 'Leads Generated' },
      { template: 'Daily Lead Generation', target: 20, achieved: 12, completed: false, metric: 'Leads Generated' },
    ],
    leads: [
      { name: 'Rohan Menon', phone: '9847011201', course: 'Data Science & Machine Learning', status: 'New', interest: 'High', source: 'Cold Call' },
      { name: 'Sneha Pillai', phone: '9847011202', course: 'Full-Stack Web Development', status: 'Follow Up', interest: 'Medium', source: 'Reference' },
    ],
  },
  BDE004: {
    tasks: [
      { template: 'Daily Lead Generation', target: 15, achieved: 15, completed: true, metric: 'Leads Generated' },
      { template: 'Daily Lead Generation', target: 20, achieved: 12, completed: false, metric: 'Leads Generated' },
    ],
    leads: [
      { name: 'Aditya Nair', phone: '9847011203', course: 'Digital Marketing Pro', status: 'Follow Up', interest: 'High', source: 'Reference' },
      { name: 'Meera Krishnan', phone: '9847011204', course: 'Flutter & Mobile App Development', status: 'New', interest: 'Medium', source: 'Cold Call' },
    ],
  },
  BDE005: {
    tasks: [
      { template: 'Daily Lead Generation', target: 15, achieved: 15, completed: true, metric: 'Leads Generated' },
      { template: 'Daily Lead Generation', target: 20, achieved: 12, completed: false, metric: 'Leads Generated' },
    ],
    leads: [
      { name: 'Vishal Thomas', phone: '9847011205', course: 'Cyber Security', status: 'New', interest: 'High', source: 'Cold Call' },
      { name: 'Anjali Ramesh', phone: '9847011206', course: 'Data Science & Machine Learning', status: 'Admitted', interest: 'High', source: 'Reference', admitted: true, studentId: 'STU-SEED-001' },
    ],
  },
  BDE006: {
    tasks: [
      { template: 'Daily Lead Generation', target: 15, achieved: 15, completed: true, metric: 'Leads Generated' },
      { template: 'Daily Lead Generation', target: 20, achieved: 12, completed: false, metric: 'Leads Generated' },
    ],
    leads: [
      { name: 'Nikhil Das', phone: '9847011207', course: 'Full-Stack Web Development', status: 'New', interest: 'Medium', source: 'Cold Call' },
      { name: 'Divya Suresh', phone: '9847011208', course: 'Digital Marketing Pro', status: 'Follow Up', interest: 'High', source: 'Reference' },
    ],
  },
  BDM001: {
    tasks: [
      { template: 'Team Performance Review', target: 5, achieved: 5, completed: true, metric: 'Team Reviews' },
      { template: 'Daily Lead Generation', target: 10, achieved: 4, completed: false, metric: 'Leads Generated' },
    ],
    leads: [
      { name: 'Sreejith Kumar', phone: '9847011209', course: 'Data Science & Machine Learning', status: 'New', interest: 'High', source: 'Reference' },
      { name: 'Lakshmi Menon', phone: '9847011210', course: 'Cyber Security', status: 'Follow Up', interest: 'Medium', source: 'Cold Call' },
    ],
  },
  BDM004: {
    tasks: [
      { template: 'Team Performance Review', target: 5, achieved: 5, completed: true, metric: 'Team Reviews' },
      { template: 'Daily Lead Generation', target: 10, achieved: 4, completed: false, metric: 'Leads Generated' },
    ],
    leads: [
      { name: 'Arjun Pillai', phone: '9847011211', course: 'Flutter & Mobile App Development', status: 'New', interest: 'High', source: 'Cold Call' },
      { name: 'Fathima Rasheed', phone: '9847011212', course: 'Full-Stack Web Development', status: 'Admitted', interest: 'High', source: 'Reference', admitted: true, studentId: 'STU-SEED-002' },
    ],
  },
};

await mongoose.connect(uri);
const db = mongoose.connection.db;
const employees = await db.collection('employees').find({}).toArray();
const employeeById = new Map(employees.map((employee) => [employee.employee_id, employee]));

const existingLeads = await db
  .collection('leads')
  .find({}, { projection: { legacy_id: 1, lead_id: 1 } })
  .toArray();
const usedLegacyIds = new Set(
  existingLeads.map((lead) => Number(lead.legacy_id)).filter((value) => !Number.isNaN(value))
);
const usedLeadIds = new Set(existingLeads.map((lead) => String(lead.lead_id || '')).filter(Boolean));

function nextLegacyId() {
  let id = 0;
  do {
    id = Math.floor(100000000 + Math.random() * 900000000);
  } while (usedLegacyIds.has(id));
  usedLegacyIds.add(id);
  return id;
}

function nextLeadId() {
  let id = '';
  do {
    id = `LD-${Math.floor(1000 + Math.random() * 9000)}`;
  } while (usedLeadIds.has(id));
  usedLeadIds.add(id);
  return id;
}

const now = new Date();
const todayLabel = now.toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

let createdTasks = 0;
let createdLeads = 0;
let skipped = 0;

for (const [employeeId, seed] of Object.entries(SEED)) {
  const employee = employeeById.get(employeeId);
  if (!employee) {
    console.log(`! ${employeeId} not found, skipping`);
    continue;
  }

  for (const task of seed.tasks) {
    const existing = await db.collection('employeetasks').findOne({
      employee_id: employeeId,
      task_template: task.template,
      total_target: task.target,
      achieved: task.achieved,
      is_completed: task.completed,
    });

    if (existing) {
      skipped += 1;
      console.log(`= task exists: ${employeeId} ${task.template} target=${task.target} achieved=${task.achieved}`);
      continue;
    }

    if (!dryRun) {
      await db.collection('employeetasks').insertOne({
        employee: employee.name,
        employee_id: employeeId,
        task_template: task.template,
        period_start: todayLabel,
        period_end: todayLabel,
        total_target: task.target,
        achieved: task.achieved,
        is_completed: task.completed,
        metric_type: task.metric,
        notes: '',
        createdAt: now,
        updatedAt: now,
      });
    }
    createdTasks += 1;
    console.log(`+ task: ${employeeId} ${task.template} target=${task.target} achieved=${task.achieved} done=${task.completed}`);
  }

  for (const lead of seed.leads) {
    const existing = await db.collection('leads').findOne({
      employee_id: employeeId,
      name: lead.name,
      contact_number: lead.phone,
    });

    if (existing) {
      skipped += 1;
      console.log(`= lead exists: ${employeeId} ${lead.name}`);
      continue;
    }

    const admissionStatus = lead.status;
    const isAdmitted = Boolean(lead.admitted) || admissionStatus === 'Admitted';

    if (!dryRun) {
      await db.collection('leads').insertOne({
        lead_id: nextLeadId(),
        legacy_id: nextLegacyId(),
        name: lead.name,
        contact_number: lead.phone,
        phone: lead.phone,
        whats_number: lead.phone,
        whatsapp_number: lead.phone,
        district: employee.district || 'Ernakulam',
        place: '',
        age: '',
        qualification: '',
        college_name: '',
        current_year: '',
        interested_topic: lead.course,
        interested_course: lead.course,
        course: lead.course,
        employee: employee.name,
        employee_id: employeeId,
        email: '',
        address: '',
        lead_source: lead.source,
        source: lead.source,
        student_interest: lead.interest,
        next_followup_date: '',
        remarks: '',
        notes: '',
        admission_status: admissionStatus,
        status: admissionStatus,
        presentation: 'Not Scheduled',
        student_id: isAdmitted ? lead.studentId || '' : '',
        payment_verification: isAdmitted ? 'Verified' : 'Pending',
        payment_amount: isAdmitted ? 45000 : 0,
        proof_url: '',
        followups: [],
        createdAt: now,
        updatedAt: now,
      });
    }
    createdLeads += 1;
    console.log(`+ lead: ${employeeId} ${lead.name} (${admissionStatus})`);
  }
}

console.log(
  `${dryRun ? 'DRY RUN — no changes written.' : 'Seed complete.'} tasks=${createdTasks} leads=${createdLeads} skipped=${skipped}`
);

await mongoose.disconnect();
