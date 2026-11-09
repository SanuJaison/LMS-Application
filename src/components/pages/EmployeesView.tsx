'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Eye,
  Pencil,
  Trash2,
  Columns3,
  ChevronDown,
  X,
  Plus,
  Loader2,
} from 'lucide-react';
import { Employee } from '../../types';
import { authHeaders } from '../../services/api';
import TablePagination from '@/components/ui/TablePagination';

interface EmployeesViewProps {
  showToast?: (type: 'success' | 'danger', message: string) => void;
}

const DISTRICT_OPTIONS = [
  'Ernakulam',
  'Kozhikode',
  'Wayanad',
  'Thiruvananthapuram',
  'Thrissur',
  'Malappuram',
  'Kollam',
  'Palakkad',
  'Kannur',
  'Kottayam',
];

const ZONE_OPTIONS = ['Central Zone', 'North Zone', 'South Zone'];

const REGIONAL_TEAM_DISTRICTS: Record<
  string,
  { teamName: string; zone: string; districts: [string, string] }
> = {
  TVM: { teamName: 'TVM Team', zone: 'South Zone', districts: ['Thiruvananthapuram', 'Kollam'] },
  PTM: { teamName: 'PTM Team', zone: 'South Zone', districts: ['Pathanamthitta', 'Alappuzha'] },
  KTM: { teamName: 'KTM Team', zone: 'Central Zone', districts: ['Kottayam', 'Idukki'] },
  EKM: { teamName: 'EKM Team', zone: 'Central Zone', districts: ['Ernakulam', 'Thrissur'] },
  PKD: { teamName: 'PKD Team', zone: 'Central Zone', districts: ['Palakkad', 'Malappuram'] },
  CLT: { teamName: 'CLT Team', zone: 'North Zone', districts: ['Kozhikode', 'Wayanad'] },
  KZD: { teamName: 'KZD Team', zone: 'North Zone', districts: ['Kannur', 'Kasaragod'] },
  KZE: { teamName: 'KZD Team', zone: 'North Zone', districts: ['Kannur', 'Kasaragod'] },
};

const CORE_DESIGNATIONS: DesignationOption[] = [
  { name: 'Sales Manager', prefix: 'SM' },
  { name: 'Area Sales Manager', prefix: 'ASM' },
  { name: 'Business Development Executive', prefix: 'BDE' },
  { name: 'Office Team Lead', prefix: 'ASM' },
  { name: 'Tele-caller', prefix: 'TC' },
  { name: 'Managing Director', prefix: 'MD' },
];

interface DesignationOption {
  id?: string;
  _id?: string;
  name: string;
  prefix?: string;
}

export default function EmployeesView({ showToast }: EmployeesViewProps) {
  // Data state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'sm' | 'asm' | 'bde' | 'office'>('all');

  // Table controls
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    name: true,
    email: true,
    employeeId: true,
    contactNo: true,
    designation: true,
    zone: true,
    district: true,
    team: true,
    reportsTo: true,
  });
  const [showColumnToggle, setShowColumnToggle] = useState<boolean>(false);
  const [perPage, setPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals state
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Dropdown options loaded from the database
  const [designations, setDesignations] = useState<DesignationOption[]>([]);

  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    employee_id: '',
    contact_number: '',
    designation: 'Business Development Executive',
    salary: '',
    incentive: '',
    daily_target: '',
    monthly_target: '',
    zone: 'Central Zone',
    district: 'Ernakulam',
    reports_to: '',
    team: '',
    status: 'active',
    bank_name: '',
    account_holder_name: '',
    account_number: '',
    ifsc_code: '',
    upi_id: '',
  });

  // Fetch employees
  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/employees', { headers: authHeaders() });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setEmployees(json.data);
      }
    } catch (err) {
      console.error('Failed to load employees:', err);
      showToast?.('danger', 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const [teams, setTeams] = useState<any[]>([]);

  // Fetch options (designations and teams)
  const fetchOptions = async () => {
    try {
      const [desigRes, teamsRes] = await Promise.all([
        fetch('/api/admin/designations', { headers: authHeaders() }),
        fetch('/api/admin/teams', { headers: authHeaders() }),
      ]);
      const [desigJson, teamsJson] = await Promise.all([desigRes.json(), teamsRes.json()]);
      if (desigJson.success && Array.isArray(desigJson.data)) {
        setDesignations(desigJson.data);
      }
      if (teamsJson.success && Array.isArray(teamsJson.data)) {
        setTeams(teamsJson.data);
      }
    } catch (err) {
      console.error('Failed to load designations/teams:', err);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchOptions();
  }, []);

  // Prefix for an employee ID: taken from the designation (BDE, ASM, MD, SM...),
  // falling back to the designation initials when no prefix is stored.
  const designationPrefix = (designationName: string): string => {
    const match = designations.find(
      (d) => d.name?.trim().toLowerCase() === designationName?.trim().toLowerCase()
    );
    const stored = (match?.prefix || '').trim();
    if (stored) return stored.toUpperCase();

    const initials = (designationName || '')
      .split(/[\s/&-]+/)
      .filter(Boolean)
      .map((word) => word[0])
      .join('')
      .toUpperCase();

    return initials || 'EMP';
  };

  // Friendly label for the manager selected in "Reports To".
  const managerLabel = (reportsTo?: string): string => {
    if (!reportsTo) return '—';
    const manager = employees.find((emp) => emp.employee_id === reportsTo);
    return manager ? `${manager.name} (${manager.employee_id})` : reportsTo;
  };

  const formatCurrency = (value?: number): string =>
    value === undefined || value === null || Number.isNaN(Number(value))
      ? '—'
      : `₹${Number(value).toLocaleString('en-IN')}`;

  const formatDateTime = (value?: string): string => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isSMDesignation = (designationName?: string, empId?: string): boolean => {
    const id = String(empId || '').trim().toUpperCase();
    if (id.startsWith('SM')) return true;
    if (id.startsWith('ASM') || id.startsWith('BDE') || id.startsWith('TC')) return false;
    if (!designationName) return false;
    const prefix = designationPrefix(designationName);
    const lower = designationName.toLowerCase();
    if (lower.includes('area sales manager')) return false;
    return prefix === 'SM' || lower.includes('sales manager') || lower.includes('state manager');
  };

  const isASMDesignation = (designationName?: string, empId?: string): boolean => {
    const id = String(empId || '').trim().toUpperCase();
    if (id.startsWith('ASM') || id.startsWith('BDM')) return true;
    if (id.startsWith('SM') || id.startsWith('BDE') || id.startsWith('TC')) return false;
    if (!designationName) return false;
    const prefix = designationPrefix(designationName);
    const lower = designationName.toLowerCase();
    return (
      prefix === 'ASM' ||
      prefix === 'BDM' ||
      lower.includes('area sales manager') ||
      lower.includes('business development manager')
    );
  };

  const isBDEDesignation = (designationName?: string, empId?: string): boolean => {
    const id = String(empId || '').trim().toUpperCase();
    if (id.startsWith('ASM') || id.startsWith('BDM') || id.startsWith('SM') || id.startsWith('MD')) {
      return false;
    }
    if (id.startsWith('BDE') || id.startsWith('TC')) return true;
    if (!designationName) return false;
    const prefix = designationPrefix(designationName);
    const lower = designationName.toLowerCase();
    if (
      lower.includes('area sales manager') ||
      lower.includes('sales manager') ||
      lower.includes('business development manager')
    ) {
      return false;
    }
    return prefix === 'BDE' || lower.includes('business development');
  };

  const isTopLevelDesignation = (designationName?: string, empId?: string): boolean => {
    const id = String(empId || '').trim().toUpperCase();
    if (id.startsWith('SM') || id.startsWith('MD')) return true;
    if (id.startsWith('ASM') || id.startsWith('BDE') || id.startsWith('TC')) return false;
    if (!designationName) return false;
    const prefix = designationPrefix(designationName);
    const lower = designationName.toLowerCase();
    if (lower.includes('area sales manager')) return false;
    return (
      ['SM', 'MD'].includes(prefix) ||
      lower.includes('sales manager') ||
      lower.includes('state manager') ||
      lower.includes('managing director')
    );
  };

  // Build the next custom employee ID, e.g. BDE001, BDE002, ASM001
  const buildEmployeeId = (designationName: string, excludeId?: string): string => {
    const prefix = designationPrefix(designationName);
    const usedNumbers = new Set<number>();

    employees.forEach((emp) => {
      const empId = (emp.employee_id || '').toUpperCase();
      const empKey = emp.id || (emp as any)._id;
      if (!empId.startsWith(prefix)) return;
      if (excludeId && empKey === excludeId) return;

      const digits = empId.slice(prefix.length).replace(/\D/g, '');
      if (digits) usedNumbers.add(parseInt(digits, 10));
    });

    let next = 1;
    while (usedNumbers.has(next)) next += 1;

    return `${prefix}${String(next).padStart(3, '0')}`;
  };

  const isOfficeEmployee = (emp?: {
    team?: string;
    designation?: string;
    employee_id?: string;
  } | null): boolean => {
    if (!emp) return false;
    const team = (emp.team || '').toLowerCase();
    const des = (emp.designation || '').toLowerCase();
    const id = (emp.employee_id || '').toUpperCase();
    return (
      team.includes('office') ||
      des.includes('office') ||
      des.includes('tele') ||
      id.startsWith('TC')
    );
  };

  // Filter & Sort
  const filteredAndSortedEmployees = useMemo(() => {
    let result = [...employees];

    if (roleFilter === 'sm') {
      result = result.filter((emp) => isSMDesignation(emp.designation, emp.employee_id));
    } else if (roleFilter === 'asm') {
      result = result.filter(
        (emp) => isASMDesignation(emp.designation, emp.employee_id) && !isOfficeEmployee(emp)
      );
    } else if (roleFilter === 'bde') {
      result = result.filter(
        (emp) => isBDEDesignation(emp.designation, emp.employee_id) && !isOfficeEmployee(emp)
      );
    } else if (roleFilter === 'office') {
      result = result.filter((emp) => isOfficeEmployee(emp));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (emp) =>
          emp.name?.toLowerCase().includes(q) ||
          emp.email?.toLowerCase().includes(q) ||
          emp.employee_id?.toLowerCase().includes(q) ||
          emp.contact_number?.toLowerCase().includes(q) ||
          emp.designation?.toLowerCase().includes(q) ||
          emp.district?.toLowerCase().includes(q) ||
          emp.zone?.toLowerCase().includes(q) ||
          emp.team?.toLowerCase().includes(q)
      );
    }

    if (sortField) {
      result.sort((a, b) => {
        const valA = (a[sortField as keyof Employee] || '').toString().toLowerCase();
        const valB = (b[sortField as keyof Employee] || '').toString().toLowerCase();
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [employees, searchQuery, sortField, sortOrder, roleFilter]);

  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredAndSortedEmployees.slice(start, start + perPage);
  }, [filteredAndSortedEmployees, currentPage, perPage]);

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedEmployees.length && paginatedEmployees.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(
        paginatedEmployees
          .map((emp) => emp.id || (emp as any)._id)
          .filter(Boolean) as string[]
      );
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Open Create Modal (Admin creates strictly the Sales Manager)
  const openNewModal = () => {
    fetchOptions();
    setEditingEmployee(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      employee_id: buildEmployeeId('Sales Manager'),
      contact_number: '',
      designation: 'Sales Manager',
      salary: '',
      incentive: '',
      daily_target: '',
      monthly_target: '',
      zone: 'Kerala',
      district: '',
      reports_to: '',
      team: '',
      status: 'active',
      bank_name: '',
      account_holder_name: '',
      account_number: '',
      ifsc_code: '',
      upi_id: '',
    });
    setEditModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (emp: Employee) => {
    fetchOptions();
    setEditingEmployee(emp);
    setFormData({
      name: emp.name || '',
      email: emp.email || '',
      password: emp.password && !String(emp.password).startsWith('$2') ? emp.password : '',
      employee_id: emp.employee_id || '',
      contact_number: emp.contact_number || '',
      designation: emp.designation || '',
      salary: (emp as any).salary !== undefined ? String((emp as any).salary) : '',
      incentive: (emp as any).incentive !== undefined ? String((emp as any).incentive) : '',
      daily_target: (emp as any).daily_target !== undefined ? String((emp as any).daily_target) : '',
      monthly_target: (emp as any).monthly_target !== undefined ? String((emp as any).monthly_target) : '',
      zone: emp.zone || 'Central Zone',
      district: emp.district || 'Ernakulam',
      reports_to: emp.reports_to || '',
      team: emp.team || '',
      status: emp.status || 'active',
      bank_name: (emp as any).bank_name || '',
      account_holder_name: (emp as any).account_holder_name || '',
      account_number: (emp as any).account_number || '',
      ifsc_code: (emp as any).ifsc_code || '',
      upi_id: (emp as any).upi_id || '',
    });
    setEditModalOpen(true);
  };

  // Save (Create or Update)
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = Boolean(editingEmployee);
    const empId = editingEmployee?.id || (editingEmployee as any)?._id;

    if (!formData.name.trim()) {
      showToast?.('danger', 'Employee name is required');
      return;
    }
    if (!formData.designation.trim()) {
      showToast?.('danger', 'Designation is required');
      return;
    }
    if (!isEdit && !formData.password.trim()) {
      showToast?.('danger', 'Password is required');
      return;
    }

    try {
      setSaving(true);

      // SM/MD are top level: no district, zone or manager.
      const isTopLevel = isTopLevelDesignation(formData.designation, formData.employee_id);
      const isSaveASM = isASMDesignation(formData.designation, formData.employee_id);
      const isSaveBDE =
        isBDEDesignation(formData.designation, formData.employee_id) &&
        !isOfficeEmployee(editingEmployee || formData);

      if (isSaveBDE) {
        if (!formData.reports_to.trim()) {
          showToast?.('danger', 'Please select an Area Sales Manager (Reports To) for the BDE');
          return;
        }
        if (!selectedAsmTeam) {
          showToast?.('danger', 'The selected ASM is not assigned to any team yet. Please assign them in Teams first');
          return;
        }
        if (!selectedAsmTeam.isOffice && !formData.district.trim()) {
          showToast?.('danger', 'Please select one of the team districts for the BDE');
          return;
        }
      }

      const payload: Record<string, any> = {
        ...(isEdit && { id: empId }),
        name: formData.name.trim(),
        email: formData.email.trim() || `${formData.name.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
        employee_id:
          formData.employee_id.trim() || buildEmployeeId(formData.designation, empId),
        contact_number: formData.contact_number.trim(),
        designation: formData.designation.trim(),
        salary: formData.salary ? Number(formData.salary) : 0,
        incentive: formData.incentive ? Number(formData.incentive) : 0,
        daily_target: isTopLevel ? 0 : formData.daily_target ? Number(formData.daily_target) : 0,
        monthly_target: formData.monthly_target ? Number(formData.monthly_target) : 0,
        zone: isTopLevel
          ? ''
          : isSaveASM && currentAsmTeamInfo
          ? currentAsmTeamInfo.zone || formData.zone.trim()
          : isSaveBDE && selectedAsmTeam
          ? (selectedAsmTeam.zone || '')
          : formData.zone.trim(),
        district: isTopLevel
          ? ''
          : isSaveASM
          ? (editingEmployee?.district || currentAsmTeamInfo?.districts.join(', ') || formData.district.trim())
          : formData.district.trim(),
        reports_to: isTopLevel ? '' : formData.reports_to.trim(),
        team: isTopLevel
          ? ''
          : isSaveASM && currentAsmTeamInfo?.name
          ? currentAsmTeamInfo.name
          : isSaveBDE && selectedAsmTeam
          ? selectedAsmTeam.name
          : (formData.team || '').trim(),
        status: formData.status.toLowerCase(),
        bank_name: formData.bank_name.trim(),
        account_holder_name: formData.account_holder_name.trim(),
        account_number: formData.account_number.trim(),
        ifsc_code: formData.ifsc_code.trim(),
        upi_id: formData.upi_id.trim(),
      };

      // Only send the password when one was typed, so editing does not wipe it
      if (formData.password.trim()) {
        payload.password = formData.password.trim();
      }

      const res = await fetch('/api/admin/employees', {
        method: isEdit ? 'PUT' : 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        showToast?.('success', `Employee ${isEdit ? 'updated' : 'created'} successfully!`);
        setEditModalOpen(false);
        setEditingEmployee(null);
        fetchEmployees();
      } else {
        showToast?.('danger', json.message || 'Failed to save employee');
      }
    } catch (err) {
      console.error('Save employee error:', err);
      showToast?.('danger', 'Failed to save employee');
    } finally {
      setSaving(false);
    }
  };

  // Single delete
  const handleDeleteEmployee = async (emp: Employee) => {
    const empId = emp.id || (emp as any)._id;
    if (!empId) return;

    if (!confirm(`Are you sure you want to delete ${emp.name}?`)) return;

    try {
      const res = await fetch(`/api/admin/employees?id=${empId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const json = await res.json();
      if (json.success) {
        showToast?.('success', 'Employee deleted successfully');
        setSelectedIds((prev) => prev.filter((id) => id !== empId));
        fetchEmployees();
      } else {
        showToast?.('danger', json.message || 'Failed to delete employee');
      }
    } catch (err) {
      console.error('Delete employee error:', err);
      showToast?.('danger', 'Failed to delete employee');
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} employee(s)?`)) return;

    try {
      const res = await fetch('/api/admin/employees', {
        method: 'DELETE',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ids: selectedIds }),
      });
      const json = await res.json();
      if (json.success) {
        showToast?.('success', `${selectedIds.length} employee(s) deleted successfully`);
        setSelectedIds([]);
        fetchEmployees();
      } else {
        showToast?.('danger', json.message || 'Failed to delete employees');
      }
    } catch (err) {
      console.error('Bulk delete error:', err);
      showToast?.('danger', 'Failed to delete selected employees');
    }
  };

  const smEmployee = employees.find((e) => isSMDesignation(e.designation, e.employee_id));
  const hasSM = Boolean(smEmployee);

  // SM/MD are top level: no district, zone or manager fields.
  const isTopLevel = isTopLevelDesignation(formData.designation, formData.employee_id);
  const isCurrentASM = isASMDesignation(formData.designation, formData.employee_id);
  const isCurrentBDE =
    !isCurrentASM && isBDEDesignation(formData.designation, formData.employee_id);

  const availableManagers = useMemo(() => {
    const currentEmpKey = editingEmployee?.id || (editingEmployee as any)?._id;
    const currentEmpId = formData.employee_id;

    return employees.filter((emp) => {
      const empKey = emp.id || (emp as any)._id;
      if (empKey === currentEmpKey) return false;
      if (currentEmpId && emp.employee_id === currentEmpId) return false;

      if (isCurrentASM) {
        // ASM can ONLY report to SM! Under NO circumstances show other ASMs or BDEs.
        return isSMDesignation(emp.designation, emp.employee_id);
      }

      if (isCurrentBDE) {
        // BDE reports to ASM
        return isASMDesignation(emp.designation, emp.employee_id);
      }

      return !isBDEDesignation(emp.designation, emp.employee_id);
    });
  }, [employees, formData.designation, formData.employee_id, editingEmployee]);

  // Resolve an ASM employee's team, zone, and 2 SM-assigned districts
  const resolveAsmTeamInfo = (
    asmEmp?: {
      employee_id?: string;
      name?: string;
      team?: string;
      district?: string;
      districts?: string[];
      zone?: string;
      designation?: string;
    } | null
  ) => {
    if (!asmEmp) return null;
    const empId = String(asmEmp.employee_id || '').trim().toLowerCase();
    const empName = String(asmEmp.name || '').trim().toLowerCase();
    const storedTeam = String(asmEmp.team || '').trim();
    const storedDist = String(asmEmp.district || '').trim();

    if (isOfficeEmployee(asmEmp)) {
      return {
        name: 'Office Team',
        zone: asmEmp.zone || 'Central Zone',
        districts: [] as string[],
        isOffice: true,
      };
    }

    // 1. Match team from `teams` collection
    const teamDoc =
      teams.find(
        (t) => storedTeam && String(t.name || '').trim().toLowerCase() === storedTeam.toLowerCase()
      ) ||
      teams.find((t) => {
        const tl = String(t.team_lead || '').trim().toLowerCase();
        if (!tl) return false;
        if (empId && tl.includes(`(${empId})`)) return true;
        if (empName && (tl === empName || tl.startsWith(`${empName} (`))) return true;
        return false;
      }) ||
      null;

    let districts: string[] = [];
    if (Array.isArray((asmEmp as any).districts) && (asmEmp as any).districts.length > 0) {
      districts = (asmEmp as any).districts
        .map((d: any) => String(d || '').trim())
        .filter(Boolean);
    } else if (Array.isArray(teamDoc?.districts) && teamDoc.districts.length > 0) {
      districts = teamDoc.districts.map((d: any) => String(d || '').trim()).filter(Boolean);
    } else if (teamDoc?.district) {
      districts = String(teamDoc.district)
        .split(/[,&/]/)
        .map((d) => d.trim())
        .filter(Boolean);
    }

    // 2. Match regional config by team prefix code (TVM, PTM, KTM, EKM, PKD, CLT, KZD/KZE) or by any district
    const teamNameCandidate = String(teamDoc?.name || storedTeam || '').trim();
    const codeMatch = teamNameCandidate.toUpperCase().match(/^([A-Z]{3})/);
    let regionalCfg = codeMatch ? REGIONAL_TEAM_DISTRICTS[codeMatch[1]] : undefined;

    if (!regionalCfg) {
      const candidateTokens = [
        ...districts,
        ...storedDist.split(/[,&/]/),
        teamNameCandidate,
      ]
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);

      regionalCfg = Object.values(REGIONAL_TEAM_DISTRICTS).find((cfg) =>
        cfg.districts.some((d) =>
          candidateTokens.some(
            (tok) => tok === d.toLowerCase() || tok.includes(d.toLowerCase())
          )
        )
      );
    }

    if (districts.length < 2 && regionalCfg) {
      districts = [...regionalCfg.districts];
    }
    if (districts.length === 0 && storedDist) {
      districts = storedDist
        .split(/[,&/]/)
        .map((d) => d.trim())
        .filter(Boolean);
    }

    return {
      name: teamDoc?.name || regionalCfg?.teamName || storedTeam || 'Regional Team',
      zone: teamDoc?.zone || regionalCfg?.zone || asmEmp.zone || 'Central Zone',
      districts,
      isOffice: Boolean(teamDoc?.is_office),
    };
  };

  // Current ASM's own team & 2 SM-assigned districts (when editing an ASM)
  const currentAsmTeamInfo = useMemo(() => {
    if (!isCurrentASM) return null;
    return resolveAsmTeamInfo(editingEmployee || formData);
  }, [isCurrentASM, editingEmployee, formData.team, formData.district, formData.employee_id, formData.name, teams]);

  // Resolve the team led by the ASM selected in reports_to (for BDEs)
  const selectedAsmTeam = useMemo(() => {
    if (!formData.reports_to || !isCurrentBDE) return null;
    const targetReport = formData.reports_to.trim().toLowerCase();
    const mgr = employees.find(
      (e) =>
        String(e.employee_id || '').trim().toLowerCase() === targetReport ||
        String(e.name || '').trim().toLowerCase() === targetReport
    );
    if (!mgr) return null;
    return resolveAsmTeamInfo(mgr);
  }, [formData.reports_to, isCurrentBDE, employees, teams]);

  const asmTeamDistricts = useMemo<string[]>(() => {
    if (!selectedAsmTeam) return [];
    return selectedAsmTeam.districts || [];
  }, [selectedAsmTeam]);

  // Keep formData.reports_to strictly valid for the chosen role
  useEffect(() => {
    if (isTopLevel && formData.reports_to) {
      setFormData((prev) => ({ ...prev, reports_to: '' }));
    } else if (isCurrentASM && formData.reports_to) {
      const isValidSM = availableManagers.some((m) => m.employee_id === formData.reports_to);
      if (!isValidSM) {
        setFormData((prev) => ({ ...prev, reports_to: '' }));
      }
    } else if (isCurrentBDE && formData.reports_to) {
      const isValidASM = availableManagers.some((m) => m.employee_id === formData.reports_to);
      if (!isValidASM) {
        setFormData((prev) => ({ ...prev, reports_to: '' }));
      }
    }
  }, [isTopLevel, isCurrentASM, isCurrentBDE, availableManagers, formData.reports_to]);

  // Auto-sync BDE district, zone and team when the selected ASM team is determined
  useEffect(() => {
    if (isCurrentBDE) {
      if (selectedAsmTeam) {
        setFormData((prev) => {
          const validDistrict = asmTeamDistricts.includes(prev.district)
            ? prev.district
            : asmTeamDistricts[0] || '';
          return {
            ...prev,
            team: selectedAsmTeam.name,
            zone: selectedAsmTeam.zone || prev.zone,
            district: validDistrict,
          };
        });
      } else if (!formData.reports_to) {
        setFormData((prev) => ({
          ...prev,
          team: '',
          district: '',
        }));
      }
    }
  }, [isCurrentBDE, selectedAsmTeam, asmTeamDistricts, formData.reports_to]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header with Breadcrumbs & Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted mb-1">
            <span>Employees</span>
            <span className="text-subtle">&gt;</span>
            <span className="text-ink/80">List</span>
          </div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Employees</h1>
        </div>

        <button
          id="btn-new-employee"
          onClick={() => openNewModal()}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg shadow transition self-start sm:self-auto cursor-pointer"
        >
          New employee
        </button>
      </div>

      {/* Organization Setup Banner if no Sales Manager exists */}
      {employees.filter((e) => isSMDesignation(e.designation)).length === 0 && !loading && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-blue-950/40 border border-blue-500/40 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-blue-500 text-white font-bold text-[10px]">Step 1</span>
              <strong className="text-blue-200 text-sm">Create the Sales Manager (SM)</strong>
            </div>
            <p className="text-blue-300/80 mt-1">
              No Sales Manager found yet. In KIDE hierarchy, create the single Sales Manager first who will supervise all 7 regional teams and the Office Team.
            </p>
          </div>
          
        </div>
      )}

      {/* Role Hierarchy Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
        <button
          onClick={() => { setRoleFilter('all'); setCurrentPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
            roleFilter === 'all'
              ? 'bg-selected text-accent border border-accent/40 shadow-sm'
              : 'bg-surface-2 text-muted hover:text-ink border border-line'
          }`}
        >
          <span>All Employees</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-hover text-muted">
            {employees.length}
          </span>
        </button>

        <button
          onClick={() => { setRoleFilter('sm'); setCurrentPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
            roleFilter === 'sm'
              ? 'bg-selected text-accent border border-accent/40 shadow-sm'
              : 'bg-surface-2 text-muted hover:text-ink border border-line'
          }`}
        >
          <span>Sales Manager (SM)</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-900/40 text-indigo-300">
            {employees.filter((e) => isSMDesignation(e.designation, e.employee_id)).length}
          </span>
        </button>

        <button
          onClick={() => { setRoleFilter('asm'); setCurrentPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
            roleFilter === 'asm'
              ? 'bg-selected text-accent border border-accent/40 shadow-sm'
              : 'bg-surface-2 text-muted hover:text-ink border border-line'
          }`}
        >
          <span>Area Sales Managers (7 ASM Teams)</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-warning/10 text-warning border border-warning/30">
            {employees.filter((e) => isASMDesignation(e.designation, e.employee_id) && !isOfficeEmployee(e)).length}/7
          </span>
        </button>

        <button
          onClick={() => { setRoleFilter('bde'); setCurrentPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
            roleFilter === 'bde'
              ? 'bg-selected text-accent border border-accent/40 shadow-sm'
              : 'bg-surface-2 text-muted hover:text-ink border border-line'
          }`}
        >
          <span>Business Development Executives (BDE)</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-900/40 text-emerald-300">
            {employees.filter((e) => isBDEDesignation(e.designation, e.employee_id) && !isOfficeEmployee(e)).length}
          </span>
        </button>

        <button
          onClick={() => { setRoleFilter('office'); setCurrentPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
            roleFilter === 'office'
              ? 'bg-selected text-accent border border-accent/40 shadow-sm'
              : 'bg-surface-2 text-muted hover:text-ink border border-line'
          }`}
        >
          <span>Office Team</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-hover text-muted">
            {employees.filter((e) => isOfficeEmployee(e)).length}
          </span>
        </button>
      </div>

      {/* ASM Regional Teams Overview Card when ASM filter is active */}
      {roleFilter === 'asm' && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-surface-2 border border-warning/30 text-xs space-y-2">
            <div className="flex items-center justify-between text-warning font-bold">
              <span>Official 7 Regional Teams & Assigned Districts (1 ASM per Team, 2 Districts each)</span>
              <span className="text-[11px] text-muted font-normal">Supervised by SM</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
              <div className="p-2 rounded bg-surface border border-line">
                <strong className="text-ink block font-mono text-[11px]">1. TVM Team</strong>
                <span className="text-muted text-[10px]">Thiruvananthapuram, Kollam</span>
              </div>
              <div className="p-2 rounded bg-surface border border-line">
                <strong className="text-ink block font-mono text-[11px]">2. PTM Team</strong>
                <span className="text-muted text-[10px]">Pathanamthitta, Alappuzha</span>
              </div>
              <div className="p-2 rounded bg-surface border border-line">
                <strong className="text-ink block font-mono text-[11px]">3. KTM Team</strong>
                <span className="text-muted text-[11px]">Kottayam, Idukki</span>
              </div>
              <div className="p-2 rounded bg-surface border border-line">
                <strong className="text-ink block font-mono text-[11px]">4. EKM Team</strong>
                <span className="text-muted text-[10px]">Ernakulam, Thrissur</span>
              </div>
              <div className="p-2 rounded bg-surface border border-line">
                <strong className="text-ink block font-mono text-[11px]">5. PKD Team</strong>
                <span className="text-muted text-[10px]">Palakkad, Malappuram</span>
              </div>
              <div className="p-2 rounded bg-surface border border-line">
                <strong className="text-ink block font-mono text-[11px]">6. CLT Team</strong>
                <span className="text-muted text-[10px]">Kozhikode, Wayanad</span>
              </div>
              <div className="p-2 rounded bg-surface border border-line">
                <strong className="text-ink block font-mono text-[11px]">7. KZE Team</strong>
                <span className="text-muted text-[10px]">Kannur, Kasaragod</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-surface-2 border border-accent/30 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-accent font-bold">Office Team (Under SM)</div>
              <div className="text-muted text-[11px] mt-0.5">
                Central Office Team Lead & Tele-callers (no district restriction) —{' '}
                <strong className="text-ink">
                  {employees.filter((e) => isOfficeEmployee(e)).length} member(s)
                </strong>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setRoleFilter('office');
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 text-xs font-semibold cursor-pointer self-start sm:self-auto"
            >
              View Office Team →
            </button>
          </div>
        </div>
      )}

      {/* Table Container Card */}
      <div className="bg-surface border border-line rounded-xl shadow-lg overflow-hidden">
        {/* Top Bar with Search on Right & Column Visibility Toggle */}
        <div className="p-3.5 flex items-center justify-between sm:justify-end gap-2 border-b border-line">
          <div className="relative flex-1 sm:w-64 sm:flex-initial">
            <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-field border border-line rounded-lg text-xs text-ink placeholder-subtle focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setShowColumnToggle(!showColumnToggle)}
              className="p-2 border border-line rounded-lg bg-field text-muted hover:text-ink transition flex items-center justify-center cursor-pointer"
              title="Toggle columns"
            >
              <Columns3 className="w-3.5 h-3.5" />
            </button>

            {showColumnToggle && (
              <div className="absolute right-0 mt-2 w-48 bg-elevated border border-line rounded-xl shadow-2xl p-3 z-30 text-xs">
                <div className="font-semibold text-ink/80 mb-2 pb-1 border-b border-line">
                  Columns
                </div>
                <div className="space-y-1.5">
                  {[
                    { key: 'name', label: 'Name' },
                    { key: 'email', label: 'Email' },
                    { key: 'employeeId', label: 'Employee ID' },
                    { key: 'contactNo', label: 'Contact No' },
                    { key: 'designation', label: 'Designation' },
                    { key: 'zone', label: 'Zone' },
                    { key: 'district', label: 'District' },
                    { key: 'team', label: 'Team' },
                    { key: 'reportsTo', label: 'Reports To' },
                  ].map(({ key, label }) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-ink/80 hover:text-ink cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={columnVisibility[key] !== false}
                        onChange={() =>
                          setColumnVisibility((prev) => ({
                            ...prev,
                            [key]: !prev[key],
                          }))
                        }
                        className="rounded bg-field border-line text-accent focus:ring-0 cursor-pointer"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bulk Actions Notification Bar */}
        {selectedIds.length > 0 && (
          <div className="px-4 py-2.5 bg-bulk border-b border-line flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in">
            <div className="flex items-center gap-2 text-ink">
              <span className="font-semibold">{selectedIds.length}</span>
              <span className="text-ink/80">
                employee{selectedIds.length > 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedIds([])}
                className="px-2.5 py-1 rounded bg-surface border border-line text-ink/80 hover:text-ink transition cursor-pointer"
              >
                Deselect all
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1 rounded bg-danger/15 hover:bg-danger/20 text-danger border border-danger/30 transition flex items-center gap-1.5 font-medium cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete selected</span>
              </button>
            </div>
          </div>
        )}

        {/* Table Content */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-muted gap-2">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
            <span className="text-xs">Loading employees...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-line text-ink/80 font-semibold text-xs bg-surface">
                  <th className="py-3.5 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.length === paginatedEmployees.length &&
                        paginatedEmployees.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="rounded bg-field border-line text-accent focus:ring-0 cursor-pointer"
                    />
                  </th>
                  {columnVisibility.name !== false && (
                    <th
                      onClick={() => handleSort('name')}
                      className="py-3.5 px-4 cursor-pointer hover:text-ink select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Name</span>
                        <ChevronDown
                          className={`w-3 h-3 text-subtle transition-transform ${
                            sortField === 'name' && sortOrder === 'desc' ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </th>
                  )}
                  {columnVisibility.email !== false && (
                    <th
                      onClick={() => handleSort('email')}
                      className="py-3.5 px-4 cursor-pointer hover:text-ink select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Email</span>
                        <ChevronDown
                          className={`w-3 h-3 text-subtle transition-transform ${
                            sortField === 'email' && sortOrder === 'desc' ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </th>
                  )}
                  {columnVisibility.employeeId !== false && (
                    <th className="py-3.5 px-4">Employee ID</th>
                  )}
                  {columnVisibility.contactNo !== false && (
                    <th className="py-3.5 px-4">Contact No</th>
                  )}
                  {columnVisibility.designation !== false && (
                    <th className="py-3.5 px-4">Designation</th>
                  )}
                  {columnVisibility.zone !== false && (
                    <th className="py-3.5 px-4">Zone</th>
                  )}
                  {columnVisibility.district !== false && (
                    <th className="py-3.5 px-4">District</th>
                  )}
                  {columnVisibility.team !== false && (
                    <th className="py-3.5 px-4">Team</th>
                  )}
                  {columnVisibility.reportsTo !== false && (
                    <th className="py-3.5 px-4">Reports To</th>
                  )}
                  <th className="py-3.5 px-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-2">
                {paginatedEmployees.length > 0 ? (
                  paginatedEmployees.map((emp, idx) => {
                    const id = emp.id || (emp as any)._id || String(idx);
                    return (
                      <tr key={id} className="hover:bg-hover/60 transition">
                        <td className="py-3.5 px-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(id)}
                            onChange={() => toggleSelectOne(id)}
                            className="rounded bg-field border-line text-accent focus:ring-0 cursor-pointer"
                          />
                        </td>
                        {columnVisibility.name !== false && (
                          <td className="py-3.5 px-4 font-normal text-ink">
                            {emp.name}
                          </td>
                        )}
                        {columnVisibility.email !== false && (
                          <td className="py-3.5 px-4 text-muted">
                            {emp.email}
                          </td>
                        )}
                        {columnVisibility.employeeId !== false && (
                          <td className="py-3.5 px-4 font-mono text-ink/80 text-[11px]">
                            {emp.employee_id}
                          </td>
                        )}
                        {columnVisibility.contactNo !== false && (
                          <td className="py-3.5 px-4 text-ink/80">
                            {emp.contact_number}
                          </td>
                        )}
                        {columnVisibility.designation !== false && (
                          <td className="py-3.5 px-4 text-muted">
                            {emp.designation || '—'}
                          </td>
                        )}
                        {columnVisibility.zone !== false && (
                          <td className="py-3.5 px-4 text-ink/80">
                            {emp.zone}
                          </td>
                        )}
                        {columnVisibility.district !== false && (
                          <td className="py-3.5 px-4 text-ink/80">
                            {isTopLevelDesignation(emp.designation, emp.employee_id) ? (
                              <span className="text-muted">All Kerala</span>
                            ) : isASMDesignation(emp.designation, emp.employee_id) && !isOfficeEmployee(emp) ? (
                              (() => {
                                const dists = resolveAsmTeamInfo(emp)?.districts || [];
                                return dists.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {dists.map((d) => (
                                      <span
                                        key={d}
                                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent/10 text-accent border border-accent/25"
                                      >
                                        {d}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  emp.district || '—'
                                );
                              })()
                            ) : (
                              emp.district || '—'
                            )}
                          </td>
                        )}
                        {columnVisibility.team !== false && (
                          <td className="py-3.5 px-4 text-ink/80">
                            {emp.team || '—'}
                          </td>
                        )}
                        {columnVisibility.reportsTo !== false && (
                          <td className="py-3.5 px-4 text-ink/80 font-mono text-[11px]">
                            {emp.reports_to || '—'}
                          </td>
                        )}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-3.5 whitespace-nowrap">
                            <button
                              onClick={() => setViewingEmployee(emp)}
                              className="inline-flex items-center gap-1.5 text-accent hover:text-ink transition font-medium text-xs hover:underline cursor-pointer"
                              title="View details"
                            >
                              <Eye className="w-3.5 h-3.5 text-accent" />
                              <span>View</span>
                            </button>
                            <button
                              onClick={() => openEditModal(emp)}
                              className="inline-flex items-center gap-1.5 text-accent hover:text-ink transition font-medium text-xs hover:underline cursor-pointer"
                              title="Edit employee"
                            >
                              <Pencil className="w-3.5 h-3.5 text-accent" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteEmployee(emp)}
                              className="inline-flex items-center gap-1.5 text-danger hover:text-danger transition font-medium text-xs hover:underline cursor-pointer"
                              title="Delete employee"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-danger" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-subtle">
                      No employees found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <TablePagination
          total={filteredAndSortedEmployees.length}
          page={currentPage}
          perPage={perPage}
          onPageChange={setCurrentPage}
          onPerPageChange={setPerPage}
        />
      </div>

      {/* VIEW EMPLOYEE MODAL */}
      {viewingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-elevated border border-line rounded-2xl shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 border-b border-line pb-3">
              <div>
                <h3 className="font-bold text-ink text-base">{viewingEmployee.name}</h3>
                <p className="text-xs text-muted">{viewingEmployee.email}</p>
              </div>
              <button
                onClick={() => setViewingEmployee(null)}
                className="text-muted hover:text-ink p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <h4 className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">
                  Employment details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-field p-3 rounded-lg border border-line">
                    <span className="text-muted block mb-0.5">Employee ID</span>
                    <span className="text-ink font-mono font-medium">{viewingEmployee.employee_id || '—'}</span>
                  </div>
                  <div className="bg-field p-3 rounded-lg border border-line">
                    <span className="text-muted block mb-0.5">Password</span>
                    <span className="text-ink font-mono font-medium">
                      {viewingEmployee.password && !String(viewingEmployee.password).startsWith('$2')
                        ? viewingEmployee.password
                        : '—'}
                    </span>
                  </div>
                  <div className="bg-field p-3 rounded-lg border border-line">
                    <span className="text-muted block mb-0.5">Contact</span>
                    <span className="text-ink font-medium">{viewingEmployee.contact_number || '—'}</span>
                  </div>
                  <div className="bg-field p-3 rounded-lg border border-line">
                    <span className="text-muted block mb-0.5">Designation</span>
                    <span className="text-ink font-medium">{viewingEmployee.designation || '—'}</span>
                  </div>
                  {!isTopLevelDesignation(viewingEmployee.designation, viewingEmployee.employee_id) && (
                    <>
                      <div className="bg-field p-3 rounded-lg border border-line">
                        <span className="text-muted block mb-0.5">Team</span>
                        <span className="text-ink font-medium">
                          {isASMDesignation(viewingEmployee.designation, viewingEmployee.employee_id)
                            ? resolveAsmTeamInfo(viewingEmployee)?.name || viewingEmployee.team || '—'
                            : viewingEmployee.team || '—'}
                        </span>
                      </div>
                      <div className="bg-field p-3 rounded-lg border border-line">
                        <span className="text-muted block mb-0.5">Reports To</span>
                        <span className="text-ink font-medium">
                          {managerLabel(viewingEmployee.reports_to)}
                        </span>
                      </div>
                      <div className="bg-field p-3 rounded-lg border border-line">
                        <span className="text-muted block mb-0.5">Zone</span>
                        <span className="text-ink font-medium">
                          {isASMDesignation(viewingEmployee.designation, viewingEmployee.employee_id)
                            ? resolveAsmTeamInfo(viewingEmployee)?.zone || viewingEmployee.zone || '—'
                            : viewingEmployee.zone || '—'}
                        </span>
                      </div>
                      <div className="bg-field p-3 rounded-lg border border-line">
                        <span className="text-muted block mb-1">
                          {isASMDesignation(viewingEmployee.designation, viewingEmployee.employee_id) &&
                          !isOfficeEmployee(viewingEmployee)
                            ? 'Assigned Districts (2 Districts)'
                            : 'District'}
                        </span>
                        {isASMDesignation(viewingEmployee.designation, viewingEmployee.employee_id) &&
                        !isOfficeEmployee(viewingEmployee) ? (
                          (() => {
                            const dists = resolveAsmTeamInfo(viewingEmployee)?.districts || [];
                            return dists.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {dists.map((d) => (
                                  <span
                                    key={d}
                                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-accent/15 text-accent border border-accent/30"
                                  >
                                    {d}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-ink font-medium">{viewingEmployee.district || '—'}</span>
                            );
                          })()
                        ) : (
                          <span className="text-ink font-medium">{viewingEmployee.district || '—'}</span>
                        )}
                      </div>
                    </>
                  )}
                  <div className="bg-field p-3 rounded-lg border border-line">
                    <span className="text-muted block mb-0.5">Status</span>
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-success/10 text-success border border-success/30 uppercase">
                      {viewingEmployee.status || 'active'}
                    </span>
                  </div>
                  <div className="bg-field p-3 rounded-lg border border-line">
                    <span className="text-muted block mb-0.5">Salary</span>
                    <span className="text-ink font-medium">{formatCurrency(viewingEmployee.salary)}</span>
                  </div>
                  <div className="bg-field p-3 rounded-lg border border-line">
                    <span className="text-muted block mb-0.5">Incentive</span>
                    <span className="text-ink font-medium">{formatCurrency(viewingEmployee.incentive)}</span>
                  </div>
                  {!isTopLevelDesignation(viewingEmployee.designation, viewingEmployee.employee_id) && (
                    <div className="bg-field p-3 rounded-lg border border-line">
                      <span className="text-muted block mb-0.5">Daily Target</span>
                      <span className="text-ink font-medium">
                        {viewingEmployee.daily_target
                          ? `${viewingEmployee.daily_target} leads / day`
                          : '—'}
                      </span>
                    </div>
                  )}
                  <div className="bg-field p-3 rounded-lg border border-line">
                    <span className="text-muted block mb-0.5">Monthly Target</span>
                    <span className="text-ink font-medium">
                      {viewingEmployee.monthly_target
                        ? `${viewingEmployee.monthly_target} leads / month`
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">
                  Payment details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-field p-3 rounded-lg border border-line">
                    <span className="text-muted block mb-0.5">Bank Name</span>
                    <span className="text-ink font-medium">{viewingEmployee.bank_name || '—'}</span>
                  </div>
                  <div className="bg-field p-3 rounded-lg border border-line">
                    <span className="text-muted block mb-0.5">Account Holder</span>
                    <span className="text-ink font-medium">{viewingEmployee.account_holder_name || '—'}</span>
                  </div>
                  <div className="bg-field p-3 rounded-lg border border-line">
                    <span className="text-muted block mb-0.5">Account Number</span>
                    <span className="text-ink font-mono font-medium">{viewingEmployee.account_number || '—'}</span>
                  </div>
                  <div className="bg-field p-3 rounded-lg border border-line">
                    <span className="text-muted block mb-0.5">IFSC Code</span>
                    <span className="text-ink font-mono font-medium">{viewingEmployee.ifsc_code || '—'}</span>
                  </div>
                  <div className="bg-field p-3 rounded-lg border border-line sm:col-span-2">
                    <span className="text-muted block mb-0.5">UPI ID</span>
                    <span className="text-ink font-medium">{viewingEmployee.upi_id || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-field p-3 rounded-lg border border-line flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span className="text-muted">Created on</span>
                <span className="text-ink font-medium">
                  {formatDateTime(viewingEmployee.createdAt || viewingEmployee.created_at)}
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  const emp = viewingEmployee;
                  setViewingEmployee(null);
                  openEditModal(emp);
                }}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg shadow cursor-pointer"
              >
                Edit Employee
              </button>
              <button
                onClick={() => setViewingEmployee(null)}
                className="px-4 py-2 bg-active hover:bg-active text-ink/80 text-xs rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT EMPLOYEE MODAL */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl bg-elevated border border-line rounded-2xl shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-ink text-base">
                {editingEmployee ? 'Edit' : 'New'} Employee
              </h3>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-muted hover:text-ink p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink/80 font-semibold mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Aslam"
                    className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-ink/80 font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. aslam@gmail.com"
                    className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink/80 font-semibold mb-1">
                    Password <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required={!editingEmployee}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingEmployee ? 'Leave blank to keep current' : 'e.g. password123'}
                    autoComplete="off"
                    className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none font-mono"
                  />
                  {editingEmployee && (
                    <span className="block mt-1 text-[10px] text-subtle">
                      Leave blank to keep the existing password.
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-ink/80 font-semibold mb-1">Contact No</label>
                  <input
                    type="text"
                    required
                    value={formData.contact_number}
                    onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                    placeholder="e.g. 9746543243"
                    className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink/80 font-semibold mb-1">Employee ID</label>
                  <input
                    type="text"
                    required
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    placeholder="e.g. BDE001"
                    className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none font-mono"
                  />
                  <span className="block mt-1 text-[10px] text-subtle">
                    Auto-generated from the designation prefix.
                  </span>
                </div>
                {editingEmployee ? (
                  <div>
                    <label className="block text-ink/80 font-semibold mb-1">Designation</label>
                    <div className="px-3 py-2 bg-field/60 border border-line rounded-lg text-ink text-xs font-semibold flex items-center justify-between min-h-[38px]">
                      <span>{formData.designation}</span>
                      <span className="text-[10px] text-muted font-mono">{formData.employee_id}</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-ink/80 font-semibold mb-1">
                      Designation <span className="text-danger">*</span>
                    </label>
                    <div className="px-3 py-2 bg-blue-950/40 border border-blue-500/40 rounded-lg text-blue-200 text-xs font-semibold flex items-center justify-between min-h-[38px]">
                      <span>Sales Manager (SM)</span>
                      <span className="text-[10px] text-blue-300 font-normal">Admin creates SM only</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-ink/80 font-semibold mb-1">Status</label>
                  <select
                    value={formData.status.toLowerCase()}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-ink/80 font-semibold mb-1">
                    Monthly Salary (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                    placeholder="e.g. 50000"
                    className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-ink/80 font-semibold mb-1">
                    Incentive per admission (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formData.incentive}
                    onChange={(e) => setFormData({ ...formData, incentive: e.target.value })}
                    placeholder="e.g. 20"
                    className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none font-mono"
                  />
                </div>
              </div>

              <div className={`grid grid-cols-1 ${isTopLevel ? 'sm:grid-cols-1' : 'sm:grid-cols-2'} gap-3`}>
                {!isTopLevel && (
                  <div>
                    <label className="block text-ink/80 font-semibold mb-1">
                      Daily Target (Leads / Day)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={formData.daily_target}
                      onChange={(e) => setFormData({ ...formData, daily_target: e.target.value })}
                      placeholder="e.g. 15"
                      className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none font-mono"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-ink/80 font-semibold mb-1">
                    Monthly Target (Leads / Month)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.monthly_target}
                    onChange={(e) => setFormData({ ...formData, monthly_target: e.target.value })}
                    placeholder="e.g. 300"
                    className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none font-mono"
                  />
                </div>
              </div>

              {!isTopLevel && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-ink/80 font-semibold">
                      Reports To {isCurrentASM && <span className="text-accent font-normal">(Sales Manager only)</span>}
                      {isCurrentBDE && <span className="text-accent font-normal">(Area Sales Manager only)</span>}
                    </label>
                    {isCurrentASM && availableManagers.length === 0 && (
                      <span className="text-[10px] text-warning font-medium">Create SM first</span>
                    )}
                    {isCurrentBDE && availableManagers.length === 0 && (
                      <span className="text-[10px] text-warning font-medium">Create ASM first</span>
                    )}
                  </div>
                  <select
                    value={formData.reports_to}
                    onChange={(e) => setFormData({ ...formData, reports_to: e.target.value })}
                    className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none"
                  >
                    <option value="">
                      {isCurrentASM
                        ? availableManagers.length === 0
                          ? 'No Sales Manager found — create SM first'
                          : 'Select Sales Manager (SM)'
                        : isCurrentBDE
                        ? availableManagers.length === 0
                          ? 'No Area Sales Manager found — create ASM first'
                          : 'Select Area Sales Manager (ASM)'
                        : 'No manager (top level)'}
                    </option>
                    {availableManagers.map((emp) => (
                      <option
                        key={emp.id || (emp as any)._id || emp.employee_id}
                        value={emp.employee_id}
                      >
                        {emp.name} ({emp.employee_id}) — {emp.designation}
                      </option>
                    ))}
                  </select>
                  {isCurrentASM && availableManagers.length === 0 ? (
                    <span className="block mt-1 text-[10px] text-warning font-medium">
                      ⚠️ No Sales Manager (SM) found. ASMs can only report to the Sales Manager. Please create the Sales Manager first, or assign the manager later.
                    </span>
                  ) : isCurrentBDE && availableManagers.length === 0 ? (
                    <span className="block mt-1 text-[10px] text-warning font-medium">
                      ⚠️ No Area Sales Manager (ASM) found. BDEs can only report to an Area Sales Manager. Please create an ASM first.
                    </span>
                  ) : (
                    <span className="block mt-1 text-[10px] text-subtle">
                      {isCurrentASM
                        ? 'Area Sales Managers (ASM) report directly to the Sales Manager (SM).'
                        : isCurrentBDE
                        ? 'Business Development Executives (BDE) report to their Area Sales Manager (ASM).'
                        : 'Used by the hierarchy: BDEs report to an ASM, and ASMs report to the SM.'}
                    </span>
                  )}
                </div>
              )}

              {!isTopLevel && (
                isCurrentASM ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-ink/80 font-semibold mb-1">
                          Team & Zone <span className="text-subtle font-normal">(Assigned by SM)</span>
                        </label>
                        <div className="px-3 py-2 bg-field/60 border border-line rounded-lg text-ink text-xs font-semibold flex items-center justify-between min-h-[38px]">
                          <span>{currentAsmTeamInfo?.name || formData.team || '—'}</span>
                          <span className="text-[10px] text-muted font-normal">
                            {currentAsmTeamInfo?.zone || formData.zone || '—'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-ink/80 font-semibold mb-1">
                          Assigned Districts <span className="text-subtle font-normal">(Both Under This ASM)</span>
                        </label>
                        <div className="px-3 py-2 bg-field/60 border border-line rounded-lg text-ink text-xs flex flex-wrap items-center gap-1.5 min-h-[38px]">
                          {currentAsmTeamInfo?.isOffice ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-warning/15 text-warning border border-warning/30">
                              Office Team (No District)
                            </span>
                          ) : currentAsmTeamInfo && currentAsmTeamInfo.districts.length > 0 ? (
                            currentAsmTeamInfo.districts.map((d) => (
                              <span
                                key={d}
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-accent/15 text-accent border border-accent/30"
                              >
                                {d}
                              </span>
                            ))
                          ) : formData.district ? (
                            formData.district
                              .split(/[,&/]/)
                              .map((d) => d.trim())
                              .filter(Boolean)
                              .map((d) => (
                                <span
                                  key={d}
                                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-accent/15 text-accent border border-accent/30"
                                >
                                  {d}
                                </span>
                              ))
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted">
                      Both districts above are assigned to this Area Sales Manager by the Sales Manager (SM).
                    </p>
                  </div>
                ) : isCurrentBDE ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-ink/80 font-semibold mb-1">
                          Team <span className="text-subtle font-normal">(Auto-derived from ASM)</span>
                        </label>
                        <div className="px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs font-semibold flex items-center justify-between min-h-[38px]">
                          <span>{selectedAsmTeam ? selectedAsmTeam.name : '—'}</span>
                          {selectedAsmTeam?.zone && (
                            <span className="text-[10px] text-muted font-normal">({selectedAsmTeam.zone})</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-ink/80 font-semibold mb-1">
                          District <span className="text-danger">*</span>
                          {selectedAsmTeam && <span className="text-subtle font-normal"> (1 of team&apos;s 2 districts)</span>}
                        </label>
                        <select
                          required
                          value={formData.district}
                          onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                          disabled={!selectedAsmTeam || asmTeamDistricts.length === 0}
                          className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none disabled:opacity-50"
                        >
                          {!formData.reports_to ? (
                            <option value="">Select an ASM above first</option>
                          ) : !selectedAsmTeam ? (
                            <option value="">Selected ASM has no team</option>
                          ) : asmTeamDistricts.length === 0 ? (
                            <option value="">No districts assigned to team</option>
                          ) : (
                            <>
                              <option value="">Select district…</option>
                              {asmTeamDistricts.map((d: string) => (
                                <option key={d} value={d}>
                                  {d}
                                </option>
                              ))}
                            </>
                          )}
                        </select>
                      </div>
                    </div>

                    {!formData.reports_to ? (
                      <p className="text-[11px] text-muted">
                        ℹ️ Select an Area Sales Manager (Reports To) above to display their assigned team and its 2 districts.
                      </p>
                    ) : !selectedAsmTeam ? (
                      <p className="text-[11px] text-warning font-medium">
                        ⚠️ The selected Area Sales Manager has not been assigned as Team Lead of any team yet. Please assign them in Teams first.
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted">
                        Assigned to <strong>{selectedAsmTeam.name}</strong> covering <strong>{asmTeamDistricts.join(' & ')}</strong>. Only these 2 districts assigned to the ASM can be selected for this BDE.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-ink/80 font-semibold mb-1">Zone</label>
                      <select
                        value={formData.zone}
                        onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                        className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none"
                      >
                        {ZONE_OPTIONS.map((z) => (
                          <option key={z} value={z}>{z}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-ink/80 font-semibold mb-1">District</label>
                      <select
                        value={formData.district}
                        onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                        className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none"
                      >
                        {DISTRICT_OPTIONS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )
              )}

              {/* Payment Details */}
              <div className="pt-1">
                <h4 className="text-[11px] font-bold text-ink uppercase tracking-wide border-t border-line pt-3">
                  Payment Details
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink/80 font-semibold mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    placeholder="e.g. State Bank of India"
                    className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-ink/80 font-semibold mb-1">Account Holder Name</label>
                  <input
                    type="text"
                    value={formData.account_holder_name}
                    onChange={(e) => setFormData({ ...formData, account_holder_name: e.target.value })}
                    placeholder="e.g. Aslam K"
                    className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink/80 font-semibold mb-1">Account Number</label>
                  <input
                    type="text"
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    placeholder="e.g. 32165498701"
                    className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-ink/80 font-semibold mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={formData.ifsc_code}
                    onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value })}
                    placeholder="e.g. SBIN0001234"
                    className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-ink/80 font-semibold mb-1">UPI ID (Optional)</label>
                <input
                  type="text"
                  value={formData.upi_id}
                  onChange={(e) => setFormData({ ...formData, upi_id: e.target.value })}
                  placeholder="e.g. aslam@okhdfcbank"
                  className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-line text-ink/80 hover:bg-active transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingEmployee ? 'Update Employee' : 'Save Employee'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
