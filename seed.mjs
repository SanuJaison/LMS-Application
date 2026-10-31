// Quick starter script to seed MongoDB with initial data
// Run with: node seed.mjs
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI =
  process.env.MONGODB_URL ||
  process.env.MONGODB_URI ||
  'mongodb+srv://abincs:Abin-c-s@cluster0.neb4vpv.mongodb.net/LMS_Platfrom?appName=Cluster0';

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected successfully!');

  const db = mongoose.connection.db;

  // 1. Admin User
  const usersCol = db.collection('users');
  const userExists = await usersCol.findOne({ email: 'admin@kide.com' });
  const hashedPassword = bcrypt.hashSync('password123', 10);
  if (!userExists) {
    await usersCol.insertOne({
      name: 'Admin User',
      email: 'admin@kide.com',
      password: hashedPassword,
      role: 'admin',
      status: 'active',
      createdAt: new Date(),
    });
    console.log('✅ Admin user created: admin@kide.com / password123');
  }

  // 2. Zones
  const zonesCol = db.collection('zones');
  const zoneCount = await zonesCol.countDocuments();
  if (zoneCount === 0) {
    await zonesCol.insertMany([
      { name: 'South Zone', description: 'South Kerala regional operations', createdAt: new Date() },
      { name: 'Central Zone', description: 'Central Kerala regional operations', createdAt: new Date() },
      { name: 'North Zone', description: 'North Kerala regional operations', createdAt: new Date() },
    ]);
    console.log('✅ 3 Kerala Zones seeded');
  }

  // 3. Districts (All 14 Kerala districts)
  const districtsCol = db.collection('districts');
  const distCount = await districtsCol.countDocuments();
  if (distCount === 0) {
    await districtsCol.insertMany([
      { name: 'Thiruvananthapuram', zone: 'South Zone', createdAt: new Date() },
      { name: 'Kollam', zone: 'South Zone', createdAt: new Date() },
      { name: 'Pathanamthitta', zone: 'South Zone', createdAt: new Date() },
      { name: 'Alappuzha', zone: 'South Zone', createdAt: new Date() },
      { name: 'Kottayam', zone: 'South Zone', createdAt: new Date() },
      { name: 'Idukki', zone: 'Central Zone', createdAt: new Date() },
      { name: 'Ernakulam', zone: 'Central Zone', createdAt: new Date() },
      { name: 'Thrissur', zone: 'Central Zone', createdAt: new Date() },
      { name: 'Palakkad', zone: 'Central Zone', createdAt: new Date() },
      { name: 'Malappuram', zone: 'Central Zone', createdAt: new Date() },
      { name: 'Wayanad', zone: 'North Zone', createdAt: new Date() },
      { name: 'Kozhikode', zone: 'North Zone', createdAt: new Date() },
      { name: 'Kannur', zone: 'North Zone', createdAt: new Date() },
      { name: 'Kasaragod', zone: 'North Zone', createdAt: new Date() },
    ]);
    console.log('✅ 14 Kerala Districts seeded');
  }

  // 4. The 5 Required Courses
  const coursesCol = db.collection('courses');
  const requiredCourses = [
    { name: 'Flutter', fee: 20000, duration: '4 Months', status: 'active' },
    { name: 'Full Stack Development', fee: 25000, duration: '6 Months', status: 'active' },
    { name: 'Cyber Security', fee: 30000, duration: '6 Months', status: 'active' },
    { name: 'Digital Marketing', fee: 15000, duration: '3 Months', status: 'active' },
    { name: 'Data Science Pro', fee: 35000, duration: '6 Months', status: 'active' },
  ];

  for (const c of requiredCourses) {
    await coursesCol.updateOne(
      { name: c.name },
      { $setOnInsert: { ...c, createdAt: new Date(), updatedAt: new Date() } },
      { upsert: true }
    );
  }
  console.log('✅ 5 Standard Courses verified & seeded');

  // 5. The 7 Regional Teams + 1 Office Team
  const teamsCol = db.collection('teams');
  const requiredTeams = [
    { name: 'TVM Team', districts: ['Thiruvananthapuram', 'Kollam'], district: 'Thiruvananthapuram', zone: 'South Zone', is_office: false, description: 'TVM Team - Trivandrum, Kollam' },
    { name: 'PTM Team', districts: ['Pathanamthitta', 'Alappuzha'], district: 'Pathanamthitta', zone: 'South Zone', is_office: false, description: 'PTM Team - Pathanamthitta, Alappuzha' },
    { name: 'KTM Team', districts: ['Kottayam', 'Idukki'], district: 'Kottayam', zone: 'Central Zone', is_office: false, description: 'KTM Team - Kottayam, Idukki' },
    { name: 'EKM Team', districts: ['Ernakulam', 'Thrissur'], district: 'Ernakulam', zone: 'Central Zone', is_office: false, description: 'EKM Team - Ernakulam, Thrissur' },
    { name: 'PKD Team', districts: ['Palakkad', 'Malappuram'], district: 'Palakkad', zone: 'Central Zone', is_office: false, description: 'PKD Team - Palakkad, Malappuram' },
    { name: 'CLT Team', districts: ['Kozhikode', 'Wayanad'], district: 'Kozhikode', zone: 'North Zone', is_office: false, description: 'CLT Team - Kozhikode, Wayanad' },
    { name: 'KZE Team', districts: ['Kannur', 'Kasaragod'], district: 'Kannur', zone: 'North Zone', is_office: false, description: 'KZE Team - Kannur, Kasaragod' },
    { name: 'Office Team', districts: [], district: '', zone: 'Central Zone', is_office: true, description: 'Office Team - Telecallers under Sales Manager' },
  ];

  for (const t of requiredTeams) {
    await teamsCol.updateOne(
      { name: t.name },
      { $setOnInsert: { ...t, createdAt: new Date(), updatedAt: new Date(), members_count: 2 } },
      { upsert: true }
    );
  }
  console.log('✅ 8 Teams (7 Regional + 1 Office Team) verified & seeded');

  // 6. Employees: 1 SM, 7 ASMs, BDEs, Office Team
  const empCol = db.collection('employees');
  const defaultPassword = bcrypt.hashSync('kide1234', 10);

  // Single Sales Manager (SM)
  await empCol.updateOne(
    { employee_id: 'SM001' },
    {
      $setOnInsert: {
        employee_id: 'SM001',
        name: 'Kiran Kumar',
        email: 'sm.kiran@kide.com',
        contact_number: '+91 90000 00000',
        designation: 'Sales Manager',
        district: '',
        zone: '',
        team: '',
        reports_to: '',
        password: defaultPassword,
        status: 'active',
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );

  // 7 ASMs
  const asmSeedData = [
    { id: 'ASM001', name: 'Bipin Joseph', team: 'TVM Team', district: 'Thiruvananthapuram', zone: 'South Zone' },
    { id: 'ASM002', name: 'Sujith Varma', team: 'PTM Team', district: 'Pathanamthitta', zone: 'South Zone' },
    { id: 'ASM003', name: 'Arun George', team: 'KTM Team', district: 'Kottayam', zone: 'Central Zone' },
    { id: 'ASM004', name: 'Anoop Menon', team: 'EKM Team', district: 'Ernakulam', zone: 'Central Zone' },
    { id: 'ASM005', name: 'Fathima Noor', team: 'PKD Team', district: 'Palakkad', zone: 'Central Zone' },
    { id: 'ASM006', name: 'Raghesh Pillai', team: 'CLT Team', district: 'Kozhikode', zone: 'North Zone' },
    { id: 'ASM007', name: 'Sanu Joseph', team: 'KZE Team', district: 'Kannur', zone: 'North Zone' },
  ];

  for (const a of asmSeedData) {
    await empCol.updateOne(
      { employee_id: a.id },
      {
        $setOnInsert: {
          employee_id: a.id,
          name: a.name,
          email: `${a.id.toLowerCase()}@kide.com`,
          contact_number: '+91 90000 00001',
          designation: 'Area Sales Manager',
          district: a.district,
          zone: a.zone,
          team: a.team,
          reports_to: 'SM001',
          password: defaultPassword,
          status: 'active',
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
  }

  // BDEs
  const bdeSeedData = [
    { id: 'BDE001', name: 'Siddharth V', team: 'EKM Team', district: 'Ernakulam', asm: 'ASM004' },
    { id: 'BDE002', name: 'Tony Thomas', team: 'EKM Team', district: 'Thrissur', asm: 'ASM004' },
    { id: 'BDE003', name: 'Aslam K', team: 'TVM Team', district: 'Thiruvananthapuram', asm: 'ASM001' },
    { id: 'BDE004', name: 'Nabeel Ahmed', team: 'CLT Team', district: 'Kozhikode', asm: 'ASM006' },
    { id: 'BDE005', name: 'Reshma Raj', team: 'Office Team', district: 'Ernakulam', asm: 'SM001', desig: 'Tele-caller' },
  ];

  for (const b of bdeSeedData) {
    await empCol.updateOne(
      { employee_id: b.id },
      {
        $setOnInsert: {
          employee_id: b.id,
          name: b.name,
          email: `${b.id.toLowerCase()}@kide.com`,
          contact_number: '+91 98470 54321',
          designation: b.desig || 'Business Development Executive',
          district: b.district,
          zone: 'Central Zone',
          team: b.team,
          reports_to: b.asm,
          password: defaultPassword,
          status: 'active',
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
  }
  console.log('✅ Employees hierarchy verified: 1 SM, 7 ASMs, BDEs, Office Tele-callers');

  // 7. Wallets
  const walletCol = db.collection('wallets');
  await walletCol.updateOne(
    { employee_id: 'BDE001' },
    {
      $setOnInsert: {
        employee: 'Siddharth V',
        employee_id: 'BDE001',
        balance: 3000,
        total_earned: 3000,
        total_paid: 0,
        currency: 'INR',
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );

  console.log('\n🎉 All MongoDB collections seeded successfully with Kerala Institute requirements!');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seeding error:', err);
  process.exit(1);
});
