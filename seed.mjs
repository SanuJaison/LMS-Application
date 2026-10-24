// Quick starter script to seed MongoDB with initial data
// Run with: node seed.mjs
import mongoose from 'mongoose';

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
  if (!userExists) {
    await usersCol.insertOne({
      name: 'Admin User',
      email: 'admin@kide.com',
      password: 'password123',
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

  // 3. Districts
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

  // 4. Employees
  const empCol = db.collection('employees');
  const empCount = await empCol.countDocuments();
  if (empCount === 0) {
    await empCol.insertMany([
      {
        employee_id: 'EMP-001',
        name: 'Rahul Nair',
        email: 'rahul.nair@kide.com',
        contact_number: '+91 98470 12345',
        designation: 'Zonal Manager',
        district: 'Ernakulam',
        zone: 'Central Zone',
        upi_id: 'rahul@okhdfcbank',
        status: 'active',
        createdAt: new Date(),
      },
      {
        employee_id: 'EMP-002',
        name: 'Ananya Varma',
        email: 'ananya.varma@kide.com',
        contact_number: '+91 98471 23456',
        designation: 'District Team Lead',
        district: 'Thiruvananthapuram',
        zone: 'South Zone',
        upi_id: 'ananya@oksbi',
        status: 'active',
        createdAt: new Date(),
      },
      {
        employee_id: 'EMP-003',
        name: 'Faizal Khan',
        email: 'faizal.khan@kide.com',
        contact_number: '+91 98472 34567',
        designation: 'Senior Field Executive',
        district: 'Kozhikode',
        zone: 'North Zone',
        upi_id: 'faizal@okaxis',
        status: 'active',
        createdAt: new Date(),
      },
    ]);
    console.log('✅ Sample Employees seeded');
  }

  // 5. Leads
  const leadsCol = db.collection('leads');
  const leadCount = await leadsCol.countDocuments();
  if (leadCount === 0) {
    await leadsCol.insertMany([
      {
        name: 'Vishnu Prasad',
        phone: '+91 98950 11223',
        email: 'vishnu.p@gmail.com',
        course: 'Full-Stack Web Development',
        district: 'Ernakulam',
        employee: 'Rahul Nair',
        status: 4,
        source: 'Campus Drive',
        notes: 'Enrolled in morning batch',
        createdAt: new Date(),
      },
      {
        name: 'Aparna Raj',
        phone: '+91 98951 22334',
        email: 'aparna.raj@gmail.com',
        course: 'Data Science & Machine Learning',
        district: 'Thiruvananthapuram',
        employee: 'Ananya Varma',
        status: 3,
        source: 'Website Inquiry',
        notes: 'Scheduled counselor meeting',
        createdAt: new Date(),
      },
      {
        name: 'Sneha Mohan',
        phone: '+91 98953 44556',
        email: 'sneha.m@gmail.com',
        course: 'Flutter & Mobile App Development',
        district: 'Thrissur',
        employee: 'Faizal Khan',
        status: 1,
        source: 'Referral',
        notes: 'Requires brochure and fee details',
        createdAt: new Date(),
      },
    ]);
    console.log('✅ Sample Leads seeded');
  }

  // 6. Attendance
  const attCol = db.collection('attendances');
  const attCount = await attCol.countDocuments();
  if (attCount === 0) {
    const today = new Date().toISOString().split('T')[0];
    await attCol.insertMany([
      {
        name: 'Rahul Nair',
        designation: 'Zonal Manager',
        district: 'Ernakulam',
        date: today,
        check_in: '09:02 AM',
        check_out: '06:00 PM',
        hours_worked: 8,
        status: 'ONLINE',
        createdAt: new Date(),
      },
      {
        name: 'Ananya Varma',
        designation: 'District Team Lead',
        district: 'Thiruvananthapuram',
        date: today,
        check_in: '09:15 AM',
        check_out: '06:00 PM',
        hours_worked: 7.5,
        status: 'ONLINE',
        createdAt: new Date(),
      },
    ]);
    console.log('✅ Live Attendance records seeded');
  }

  console.log('\n🎉 All MongoDB collections seeded successfully!');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seeding error:', err);
  process.exit(1);
});
