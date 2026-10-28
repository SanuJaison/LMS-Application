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

interface DesignationOption {
  id?: string;
  _id?: string;
  name: string;
  prefix?: string;
}

interface TeamOption {
  id?: string;
  _id?: string;
  name: string;
  district?: string;
  zone?: string;
}

export default function EmployeesView({ showToast }: EmployeesViewProps) {
  // Data state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

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
  const [teams, setTeams] = useState<TeamOption[]>([]);

  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    employee_id: '',
    contact_number: '',
    designation: 'Business Development Executive',
    zone: 'Central Zone',
    district: 'Ernakulam',
    team: 'Team Kakkanad',
    reports_to: '',
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

  // Fetch designation & team options for the dropdowns
  const fetchOptions = async () => {
    try {
      const [desigRes, teamRes] = await Promise.all([
        fetch('/api/admin/designations', { headers: authHeaders() }),
        fetch('/api/admin/teams', { headers: authHeaders() }),
      ]);

      const desigJson = await desigRes.json();
      if (desigJson.success && Array.isArray(desigJson.data)) {
        setDesignations(desigJson.data);
      }

      const teamJson = await teamRes.json();
      if (teamJson.success && Array.isArray(teamJson.data)) {
        setTeams(teamJson.data);
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

  // Filter & Sort
  const filteredAndSortedEmployees = useMemo(() => {
    let result = [...employees];

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
  }, [employees, searchQuery, sortField, sortOrder]);

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

  // Open Create Modal
  const openNewModal = () => {
    const defaultDesignation = designations[0]?.name || 'Business Development Executive';
    setEditingEmployee(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      employee_id: buildEmployeeId(defaultDesignation),
      contact_number: '',
      designation: defaultDesignation,
      zone: 'Central Zone',
      district: 'Ernakulam',
      team: teams[0]?.name || 'Team Kakkanad',
      reports_to: '',
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
    setEditingEmployee(emp);
    setFormData({
      name: emp.name || '',
      email: emp.email || '',
      password: '',
      employee_id: emp.employee_id || '',
      contact_number: emp.contact_number || '',
      designation: emp.designation || '',
      zone: emp.zone || 'Central Zone',
      district: emp.district || 'Ernakulam',
      team: emp.team || 'Team Kakkanad',
      reports_to: emp.reports_to || '',
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

      const payload: Record<string, any> = {
        ...(isEdit && { id: empId }),
        name: formData.name.trim(),
        email: formData.email.trim() || `${formData.name.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
        employee_id:
          formData.employee_id.trim() || buildEmployeeId(formData.designation, empId),
        contact_number: formData.contact_number.trim(),
        designation: formData.designation.trim(),
        zone: formData.zone.trim(),
        district: formData.district.trim(),
        team: formData.team.trim(),
        reports_to: formData.reports_to.trim(),
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
          onClick={openNewModal}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg shadow transition self-start sm:self-auto cursor-pointer"
        >
          New employee
        </button>
      </div>

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
                            {emp.district}
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
          <div className="w-full max-w-md bg-elevated border border-line rounded-2xl shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-field p-3 rounded-lg border border-line">
                <span className="text-muted block mb-0.5">Employee ID</span>
                <span className="text-ink font-mono font-medium">{viewingEmployee.employee_id}</span>
              </div>
              <div className="bg-field p-3 rounded-lg border border-line">
                <span className="text-muted block mb-0.5">Contact</span>
                <span className="text-ink font-medium">{viewingEmployee.contact_number}</span>
              </div>
              <div className="bg-field p-3 rounded-lg border border-line">
                <span className="text-muted block mb-0.5">Designation</span>
                <span className="text-ink font-medium">{viewingEmployee.designation || '—'}</span>
              </div>
              <div className="bg-field p-3 rounded-lg border border-line">
                <span className="text-muted block mb-0.5">Team</span>
                <span className="text-ink font-medium">{viewingEmployee.team || 'Team Kakkanad'}</span>
              </div>
              <div className="bg-field p-3 rounded-lg border border-line">
                <span className="text-muted block mb-0.5">Reports To</span>
                <span className="text-ink font-medium">
                  {managerLabel(viewingEmployee.reports_to)}
                </span>
              </div>
              <div className="bg-field p-3 rounded-lg border border-line">
                <span className="text-muted block mb-0.5">Zone</span>
                <span className="text-ink font-medium">{viewingEmployee.zone || 'Central Zone'}</span>
              </div>
              <div className="bg-field p-3 rounded-lg border border-line">
                <span className="text-muted block mb-0.5">District</span>
                <span className="text-ink font-medium">{viewingEmployee.district || 'Ernakulam'}</span>
              </div>
              <div className="bg-field p-3 rounded-lg border border-line sm:col-span-2 flex justify-between items-center">
                <span className="text-muted">Status</span>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-success/10 text-success border border-success/30 uppercase">
                  {viewingEmployee.status || 'Active'}
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
                    type="password"
                    required={!editingEmployee}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingEmployee ? 'Leave blank to keep current' : 'e.g. password123'}
                    autoComplete="new-password"
                    className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none"
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
                <div>
                  <label className="block text-ink/80 font-semibold mb-1">
                    Designation <span className="text-danger">*</span>
                  </label>
                  <select
                    required
                    value={formData.designation}
                    onChange={(e) => {
                      const value = e.target.value;
                      const currentKey = editingEmployee?.id || (editingEmployee as any)?._id;
                      setFormData((prev) => ({
                        ...prev,
                        designation: value,
                        employee_id: editingEmployee
                          ? prev.employee_id
                          : buildEmployeeId(value, currentKey),
                      }));
                    }}
                    className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none"
                  >
                    {formData.designation &&
                      !designations.some((d) => d.name === formData.designation) && (
                        <option value={formData.designation}>{formData.designation}</option>
                      )}
                    {designations.map((d) => (
                      <option key={d.id || d._id || d.name} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink/80 font-semibold mb-1">Team</label>
                  <select
                    value={formData.team}
                    onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                    className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none"
                  >
                    {formData.team && !teams.some((t) => t.name === formData.team) && (
                      <option value={formData.team}>{formData.team}</option>
                    )}
                    {teams.map((t) => (
                      <option key={t.id || t._id || t.name} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
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
              </div>

              <div>
                <label className="block text-ink/80 font-semibold mb-1">Reports To</label>
                <select
                  value={formData.reports_to}
                  onChange={(e) => setFormData({ ...formData, reports_to: e.target.value })}
                  className="w-full px-3 py-2 bg-field border border-line rounded-lg text-ink text-xs focus:ring-1 focus:ring-accent outline-none"
                >
                  <option value="">No manager (top level)</option>
                  {formData.reports_to &&
                    !employees.some((emp) => emp.employee_id === formData.reports_to) && (
                      <option value={formData.reports_to}>{formData.reports_to}</option>
                    )}
                  {employees
                    .filter((emp) => {
                      const empKey = emp.id || (emp as any)._id;
                      const editingKey =
                        editingEmployee?.id || (editingEmployee as any)?._id;
                      return empKey !== editingKey && emp.employee_id !== formData.employee_id;
                    })
                    .map((emp) => (
                      <option
                        key={emp.id || (emp as any)._id || emp.employee_id}
                        value={emp.employee_id}
                      >
                        {emp.name} ({emp.employee_id}) — {emp.designation}
                      </option>
                    ))}
                </select>
                <span className="block mt-1 text-[10px] text-subtle">
                  Used by the mobile team hierarchy: a BDE reports to a BDM, and a BDM
                  reports to an ASM.
                </span>
              </div>

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
