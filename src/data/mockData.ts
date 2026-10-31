import {
  Zone,
  District,
  Designation,
  Employee,
  Course,
  Lead,
  AttendanceRecord,
  Team,
  Task,
  Wallet,
  Withdrawal,
  LeaveRequest,
  SystemSetting,
  Role,
  ActivityItem,
  DashboardStats,
} from '../types';

export const mockZones: Zone[] = [
  { id: 'zone-1', name: 'South Zone', description: 'South Kerala regional operations' },
  { id: 'zone-2', name: 'Central Zone', description: 'Central Kerala regional operations' },
  { id: 'zone-3', name: 'North Zone', description: 'North Kerala regional operations' },
];

export const mockDistricts: District[] = [
  { id: 'dist-1', name: 'Thiruvananthapuram', zoneId: 'zone-1', zoneName: 'South Zone' },
  { id: 'dist-2', name: 'Kollam', zoneId: 'zone-1', zoneName: 'South Zone' },
  { id: 'dist-3', name: 'Pathanamthitta', zoneId: 'zone-1', zoneName: 'South Zone' },
  { id: 'dist-4', name: 'Alappuzha', zoneId: 'zone-1', zoneName: 'South Zone' },
  { id: 'dist-5', name: 'Kottayam', zoneId: 'zone-1', zoneName: 'South Zone' },
  { id: 'dist-6', name: 'Idukki', zoneId: 'zone-2', zoneName: 'Central Zone' },
  { id: 'dist-7', name: 'Ernakulam', zoneId: 'zone-2', zoneName: 'Central Zone' },
  { id: 'dist-8', name: 'Thrissur', zoneId: 'zone-2', zoneName: 'Central Zone' },
  { id: 'dist-9', name: 'Palakkad', zoneId: 'zone-2', zoneName: 'Central Zone' },
  { id: 'dist-10', name: 'Malappuram', zoneId: 'zone-2', zoneName: 'Central Zone' },
  { id: 'dist-11', name: 'Kozhikode', zoneId: 'zone-3', zoneName: 'North Zone' },
  { id: 'dist-12', name: 'Wayanad', zoneId: 'zone-3', zoneName: 'North Zone' },
  { id: 'dist-13', name: 'Kannur', zoneId: 'zone-3', zoneName: 'North Zone' },
  { id: 'dist-14', name: 'Kasaragod', zoneId: 'zone-3', zoneName: 'North Zone' },
];

export const mockDesignations: Designation[] = [
  { id: 'des-0', name: 'State Manager', prefix: 'SM' },
  { id: 'des-1', name: 'Area Sales Manager', prefix: 'ASM' },
  { id: 'des-2', name: 'Business Development Executive', prefix: 'BDE' },
  { id: 'des-3', name: 'Zonal Manager', prefix: 'ZM' },
  { id: 'des-4', name: 'District Team Lead', prefix: 'DTL' },
  { id: 'des-5', name: 'Senior Field Executive', prefix: 'SFE' },
  { id: 'des-6', name: 'Field Executive', prefix: 'FE' },
  { id: 'des-7', name: 'Relationship Officer', prefix: 'RO' },
];

export const mockCourses: Course[] = [
  { id: 'c-1', name: 'Full-Stack Web Development', fee: 25000, duration: '6 Months', status: 'active', created_at: '2026-01-10' },
  { id: 'c-2', name: 'Data Science & Machine Learning', fee: 30000, duration: '6 Months', status: 'active', created_at: '2026-01-15' },
  { id: 'c-3', name: 'Digital Marketing Pro', fee: 15000, duration: '3 Months', status: 'active', created_at: '2026-02-01' },
  { id: 'c-4', name: 'Flutter & Mobile App Development', fee: 20000, duration: '4 Months', status: 'active', created_at: '2026-02-10' },
];

export const mockEmployees: Employee[] = [
  { id: 'emp-0', employee_id: 'SM001', name: 'Kiran Kumar', email: 'kiran.kumar@kide.com', contact_number: '9000000000', designation: 'State Manager', district: '', zone: '', team: '', reports_to: '', status: 'active', created_at: '2026-05-01' },
  { id: 'emp-1', employee_id: 'ASM001', name: 'Anoop Menon', email: 'anoop.menon@kide.com', contact_number: '9000000001', designation: 'Area Sales Manager', district: 'Ernakulam', zone: 'Central Zone', team: 'Team Ernakulam', reports_to: 'SM001', status: 'active', created_at: '2026-05-01' },
  { id: 'emp-2', employee_id: 'BDE001', name: 'Aslam', email: 'aslam@gmail.com', contact_number: '9746543243', designation: 'Business Development Executive', district: 'Ernakulam', zone: 'Central Zone', team: 'Team Ernakulam', reports_to: 'ASM001', status: 'active', created_at: '2026-05-01' },
  { id: 'emp-3', employee_id: 'BDE002', name: 'Tony', email: 'tony@gmail.com', contact_number: '9876756743', designation: 'Business Development Executive', district: 'Ernakulam', zone: 'Central Zone', team: 'Team Ernakulam', reports_to: 'ASM001', status: 'active', created_at: '2026-05-03' },
  { id: 'emp-4', employee_id: 'BDE003', name: 'Nabeel', email: 'nabeel@gmail.com', contact_number: '9961342543', designation: 'Business Development Executive', district: 'Kozhikode', zone: 'North Zone', team: 'Team Kozhikode', reports_to: 'ASM003', status: 'active', created_at: '2026-05-04' },
  { id: 'emp-5', employee_id: 'BDE004', name: 'Alpha', email: 'alpha@gmail.com', contact_number: '7878645635', designation: 'Business Development Executive', district: 'Ernakulam', zone: 'Central Zone', team: 'Team Ernakulam', reports_to: 'ASM001', status: 'active', created_at: '2026-05-05' },
];

export const mockLeads: Lead[] = [
  { id: 'lead-1', name: 'Vishnu Prasad', phone: '+91 98950 11223', email: 'vishnu.p@gmail.com', course: 'Full-Stack Web Development', district: 'Ernakulam', employee: 'Rahul Nair', status: 4, statusLabel: 'Won', source: 'Campus Drive', notes: 'Enrolled in morning batch', created_at: '2026-05-10' },
  { id: 'lead-2', name: 'Aparna Raj', phone: '+91 98951 22334', email: 'aparna.raj@gmail.com', course: 'Data Science & Machine Learning', district: 'Thiruvananthapuram', employee: 'Ananya Varma', status: 3, statusLabel: 'In Progress', source: 'Website Inquiry', notes: 'Scheduled counselor meeting', created_at: '2026-05-14' },
  { id: 'lead-3', name: 'Muhammed Nishad', phone: '+91 98952 33445', email: 'nishad.m@gmail.com', course: 'Digital Marketing Pro', district: 'Kozhikode', employee: 'Faizal Khan', status: 2, statusLabel: 'Contacted', source: 'Social Media Ad', notes: 'Interested in weekend batch', created_at: '2026-05-18' },
  { id: 'lead-4', name: 'Sneha Mohan', phone: '+91 98953 44556', email: 'sneha.m@gmail.com', course: 'Flutter & Mobile App Development', district: 'Thrissur', employee: 'Deepa Menon', status: 1, statusLabel: 'New', source: 'Referral', notes: 'Requires brochure and fee split', created_at: '2026-05-20' },
  { id: 'lead-5', name: 'Kavya Suresh', phone: '+91 98954 55667', email: 'kavya.s@gmail.com', course: 'Full-Stack Web Development', district: 'Kottayam', employee: 'Arun George', status: 4, statusLabel: 'Won', source: 'Direct Inflow', notes: 'Fee paid in full', created_at: '2026-05-22' },
  { id: 'lead-6', name: 'Midhun Joy', phone: '+91 98955 66778', email: 'midhun.joy@gmail.com', course: 'Data Science & Machine Learning', district: 'Palakkad', employee: 'Rahul Nair', status: 5, statusLabel: 'Lost', source: 'Job Portal', notes: 'Relocated out of state', created_at: '2026-05-25' },
];

export const mockLiveAttendance: AttendanceRecord[] = [
  { id: 'att-1', name: 'Rahul Nair', designation: 'Zonal Manager', district: 'Ernakulam', date: '2026-10-19', check_in: '09:02 AM', status: 'ONLINE', hours_worked: 7.5 },
  { id: 'att-2', name: 'Ananya Varma', designation: 'District Team Lead', district: 'Thiruvananthapuram', date: '2026-10-19', check_in: '09:15 AM', status: 'ONLINE', hours_worked: 7.2 },
  { id: 'att-3', name: 'Faizal Khan', designation: 'Senior Field Executive', district: 'Kozhikode', date: '2026-10-19', check_in: '09:30 AM', status: 'ONLINE', hours_worked: 7.0 },
  { id: 'att-4', name: 'Deepa Menon', designation: 'Field Executive', district: 'Thrissur', date: '2026-10-19', check_in: '09:45 AM', status: 'ONLINE', hours_worked: 6.8 },
  { id: 'att-5', name: 'Arun George', designation: 'Relationship Officer', district: 'Kottayam', date: '2026-10-19', check_in: '10:00 AM', status: 'ONLINE', hours_worked: 6.5 },
  { id: 'att-6', name: 'Sujith Kumar', designation: 'Field Executive', district: 'Malappuram', date: '2026-10-19', status: 'OFFLINE', hours_worked: 0 },
];

export const mockTeams: Team[] = [
  { id: 'team-0', name: 'Office Team', district: '', zone: 'Central Zone', team_lead: '', is_office: true, description: 'Central office operations', members_count: 3 },
  { id: 'team-1', name: 'Team Ernakulam', district: 'Ernakulam, Idukki', zone: 'Central Zone', team_lead: 'Anoop Menon (ASM001)', description: 'Ernakulam & Idukki field operations', members_count: 5 },
  { id: 'team-2', name: 'Team Thrissur', district: 'Thrissur, Palakkad', zone: 'Central Zone', team_lead: 'Divya Nair (ASM002)', description: 'Thrissur & Palakkad admissions', members_count: 4 },
  { id: 'team-3', name: 'Team Kozhikode', district: 'Kozhikode, Wayanad', zone: 'North Zone', team_lead: 'Arjun Pillai (ASM003)', description: 'Kozhikode & Wayanad field tasks', members_count: 4 },
  { id: 'team-4', name: 'Team Kannur', district: 'Kannur, Kasaragod', zone: 'North Zone', team_lead: 'Sanu Joseph (ASM004)', description: 'Kannur & Kasaragod admissions', members_count: 4 },
];

export const mockTasks: Task[] = [
  { id: 'task-1', title: 'Conduct Campus Seminar at CUSAT', description: 'Prepare tech presentation and capture student leads', assigned_to: 'Rahul Nair', priority: 'high', status: 'in_progress', due_date: '2026-10-25' },
  { id: 'task-2', title: 'Verify Malappuram Field Reports', description: 'Cross-check lead details with call logs', assigned_to: 'Sujith Kumar', priority: 'medium', status: 'pending', due_date: '2026-10-22' },
  { id: 'task-3', title: 'Review Q3 Enrollment Target', description: 'Consolidate zone leads won and fee transactions', assigned_to: 'Ananya Varma', priority: 'high', status: 'completed', due_date: '2026-10-15' },
];

export const mockWallets: Wallet[] = [
  { id: 'wal-1', employee: 'Rahul Nair', balance: 14200, currency: 'INR', updated_at: '2026-10-18' },
  { id: 'wal-2', employee: 'Ananya Varma', balance: 9500, currency: 'INR', updated_at: '2026-10-18' },
  { id: 'wal-3', employee: 'Faizal Khan', balance: 11800, currency: 'INR', updated_at: '2026-10-17' },
];

export const mockWithdrawals: Withdrawal[] = [
  { id: 'wdr-1', employee: 'Rahul Nair', amount: 5000, upi_id: 'rahul@okhdfcbank', status: 'Approved', transaction_id: 'TXN99281203', created_at: '2026-10-16' },
  { id: 'wdr-2', employee: 'Faizal Khan', amount: 3500, upi_id: 'faizal@okaxis', status: 'Pending', created_at: '2026-10-18' },
];

export const mockLeaves: LeaveRequest[] = [
  { id: 'lev-1', employee: 'Sujith Kumar', type: 'Sick Leave', start_date: '2026-10-19', end_date: '2026-10-20', reason: 'Medical appointment', status: 'Approved' },
  { id: 'lev-2', employee: 'Deepa Menon', type: 'Casual Leave', start_date: '2026-10-28', end_date: '2026-10-29', reason: 'Family function', status: 'Pending' },
];

export const mockSettings: SystemSetting[] = [
  { id: 'set-1', key: 'app_name', value: 'KIDE Kerala Field CRM', type: 'string' },
  { id: 'set-2', key: 'daily_checkin_cutoff', value: '10:00 AM', type: 'time' },
  { id: 'set-3', key: 'commission_per_lead_won', value: '1500', type: 'currency' },
];

export const mockRoles: Role[] = [
  { id: 'rol-1', name: 'Super Admin', guard_name: 'web', permissions_count: 48, users_count: 2 },
  { id: 'rol-2', name: 'Zonal Lead', guard_name: 'web', permissions_count: 24, users_count: 5 },
  { id: 'rol-3', name: 'Field Executive', guard_name: 'web', permissions_count: 12, users_count: 28 },
];

export const mockActivities: ActivityItem[] = [
  { id: 'act-1', description: 'Lead Vishnu Prasad marked as WON by Rahul Nair', subject_type: 'Lead', causer_name: 'Rahul Nair', created_at: '10 minutes ago' },
  { id: 'act-2', description: 'Attendance check-in logged for Ernakulam field force', subject_type: 'Attendance', causer_name: 'System', created_at: '1 hour ago' },
  { id: 'act-3', description: 'New Course Data Science & Machine Learning created', subject_type: 'Course', causer_name: 'Admin User', created_at: 'Yesterday' },
];

export const getMockDashboardStats = (selectedZone?: string, selectedDistrict?: string): DashboardStats => {
  let filteredLeads = [...mockLeads];
  let filteredEmployees = [...mockEmployees];
  let filteredAttendance = [...mockLiveAttendance];

  if (selectedZone && selectedZone !== 'All Zones') {
    const districtsInZone = mockDistricts
      .filter((d) => d.zoneName === selectedZone)
      .map((d) => d.name);
    filteredLeads = filteredLeads.filter((l) => districtsInZone.includes(l.district));
    filteredEmployees = filteredEmployees.filter((e) => e.zone === selectedZone);
    filteredAttendance = filteredAttendance.filter((a) => districtsInZone.includes(a.district));
  }

  if (selectedDistrict && selectedDistrict !== 'All Districts') {
    filteredLeads = filteredLeads.filter((l) => l.district === selectedDistrict);
    filteredEmployees = filteredEmployees.filter((e) => e.district === selectedDistrict);
    filteredAttendance = filteredAttendance.filter((a) => a.district === selectedDistrict);
  }

  const onlineCount = filteredAttendance.filter((a) => a.status === 'ONLINE').length;
  const totalLeadsCount = filteredLeads.length;

  return {
    totalLeads: totalLeadsCount,
    newLeadsToday: Math.min(2, totalLeadsCount),
    activeFieldForce: `${onlineCount} / ${filteredEmployees.length || 1}`,
    totalEmployees: filteredEmployees.length || 1,
    leadsByStatus: {
      labels: ['New', 'Contacted', 'In Progress', 'Won', 'Lost'],
      data: [
        filteredLeads.filter((l) => l.status === 1).length || 1,
        filteredLeads.filter((l) => l.status === 2).length || 1,
        filteredLeads.filter((l) => l.status === 3).length || 2,
        filteredLeads.filter((l) => l.status === 4).length || 2,
        filteredLeads.filter((l) => l.status === 5).length || 1,
      ],
      colors: ['#09929e', '#f59e0b', '#3b82f6', '#10b981', '#ef4444'],
    },
    leadGenerationTrend: {
      months: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
      data: [3, 5, 8, 14, 9, 12],
    },
    leadsByDistrict: {
      labels: ['Ernakulam', 'Trivandrum', 'Kozhikode', 'Thrissur', 'Kottayam'],
      data: [12, 9, 8, 6, 4],
    },
    liveAttendance: filteredAttendance,
  };
};
