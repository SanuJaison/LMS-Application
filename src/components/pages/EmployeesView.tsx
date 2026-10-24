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
      const res = await fetch('/api/admin/employees');
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
        fetch('/api/admin/designations'),
        fetch('/api/admin/teams'),
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header with Breadcrumbs & Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <span>Employees</span>
            <span className="text-slate-600">&gt;</span>
            <span className="text-slate-300">List</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Employees</h1>
        </div>

        <button
          id="btn-new-employee"
          onClick={openNewModal}
          className="px-4 py-2 bg-[#00a2b8] hover:bg-[#0891b2] text-white text-xs font-semibold rounded-lg shadow transition self-start sm:self-auto cursor-pointer"
        >
          New employee
        </button>
      </div>

      {/* Table Container Card */}
      <div className="bg-[#0b1322] border border-[#1b253b] rounded-xl shadow-lg overflow-hidden">
        {/* Top Bar with Search on Right & Column Visibility Toggle */}
        <div className="p-3.5 flex items-center justify-between sm:justify-end gap-2 border-b border-[#1b253b]">
          <div className="relative flex-1 sm:w-64 sm:flex-initial">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-[#080d18] border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#00a2b8]"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setShowColumnToggle(!showColumnToggle)}
              className="p-2 border border-slate-700/80 rounded-lg bg-[#080d18] text-slate-400 hover:text-white transition flex items-center justify-center cursor-pointer"
              title="Toggle columns"
            >
              <Columns3 className="w-3.5 h-3.5" />
            </button>

            {showColumnToggle && (
              <div className="absolute right-0 mt-2 w-48 bg-[#0d1627] border border-[#223352] rounded-xl shadow-2xl p-3 z-30 text-xs">
                <div className="font-semibold text-slate-300 mb-2 pb-1 border-b border-slate-800">
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
                  ].map(({ key, label }) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer select-none"
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
                        className="rounded bg-[#080d18] border-slate-700 text-[#00a2b8] focus:ring-0 cursor-pointer"
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
          <div className="px-4 py-2.5 bg-[#132038] border-b border-[#203254] flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center gap-2 text-white">
              <span className="font-semibold">{selectedIds.length}</span>
              <span className="text-slate-300">
                employee{selectedIds.length > 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedIds([])}
                className="px-2.5 py-1 rounded bg-[#0b1322] border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              >
                Deselect all
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1 rounded bg-red-900/60 hover:bg-red-800 text-red-200 border border-red-700/60 transition flex items-center gap-1.5 font-medium cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete selected</span>
              </button>
            </div>
          </div>
        )}

        {/* Table Content */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 text-[#00a2b8] animate-spin" />
            <span className="text-xs">Loading employees...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1b253b] text-slate-300 font-semibold text-xs bg-[#0b1322]">
                  <th className="py-3.5 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.length === paginatedEmployees.length &&
                        paginatedEmployees.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="rounded bg-[#080d18] border-slate-700 text-[#00a2b8] focus:ring-0 cursor-pointer"
                    />
                  </th>
                  {columnVisibility.name !== false && (
                    <th
                      onClick={() => handleSort('name')}
                      className="py-3.5 px-4 cursor-pointer hover:text-white select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Name</span>
                        <ChevronDown
                          className={`w-3 h-3 text-slate-500 transition-transform ${
                            sortField === 'name' && sortOrder === 'desc' ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </th>
                  )}
                  {columnVisibility.email !== false && (
                    <th
                      onClick={() => handleSort('email')}
                      className="py-3.5 px-4 cursor-pointer hover:text-white select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Email</span>
                        <ChevronDown
                          className={`w-3 h-3 text-slate-500 transition-transform ${
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
                  <th className="py-3.5 px-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#172236]">
                {paginatedEmployees.length > 0 ? (
                  paginatedEmployees.map((emp, idx) => {
                    const id = emp.id || (emp as any)._id || String(idx);
                    return (
                      <tr key={id} className="hover:bg-[#131d2e]/60 transition">
                        <td className="py-3.5 px-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(id)}
                            onChange={() => toggleSelectOne(id)}
                            className="rounded bg-[#080d18] border-slate-700 text-[#00a2b8] focus:ring-0 cursor-pointer"
                          />
                        </td>
                        {columnVisibility.name !== false && (
                          <td className="py-3.5 px-4 font-normal text-slate-200">
                            {emp.name}
                          </td>
                        )}
                        {columnVisibility.email !== false && (
                          <td className="py-3.5 px-4 text-slate-400">
                            {emp.email}
                          </td>
                        )}
                        {columnVisibility.employeeId !== false && (
                          <td className="py-3.5 px-4 font-mono text-slate-300 text-[11px]">
                            {emp.employee_id}
                          </td>
                        )}
                        {columnVisibility.contactNo !== false && (
                          <td className="py-3.5 px-4 text-slate-300">
                            {emp.contact_number}
                          </td>
                        )}
                        {columnVisibility.designation !== false && (
                          <td className="py-3.5 px-4 text-slate-400">
                            {emp.designation || '—'}
                          </td>
                        )}
                        {columnVisibility.zone !== false && (
                          <td className="py-3.5 px-4 text-slate-300">
                            {emp.zone}
                          </td>
                        )}
                        {columnVisibility.district !== false && (
                          <td className="py-3.5 px-4 text-slate-300">
                            {emp.district}
                          </td>
                        )}
                        {columnVisibility.team !== false && (
                          <td className="py-3.5 px-4 text-slate-300">
                            {emp.team || '—'}
                          </td>
                        )}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-3.5 whitespace-nowrap">
                            <button
                              onClick={() => setViewingEmployee(emp)}
                              className="inline-flex items-center gap-1.5 text-[#38bdf8] hover:text-white transition font-medium text-xs hover:underline cursor-pointer"
                              title="View details"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#38bdf8]" />
                              <span>View</span>
                            </button>
                            <button
                              onClick={() => openEditModal(emp)}
                              className="inline-flex items-center gap-1.5 text-[#38bdf8] hover:text-white transition font-medium text-xs hover:underline cursor-pointer"
                              title="Edit employee"
                            >
                              <Pencil className="w-3.5 h-3.5 text-[#38bdf8]" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteEmployee(emp)}
                              className="inline-flex items-center gap-1.5 text-[#f43f5e] hover:text-red-400 transition font-medium text-xs hover:underline cursor-pointer"
                              title="Delete employee"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-[#f43f5e]" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500">
                      No employees found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Footer with Record Count & Pagination */}
        <div className="px-4 py-3 bg-[#0a101d] border-t border-[#1b253b] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            Showing{' '}
            <span className="font-semibold text-white">
              {filteredAndSortedEmployees.length === 0
                ? 0
                : (currentPage - 1) * perPage + 1}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-white">
              {Math.min(currentPage * perPage, filteredAndSortedEmployees.length)}
            </span>{' '}
            of{' '}
            <span className="font-semibold text-white">
              {filteredAndSortedEmployees.length}
            </span>{' '}
            results
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span>Per page</span>
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-[#080d18] border border-slate-700/80 rounded px-2.5 py-1 text-white text-xs outline-none focus:border-[#00a2b8]"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            {Math.ceil(filteredAndSortedEmployees.length / perPage) > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 rounded border border-slate-700 bg-[#080d18] text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Previous
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((p) =>
                      Math.min(
                        Math.ceil(filteredAndSortedEmployees.length / perPage),
                        p + 1
                      )
                    )
                  }
                  disabled={
                    currentPage >=
                    Math.ceil(filteredAndSortedEmployees.length / perPage)
                  }
                  className="px-2.5 py-1 rounded border border-slate-700 bg-[#080d18] text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* VIEW EMPLOYEE MODAL */}
      {viewingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#111827] border border-slate-700 rounded-2xl shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">{viewingEmployee.name}</h3>
                <p className="text-xs text-slate-400">{viewingEmployee.email}</p>
              </div>
              <button
                onClick={() => setViewingEmployee(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-[#0b101d] p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-0.5">Employee ID</span>
                <span className="text-white font-mono font-medium">{viewingEmployee.employee_id}</span>
              </div>
              <div className="bg-[#0b101d] p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-0.5">Contact</span>
                <span className="text-white font-medium">{viewingEmployee.contact_number}</span>
              </div>
              <div className="bg-[#0b101d] p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-0.5">Designation</span>
                <span className="text-white font-medium">{viewingEmployee.designation || '—'}</span>
              </div>
              <div className="bg-[#0b101d] p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-0.5">Team</span>
                <span className="text-white font-medium">{viewingEmployee.team || 'Team Kakkanad'}</span>
              </div>
              <div className="bg-[#0b101d] p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-0.5">Zone</span>
                <span className="text-white font-medium">{viewingEmployee.zone || 'Central Zone'}</span>
              </div>
              <div className="bg-[#0b101d] p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-0.5">District</span>
                <span className="text-white font-medium">{viewingEmployee.district || 'Ernakulam'}</span>
              </div>
              <div className="bg-[#0b101d] p-3 rounded-lg border border-slate-800 col-span-2 flex justify-between items-center">
                <span className="text-slate-400">Status</span>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800 uppercase">
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
                className="px-4 py-2 bg-[#09929e] hover:bg-[#08818c] text-white text-xs font-semibold rounded-lg shadow cursor-pointer"
              >
                Edit Employee
              </button>
              <button
                onClick={() => setViewingEmployee(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT EMPLOYEE MODAL */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl bg-[#111827] border border-slate-700 rounded-2xl shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-white text-base">
                {editingEmployee ? 'Edit' : 'New'} Employee
              </h3>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Aslam"
                    className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. aslam@gmail.com"
                    className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Password <span className="text-[#f43f5e]">*</span>
                  </label>
                  <input
                    type="password"
                    required={!editingEmployee}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingEmployee ? 'Leave blank to keep current' : 'e.g. password123'}
                    autoComplete="new-password"
                    className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none"
                  />
                  {editingEmployee && (
                    <span className="block mt-1 text-[10px] text-slate-500">
                      Leave blank to keep the existing password.
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Contact No</label>
                  <input
                    type="text"
                    required
                    value={formData.contact_number}
                    onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                    placeholder="e.g. 9746543243"
                    className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Employee ID</label>
                  <input
                    type="text"
                    required
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    placeholder="e.g. BDE001"
                    className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none font-mono"
                  />
                  <span className="block mt-1 text-[10px] text-slate-500">
                    Auto-generated from the designation prefix.
                  </span>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Designation <span className="text-[#f43f5e]">*</span>
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
                    className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none"
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
                  <label className="block text-slate-300 font-semibold mb-1">Team</label>
                  <select
                    value={formData.team}
                    onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none"
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
                  <label className="block text-slate-300 font-semibold mb-1">Status</label>
                  <select
                    value={formData.status.toLowerCase()}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Zone</label>
                  <select
                    value={formData.zone}
                    onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none"
                  >
                    {ZONE_OPTIONS.map((z) => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">District</label>
                  <select
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none"
                  >
                    {DISTRICT_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Payment Details */}
              <div className="pt-1">
                <h4 className="text-[11px] font-bold text-slate-200 uppercase tracking-wide border-t border-slate-800 pt-3">
                  Payment Details
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    placeholder="e.g. State Bank of India"
                    className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Account Holder Name</label>
                  <input
                    type="text"
                    value={formData.account_holder_name}
                    onChange={(e) => setFormData({ ...formData, account_holder_name: e.target.value })}
                    placeholder="e.g. Aslam K"
                    className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Account Number</label>
                  <input
                    type="text"
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    placeholder="e.g. 32165498701"
                    className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={formData.ifsc_code}
                    onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value })}
                    placeholder="e.g. SBIN0001234"
                    className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">UPI ID (Optional)</label>
                <input
                  type="text"
                  value={formData.upi_id}
                  onChange={(e) => setFormData({ ...formData, upi_id: e.target.value })}
                  placeholder="e.g. aslam@okhdfcbank"
                  className="w-full px-3 py-2 bg-[#0b101d] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#09929e] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-[#09929e] hover:bg-[#08818c] text-white font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
