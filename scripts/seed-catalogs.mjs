/**
 * Ensure the Kerala LMS catalogs exist: zones, districts, designations and
 * courses. These are the values the app was originally seeded with, so the
 * admin dropdowns and the mobile hierarchy filters keep working after a reset.
 *
 * Safe to re-run: an entry is only inserted when it is missing.
 * Existing rows are never renamed, overwritten or deleted.
 *
 * Usage:
 *   node scripts/seed-catalogs.mjs --dry-run
 *   node scripts/seed-catalogs.mjs
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

const ZONES = [
  { name: 'South Zone', description: 'South Kerala regional operations' },
  { name: 'Central Zone', description: 'Central Kerala regional operations' },
  { name: 'North Zone', description: 'North Kerala regional operations' },
];

const DISTRICTS = [
  { name: 'Thiruvananthapuram', zone: 'South Zone' },
  { name: 'Kollam', zone: 'South Zone' },
  { name: 'Pathanamthitta', zone: 'South Zone' },
  { name: 'Alappuzha', zone: 'South Zone' },
  { name: 'Kottayam', zone: 'South Zone' },
  { name: 'Idukki', zone: 'Central Zone' },
  { name: 'Ernakulam', zone: 'Central Zone' },
  { name: 'Thrissur', zone: 'Central Zone' },
  { name: 'Palakkad', zone: 'Central Zone' },
  { name: 'Malappuram', zone: 'Central Zone' },
  { name: 'Wayanad', zone: 'North Zone' },
  { name: 'Kozhikode', zone: 'North Zone' },
  { name: 'Kannur', zone: 'North Zone' },
  { name: 'Kasaragod', zone: 'North Zone' },
];

// The organisation roles plus the field roles the app shipped with. Entries are
// matched by prefix, so an existing role (including the legacy BDM spelling)
// is never duplicated.
const DESIGNATIONS = [
  { name: 'Managing Director', prefix: 'MD' },
  { name: 'Bussiness Developement Manager', prefix: 'BDM' },
  { name: 'Sales Manager', prefix: 'SM' },
  { name: 'Area Sales Manager', prefix: 'ASM' },
  { name: 'Business Development Executive', prefix: 'BDE' },
  { name: 'Zonal Manager', prefix: 'ZM' },
  { name: 'District Team Lead', prefix: 'DTL' },
  { name: 'Senior Field Executive', prefix: 'SFE' },
  { name: 'Field Executive', prefix: 'FE' },
  { name: 'Relationship Officer', prefix: 'RO' },
];

const COURSES = [
  { name: 'Full-Stack Web Development', fee: 25000, duration: '6 Months', status: 'active' },
  { name: 'Data Science & Machine Learning', fee: 30000, duration: '6 Months', status: 'active' },
  { name: 'Digital Marketing Pro', fee: 15000, duration: '3 Months', status: 'active' },
  { name: 'Flutter & Mobile App Development', fee: 20000, duration: '4 Months', status: 'active' },
];

await mongoose.connect(uri);
const db = mongoose.connection.db;

let created = 0;
let skipped = 0;

async function ensure(collection, label, match, document) {
  const existing = await db.collection(collection).findOne(match);
  if (existing) {
    skipped += 1;
    console.log(`= ${label} already exists`);
    return;
  }

  if (!dryRun) {
    await db.collection(collection).insertOne({
      ...document,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  created += 1;
  console.log(`+ ${label}`);
}

// Zones
for (const zone of ZONES) {
  await ensure(
    'zones',
    `zone: ${zone.name}`,
    { name: { $regex: `^${zone.name}$`, $options: 'i' } },
    zone
  );
}

// Districts
for (const district of DISTRICTS) {
  await ensure(
    'districts',
    `district: ${district.name} (${district.zone})`,
    { name: { $regex: `^${district.name}$`, $options: 'i' } },
    district
  );
}

// Designations (match on prefix so renamed legacy roles are not duplicated)
for (const designation of DESIGNATIONS) {
  await ensure(
    'designations',
    `designation: ${designation.name} (${designation.prefix})`,
    { prefix: { $regex: `^${designation.prefix}$`, $options: 'i' } },
    designation
  );
}

// Courses (match on the normalised name)
for (const course of COURSES) {
  const existing = await db.collection('courses').findOne({
    name: { $regex: `^${course.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
  });

  if (existing) {
    skipped += 1;
    console.log(`= course: ${course.name} already exists`);
    continue;
  }

  if (!dryRun) {
    await db.collection('courses').insertOne({
      ...course,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  created += 1;
  console.log(`+ course: ${course.name}`);
}

const totals = {
  zones: await db.collection('zones').countDocuments(),
  districts: await db.collection('districts').countDocuments(),
  designations: await db.collection('designations').countDocuments(),
  courses: await db.collection('courses').countDocuments(),
};

console.log(
  `${dryRun ? 'DRY RUN — no changes written.' : 'Catalog seed complete.'} created=${created} skipped=${skipped}`
);
console.log(
  `totals: zones=${totals.zones} districts=${totals.districts} designations=${totals.designations} courses=${totals.courses}`
);

await mongoose.disconnect();
