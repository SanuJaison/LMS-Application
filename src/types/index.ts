export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee' | 'manager';
}

export interface Zone {
  id: string;
  _id?: string;
  name: string;
  description?: string;
  createdAt?: string;
}

export interface District {
  id: string;
  name: string;
  zoneId: string;
  zoneName?: string;
}

export interface Designation {
  id: string;
  name: string;
  prefix: string;
}

export interface Employee {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  contact_number: string;
  designation: string;
  district: string;
  zone: string;
  team?: string;
  upi_id?: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface Course {
  id: string;
  name: string;
  fee: number;
  duration: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface FollowUpLog {
  id?: string;
  _id?: string;
  date: string;
  remarks: string;
  student_interest?: 'High' | 'Medium' | 'Low' | 'Not Interested' | string;
  presentation?: 'Not Scheduled' | 'Scheduled' | 'Completed' | 'Not Attended' | string;
  next_followup_date?: string;
  admission_status?: string;
  proof_url?: string;
  recorded_by?: string;
  createdAt?: string;
}

export interface Lead {
  id: string;
  _id?: string;
  lead_id?: string;
  name: string;
  contact_number?: string;
  phone?: string;
  whats_number?: string;
  whatsapp_number?: string;
  district: string;
  place?: string;
  age?: number | string;
  qualification?: string;
  college_name?: string;
  current_year?: string;
  interested_topic?: string;
  interested_course?: string;
  course?: string;
  employee?: string;
  email?: string;
  address?: string;

  // Follow-up & Admission
  lead_source?: string;
  source?: string;
  student_interest?: 'High' | 'Medium' | 'Low' | 'Not Interested' | string;
  next_followup_date?: string;
  remarks?: string;
  notes?: string;
  admission_status?: string;
  status?: any;
  statusLabel?: string;
  presentation?: 'Not Scheduled' | 'Scheduled' | 'Completed' | 'Not Attended' | string;
  student_id?: string;
  proof_url?: string;
  followups?: FollowUpLog[];
  created_at?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AttendanceRecord {
  id: string;
  name: string;
  designation: string;
  district: string;
  date: string;
  check_in?: string;
  check_out?: string;
  hours_worked?: number;
  status: 'ONLINE' | 'OFFLINE';
}

export interface Team {
  id: string;
  _id?: string;
  name: string;
  district?: string;
  zone?: string;
  team_lead?: string;
  description?: string;
  members_count?: number;
  created_at?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assigned_to: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  due_date: string;
}

export interface Wallet {
  id: string;
  employee: string;
  balance: number;
  currency: string;
  updated_at: string;
}

export interface Withdrawal {
  id: string;
  employee: string;
  amount: number;
  upi_id: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  transaction_id?: string;
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  employee: string;
  type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  type: string;
}

export interface Role {
  id: string;
  name: string;
  guard_name: string;
  permissions_count: number;
  users_count: number;
}

export interface ActivityItem {
  id: string;
  description: string;
  subject_type: string;
  causer_name: string;
  created_at: string;
}

export interface DonutSlice {
  label: string;
  value: number;
  percentage: number;
  color: string;
  strokeDasharray: string;
  strokeDashoffset: number;
}

export interface DashboardStats {
  totalLeads: number;
  newLeadsToday: number;
  activeFieldForce: string;
  totalEmployees: number;
  leadsByStatus: {
    labels: string[];
    data: number[];
    colors: string[];
  };
  leadGenerationTrend: {
    months: string[];
    data: number[];
  };
  leadsByDistrict: {
    labels: string[];
    data: number[];
  };
  liveAttendance: AttendanceRecord[];
  attendancePreview?: AttendanceRecord[];
}
