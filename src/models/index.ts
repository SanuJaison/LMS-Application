import mongoose, { Schema } from 'mongoose';

// Export individual models
export * from './users';
export * from './zone';
export * from './lead';
export * from './attendence';
export * from './employee';
export * from './taskTemplate';
export * from './employeeTask';

// District & Course models now live in their own files
export { District } from './districtModel';
export { Course } from './courseModel';

// Designation Schema & Model
const DesignationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    prefix: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);
export const Designation =
  mongoose.models.Designation || mongoose.model('Designation', DesignationSchema);

// Task Schema & Model
const TaskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    assigned_to: { type: String, default: 'Unassigned' },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
    due_date: { type: String, default: '' },
  },
  { timestamps: true }
);
export const Task = mongoose.models.Task || mongoose.model('Task', TaskSchema);

// Team Schema & Model
const TeamSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    district: { type: String, default: 'Ernakulam', trim: true },
    zone: { type: String, default: 'Central Zone' },
    team_lead: { type: String, default: '' },
    description: { type: String, default: '' },
    members_count: { type: Number, default: 0 },
  },
  { timestamps: true }
);
if (mongoose.models.Team) {
  mongoose.deleteModel('Team');
}
export const Team = mongoose.model('Team', TeamSchema);

// Wallet Schema & Model
const WalletSchema = new Schema(
  {
    employee: { type: String, required: true },
    balance: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
  },
  { timestamps: true }
);
export const Wallet =
  mongoose.models.Wallet || mongoose.model('Wallet', WalletSchema);

// Activity Log Schema & Model
const ActivityLogSchema = new Schema(
  {
    description: { type: String, required: true },
    subject_type: { type: String, default: 'General' },
    causer_name: { type: String, default: 'System' },
  },
  { timestamps: true }
);
export const ActivityLog =
  mongoose.models.ActivityLog || mongoose.model('ActivityLog', ActivityLogSchema);

// Leave Schema & Model
const LeaveSchema = new Schema(
  {
    employee: { type: String, required: true },
    leave_type: { type: String, default: 'Casual Leave' },
    start_date: { type: String, required: true },
    end_date: { type: String, required: true },
    reason: { type: String, default: '' },
    status: { type: String, enum: ['Approved', 'Pending', 'Rejected'], default: 'Pending' },
  },
  { timestamps: true }
);
export const Leave =
  mongoose.models.Leave || mongoose.model('Leave', LeaveSchema);

// Wallet Withdraw Request Schema & Model
const WalletWithdrawRequestSchema = new Schema(
  {
    name: { type: String, default: '' },
    title: { type: String, default: '' },
    employee: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    contact: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    description: { type: String, default: '' },
    notes: { type: String, default: '' },
    status: { type: String, default: 'Active' },
  },
  { timestamps: true }
);
export const WalletWithdrawRequest =
  mongoose.models.WalletWithdrawRequest ||
  mongoose.model('WalletWithdrawRequest', WalletWithdrawRequestSchema);

// Role Schema & Model
const RoleSchema = new Schema(
  {
    name: { type: String, required: true },
    guard_name: { type: String, default: 'web' },
    description: { type: String, default: '' },
    permissions: { type: [String], default: [] },
    permissions_count: { type: Number, default: 0 },
    users_count: { type: Number, default: 0 },
  },
  { timestamps: true }
);
export const Role =
  mongoose.models.Role || mongoose.model('Role', RoleSchema);

// Setting Schema & Model
const SettingSchema = new Schema(
  {
    name: { type: String, default: '' },
    key: { type: String, default: '' },
    value: { type: Schema.Types.Mixed, default: '' },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);
export const Setting =
  mongoose.models.Setting || mongoose.model('Setting', SettingSchema);

