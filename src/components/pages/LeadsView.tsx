'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Plus,
  Upload,
  Eye,
  Pencil,
  Trash2,
  X,
  Loader2,
  ChevronDown,
  SlidersHorizontal,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';
import {
  fetchResourceList,
  fetchDistricts,
  createResourceItem,
  updateResourceItem,
  deleteResourceItem,
  authHeaders,
} from '../../services/api';

export interface LeadItem {
  _id?: string;
  id?: string;
  name: string;
  phone?: string;
  whats_number?: string;
  email?: string;
  address?: string;
  place?: string;
  district?: string;
  course?: string;
  interested_course?: string;
  interested_topic?: string;
  age?: string | number;
  qualification?: string;
  college_name?: string;
  current_year?: string;
  source?: string;
  lead_source?: string;
  status: any;
  admission_status?: string;
  employee?: string;
  employee_id?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface LeadsViewProps {
  showToast?: (type: 'success' | 'danger', message: string) => void;
}

const DEFAULT_SOURCES = [
  'Cold Call',
  'Website',
  'Campus Drive',
  'Referral',
  'Social Media',
  'Other',
];

const DEFAULT_STATUSES = [
  'New',
  'Contacted',
  'Interested',
  'Follow Up',
  'Won',
  'Lost',
];

export default function LeadsView({ showToast }: LeadsViewProps) {
  // Mode: 'list' | 'create'
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');

  // Data state
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [courses, setCourses] = useState<string[]>([]);
  const [employees, setEmployees] = useState<{ name: string; employee_id?: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Table Selection & Pagination
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [perPage, setPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Import Modal
  const [importModalOpen, setImportModalOpen] = useState<boolean>(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // View / Edit Modals
  const [viewingLead, setViewingLead] = useState<LeadItem | null>(null);
  const [editingLead, setEditingLead] = useState<LeadItem | null>(null);

  // Create Form State
  const [formName, setFormName] = useState<string>('');
  const [formPhone, setFormPhone] = useState<string>('');
  const [formWhatsapp, setFormWhatsapp] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formAddress, setFormAddress] = useState<string>('');
  const [formPlace, setFormPlace] = useState<string>('');
  const [formDistrict, setFormDistrict] = useState<string>('');
  const [formAge, setFormAge] = useState<string>('');
  const [formQualification, setFormQualification] = useState<string>('');
  const [formCollege, setFormCollege] = useState<string>('');
  const [formCurrentYear, setFormCurrentYear] = useState<string>('');
  const [formInterestedTopic, setFormInterestedTopic] = useState<string>('');
  const [formCourse, setFormCourse] = useState<string>('');
  const [formSource, setFormSource] = useState<string>('');
  const [formStatus, setFormStatus] = useState<string>('New');
  const [formEmployee, setFormEmployee] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Load leads, districts, courses, and employees from MongoDB Atlas
  // silent = true refreshes in the background without blanking the table
  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [leadsRes, distsRes, coursesRes, empsRes] = await Promise.all([
        fetchResourceList('leads'),
        fetchDistricts(),
        fetchResourceList('courses'),
        fetchResourceList('employees'),
      ]);

      setLeads(Array.isArray(leadsRes) ? leadsRes : []);

      // Format options
      if (Array.isArray(distsRes)) {
        setDistricts(distsRes.map((d: any) => d.name || d).filter(Boolean));
      }
      if (Array.isArray(coursesRes)) {
        setCourses(coursesRes.map((c: any) => c.name || c).filter(Boolean));
      }
      if (Array.isArray(empsRes)) {
        setEmployees(
          empsRes
            .map((e: any) => ({ name: e.name, employee_id: e.employee_id }))
            .filter((e: any) => Boolean(e.name))
        );
      }
    } catch (err) {
      console.error('Failed to load leads data:', err);
      if (!silent) showToast?.('danger', 'Failed to load leads data from database.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Leads created from the employee app should show up as soon as the admin
    // comes back to this tab, without a full page reload.
    const refreshOnFocus = () => loadData(true);
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnFocus);
    return () => {
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData(true);
    setIsRefreshing(false);
  };

  const rowId = (item: LeadItem) => (item._id || item.id || '').toString();

  // Filtered & Sorted
  const filteredLeads = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let res = leads;

    if (q) {
      res = res.filter(
        (l) =>
          l.name?.toLowerCase().includes(q) ||
          l.phone?.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q) ||
          l.district?.toLowerCase().includes(q) ||
          l.course?.toLowerCase().includes(q) ||
          l.source?.toLowerCase().includes(q) ||
          String(l.status)?.toLowerCase().includes(q) ||
          l.employee?.toLowerCase().includes(q)
      );
    }

    if (!sortField) return res;

    return [...res].sort((a: any, b: any) => {
      const valA = a[sortField] ?? '';
      const valB = b[sortField] ?? '';
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [leads, searchQuery, sortField, sortAsc]);

  // Pagination
  const totalPages = Math.ceil(filteredLeads.length / perPage) || 1;
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredLeads.slice(start, start + perPage);
  }, [filteredLeads, currentPage, perPage]);

  // Selection
  const allVisibleSelected =
    paginatedLeads.length > 0 &&
    paginatedLeads.every((item) => selectedIds.includes(rowId(item)));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleIds = paginatedLeads.map(rowId);
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      const visibleIds = paginatedLeads.map(rowId);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected leads?`)) return;
    try {
      await deleteResourceItem('leads', selectedIds);
      showToast?.('success', `${selectedIds.length} leads deleted successfully!`);
      setSelectedIds([]);
      await loadData();
    } catch {
      showToast?.('danger', 'Failed to delete selected leads.');
    }
  };

  // Single Delete
  const handleDeleteLead = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return;
    try {
      await deleteResourceItem('leads', id);
      showToast?.('success', 'Lead deleted successfully!');
      await loadData();
    } catch {
      showToast?.('danger', 'Failed to delete lead.');
    }
  };

  // Reset Create Form
  const resetForm = () => {
    setFormName('');
    setFormPhone('');
    setFormWhatsapp('');
    setFormEmail('');
    setFormAddress('');
    setFormPlace('');
    setFormDistrict('');
    setFormAge('');
    setFormQualification('');
    setFormCollege('');
    setFormCurrentYear('');
    setFormInterestedTopic('');
    setFormCourse('');
    setFormSource('');
    setFormStatus('New');
    setFormEmployee('');
    setFormNotes('');
  };

  // Submit Create Lead
  const handleCreateLead = async (keepOpen = false) => {
    if (!formName.trim()) {
      showToast?.('danger', 'Name is required.');
      return;
    }
    if (!formDistrict) {
      showToast?.('danger', 'District is required.');
      return;
    }
    if (!formCourse) {
      showToast?.('danger', 'Course is required.');
      return;
    }
    if (!formSource) {
      showToast?.('danger', 'Lead Source is required.');
      return;
    }
    if (!formEmployee) {
      showToast?.('danger', 'Assigned employee is required.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        phone: formPhone.trim(),
        contact_number: formPhone.trim(),
        whats_number: formWhatsapp.trim() || formPhone.trim(),
        whatsapp_number: formWhatsapp.trim() || formPhone.trim(),
        email: formEmail.trim(),
        address: formAddress.trim(),
        place: formPlace.trim(),
        district: formDistrict,
        age: formAge.trim(),
        qualification: formQualification.trim(),
        college_name: formCollege.trim(),
        current_year: formCurrentYear.trim(),
        interested_topic: formInterestedTopic.trim(),
        interested_course: formCourse,
        course: formCourse,
        source: formSource,
        lead_source: formSource,
        status: formStatus || 'New',
        admission_status: formStatus || 'New',
        employee: formEmployee,
        notes: formNotes.trim(),
        remarks: formNotes.trim(),
      };

      await createResourceItem('leads', payload);
      showToast?.('success', 'Lead created successfully!');
      await loadData();

      if (keepOpen) {
        resetForm();
      } else {
        resetForm();
        setViewMode('list');
      }
    } catch (err: any) {
      console.error('Error creating lead:', err);
      showToast?.('danger', err.message || 'Failed to create lead.');
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Edit Lead
  const handleUpdateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead) return;
    setIsSaving(true);
    try {
      await updateResourceItem('leads', {
        id: rowId(editingLead),
        _id: rowId(editingLead),
        name: editingLead.name,
        phone: editingLead.phone,
        contact_number: editingLead.phone,
        whats_number: editingLead.whats_number,
        whatsapp_number: editingLead.whats_number,
        email: editingLead.email,
        address: editingLead.address,
        place: editingLead.place,
        district: editingLead.district,
        age: editingLead.age,
        qualification: editingLead.qualification,
        college_name: editingLead.college_name,
        current_year: editingLead.current_year,
        interested_topic: editingLead.interested_topic,
        interested_course: editingLead.course,
        course: editingLead.course,
        source: editingLead.source,
        lead_source: editingLead.source,
        status: editingLead.status,
        admission_status: editingLead.status,
        employee: editingLead.employee,
        notes: editingLead.notes,
      });
      showToast?.('success', 'Lead updated successfully!');
      setEditingLead(null);
      await loadData();
    } catch {
      showToast?.('danger', 'Failed to update lead.');
    } finally {
      setIsSaving(false);
    }
  };

  // Download Example CSV
  const handleDownloadExampleCSV = () => {
    const csvContent =
      'Name,Phone,Email,Address,District,Source,Assigned Employee,Course,Notes\n' +
      'Suresh Kumar,9847123456,suresh@gmail.com,Edappally Kochi,Ernakulam,Cold Call,BDE001,Fullstack Development,Interested in weekend batch\n' +
      'Anjali Mohan,9847234567,anjali@gmail.com,Mavoor Kozhikode,Kozhikode,Website,ASM001,Data Science with AI,Call after 5 PM\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'leads_example.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle CSV Import - the server parses the file, resolves the assigned
  // employee by ID or name, and bulk-inserts the leads.
  const handleImportCSV = async () => {
    if (!importFile) {
      showToast?.('danger', 'Please select a CSV file to upload.');
      return;
    }

    setIsImporting(true);
    try {
      const text = await importFile.text();

      if (!text.trim()) {
        showToast?.('danger', 'CSV file appears to be empty.');
        return;
      }

      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ csv: text }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        const detail = json?.message || 'Failed to import CSV file.';
        showToast?.('danger', detail);
        return;
      }

      const imported = json.data?.imported ?? 0;
      const failed = json.data?.failed ?? 0;
      const unmatched: string[] = json.data?.unmatched_assignments ?? [];

      let message = `Imported ${imported} lead${imported === 1 ? '' : 's'} successfully!`;
      if (failed > 0) message += ` ${failed} row${failed === 1 ? '' : 's'} skipped.`;
      if (unmatched.length > 0) {
        message += ` Unknown employee: ${unmatched.join(', ')}.`;
      }

      showToast?.(failed > 0 || unmatched.length > 0 ? 'danger' : 'success', message);
      setImportModalOpen(false);
      setImportFile(null);
      await loadData();
    } catch (err) {
      console.error('Import failed:', err);
      showToast?.('danger', 'Failed to parse or import CSV file.');
    } finally {
      setIsImporting(false);
    }
  };

  // -------------------------------------------------------------
  // VIEW: CREATE LEAD FORM (Screenshots 1 & 2)
  // -------------------------------------------------------------
  if (viewMode === 'create') {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Breadcrumb matching Screenshot 1 */}
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <button
              onClick={() => setViewMode('list')}
              className="text-slate-400 hover:text-white hover:underline cursor-pointer"
            >
              Leads
            </button>
            <span className="text-slate-500">&gt;</span>
            <span className="text-slate-300">Create</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Create Lead</h1>
        </div>

        {/* Form Fields matching Screenshots 1 & 2 */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateLead(false);
          }}
          className="space-y-5 max-w-5xl"
        >
          {/* Row 1: Name & Phone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#080d1a] border border-slate-700/60 rounded-lg text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-[#09929e]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Phone
              </label>
              <input
                type="text"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#080d1a] border border-slate-700/60 rounded-lg text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-[#09929e]"
              />
            </div>
          </div>

          {/* Row 2: WhatsApp Number & Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                WhatsApp Number
              </label>
              <input
                type="text"
                value={formWhatsapp}
                onChange={(e) => setFormWhatsapp(e.target.value)}
                placeholder="Defaults to the phone number"
                className="w-full px-3.5 py-2.5 bg-[#080d1a] border border-slate-700/60 rounded-lg text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-[#09929e]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#080d1a] border border-slate-700/60 rounded-lg text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-[#09929e]"
              />
            </div>
          </div>

          {/* Row 3: Address (Full Width) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Address
            </label>
            <textarea
              rows={2}
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#080d1a] border border-slate-700/60 rounded-lg text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-[#09929e]"
            />
          </div>

          {/* Row 4: Place & District */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Place
              </label>
              <input
                type="text"
                value={formPlace}
                onChange={(e) => setFormPlace(e.target.value)}
                placeholder="e.g. Edappally, Kochi"
                className="w-full px-3.5 py-2.5 bg-[#080d1a] border border-slate-700/60 rounded-lg text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-[#09929e]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                District <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  required
                  value={formDistrict}
                  onChange={(e) => setFormDistrict(e.target.value)}
                  className="w-full appearance-none px-3.5 py-2.5 bg-[#080d1a] border border-slate-700/60 rounded-lg text-[13px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#09929e]"
                >
                  <option value="" disabled>Select an option</option>
                  {districts.map((d) => (
                    <option key={d} value={d} className="bg-[#0b1322] text-white">
                      {d}
                    </option>
                  ))}
                  {districts.length === 0 && (
                    <option value="Ernakulam" className="bg-[#0b1322] text-white">Ernakulam</option>
                  )}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Row 5: Age & Qualification */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Age
              </label>
              <input
                type="number"
                min={10}
                max={100}
                value={formAge}
                onChange={(e) => setFormAge(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#080d1a] border border-slate-700/60 rounded-lg text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-[#09929e]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Qualification
              </label>
              <input
                type="text"
                value={formQualification}
                onChange={(e) => setFormQualification(e.target.value)}
                placeholder="e.g. B.Tech Computer Science"
                className="w-full px-3.5 py-2.5 bg-[#080d1a] border border-slate-700/60 rounded-lg text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-[#09929e]"
              />
            </div>
          </div>

          {/* Row 6: College / Institute & Current Year */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                College / Institute Name
              </label>
              <input
                type="text"
                value={formCollege}
                onChange={(e) => setFormCollege(e.target.value)}
                placeholder="e.g. Model Engineering College"
                className="w-full px-3.5 py-2.5 bg-[#080d1a] border border-slate-700/60 rounded-lg text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-[#09929e]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Current Year
              </label>
              <input
                type="text"
                value={formCurrentYear}
                onChange={(e) => setFormCurrentYear(e.target.value)}
                placeholder="e.g. Final Year / Passed Out"
                className="w-full px-3.5 py-2.5 bg-[#080d1a] border border-slate-700/60 rounded-lg text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-[#09929e]"
              />
            </div>
          </div>

          {/* Row 7: Interested Topic & Interested Course */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Interested Topic
              </label>
              <input
                type="text"
                value={formInterestedTopic}
                onChange={(e) => setFormInterestedTopic(e.target.value)}
                placeholder="e.g. MERN Stack & Next.js"
                className="w-full px-3.5 py-2.5 bg-[#080d1a] border border-slate-700/60 rounded-lg text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-[#09929e]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Interested Course <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  required
                  value={formCourse}
                  onChange={(e) => setFormCourse(e.target.value)}
                  className="w-full appearance-none px-3.5 py-2.5 bg-[#080d1a] border border-slate-700/60 rounded-lg text-[13px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#09929e]"
                >
                  <option value="" disabled>Select an option</option>
                  {courses.map((c) => (
                    <option key={c} value={c} className="bg-[#0b1322] text-white">
                      {c}
                    </option>
                  ))}
                  {courses.length === 0 && (
                    <>
                      <option value="Fullstack Development" className="bg-[#0b1322] text-white">Fullstack Development</option>
                      <option value="Data Analytics" className="bg-[#0b1322] text-white">Data Analytics</option>
                      <option value="Medical Coding" className="bg-[#0b1322] text-white">Medical Coding</option>
                    </>
                  )}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Row 5: Lead Source & Lead Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Lead Source <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  required
                  value={formSource}
                  onChange={(e) => setFormSource(e.target.value)}
                  className="w-full appearance-none px-3.5 py-2.5 bg-[#080d1a] border border-slate-700/60 rounded-lg text-[13px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#09929e]"
                >
                  <option value="" disabled>Select an option</option>
                  {DEFAULT_SOURCES.map((s) => (
                    <option key={s} value={s} className="bg-[#0b1322] text-white">
                      {s}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Lead Status <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                <select
                  required
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full appearance-none px-3.5 py-2.5 bg-[#080d1a] border border-slate-700/60 rounded-lg text-[13px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#09929e]"
                >
                  <option value="" disabled>Select an option</option>
                  {DEFAULT_STATUSES.map((st) => (
                    <option key={st} value={st} className="bg-[#0b1322] text-white">
                      {st}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 flex items-center gap-1.5 text-slate-400">
                  {formStatus && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormStatus('');
                      }}
                      className="hover:text-white cursor-pointer"
                      title="Clear status"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Row 6: Assigned Employee */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Assigned employee <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  required
                  value={formEmployee}
                  onChange={(e) => setFormEmployee(e.target.value)}
                  className="w-full appearance-none px-3.5 py-2.5 bg-[#080d1a] border border-slate-700/60 rounded-lg text-[13px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#09929e]"
                >
                  <option value="" disabled>Select an option</option>
                  {employees.map((emp) => (
                    <option key={emp.name} value={emp.name} className="bg-[#0b1322] text-white">
                      {emp.employee_id ? `${emp.name} (${emp.employee_id})` : emp.name}
                    </option>
                  ))}
                  {employees.length === 0 && (
                    <option value="Aslam" className="bg-[#0b1322] text-white">Aslam</option>
                  )}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
            <div className="hidden md:block"></div>
          </div>

          {/* Row 7: Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Notes
            </label>
            <textarea
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#080d1a] border border-slate-700/60 rounded-lg text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-[#09929e]"
            />
          </div>

          {/* Bottom Action Buttons matching Screenshot 2 */}
          <div className="pt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-[#09929e] hover:bg-[#08818c] text-white text-[13px] font-semibold rounded-lg shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Creating…' : 'Create'}
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleCreateLead(true)}
              className="px-4 py-2 bg-[#0b1322] hover:bg-slate-800 text-white text-[13px] font-semibold rounded-lg border border-slate-700 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              Create &amp; create another
            </button>

            <button
              type="button"
              onClick={() => {
                resetForm();
                setViewMode('list');
              }}
              className="px-4 py-2 bg-[#0b1322] hover:bg-slate-800 text-white text-[13px] font-semibold rounded-lg border border-slate-700 transition active:scale-95 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: LEADS LIST TABLE (Screenshot 3)
  // -------------------------------------------------------------
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Breadcrumb matching Screenshot 3 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span>Leads</span>
            <span className="text-slate-500">&gt;</span>
            <span className="text-slate-300">List</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Leads</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* New lead button */}
          <button
            onClick={() => setViewMode('create')}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#081e2b] hover:bg-[#0b283a] text-[#38bdf8] border border-[#09929e]/50 hover:border-[#09929e] text-[13px] font-semibold rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
          >
            <span>New lead</span>
          </button>

          {/* Import leads button matching Screenshot 3 */}
          <button
            onClick={() => setImportModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#10b981] hover:bg-[#059669] text-white text-[13px] font-semibold rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Import leads</span>
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-[#0b1322] border border-[#1b263b] rounded-xl overflow-hidden shadow-xl">
        {/* Search Toolbar */}
        <div className="p-4 flex items-center justify-end gap-3 border-b border-[#1b263b]">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-[#080d1a] border border-slate-700/60 rounded-lg text-[13px] text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#09929e]"
            />
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 border border-slate-700/60 rounded-lg text-slate-400 hover:text-white bg-[#080d1a] cursor-pointer disabled:opacity-50"
            title="Refresh leads"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            className="p-2 border border-slate-700/60 rounded-lg text-slate-400 hover:text-white bg-[#080d1a] cursor-pointer"
            title="Columns"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Bulk Selection Notification Bar */}
        {selectedIds.length > 0 && (
          <div className="bg-[#10243e] px-4 py-2 flex items-center justify-between text-xs border-b border-[#1b263b]">
            <span className="text-slate-200">
              <strong className="text-white">{selectedIds.length}</strong> lead(s) selected
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedIds([])}
                className="text-slate-300 hover:text-white underline text-xs cursor-pointer"
              >
                Deselect all
              </button>
              <button
                onClick={handleBulkDelete}
                className="text-red-400 hover:text-red-300 font-semibold text-xs flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete selected</span>
              </button>
            </div>
          </div>
        )}

        {/* Table matching Screenshot 3 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1c283f] bg-[#0c1322] text-slate-300 font-semibold text-[13px]">
                <th className="py-3.5 px-4 w-10">
                  <input
                    type="checkbox"
                    className="accent-[#09929e] cursor-pointer rounded"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    title="Select all"
                  />
                </th>
                <th
                  onClick={() => handleSort('name')}
                  className="py-3.5 px-5 cursor-pointer hover:text-white select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Name</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-5 font-semibold">Phone</th>
                <th className="py-3.5 px-5 font-semibold">Email</th>
                <th className="py-3.5 px-5 font-semibold">District</th>
                <th className="py-3.5 px-5 font-semibold">Course</th>
                <th
                  onClick={() => handleSort('source')}
                  className="py-3.5 px-5 cursor-pointer hover:text-white select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Lead Source</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('status')}
                  className="py-3.5 px-5 cursor-pointer hover:text-white select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Lead Status</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('employee')}
                  className="py-3.5 px-5 cursor-pointer hover:text-white select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Assigned Employee</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-5 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#172236] text-[13px]">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-[#09929e]" />
                      <span>Loading leads...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedLeads.length > 0 ? (
                paginatedLeads.map((item, idx) => {
                  const id = rowId(item) || String(idx);
                  const isSelected = selectedIds.includes(id);

                  return (
                    <tr
                      key={id}
                      className={`transition text-slate-200 ${
                        isSelected ? 'bg-[#0e2233]' : 'hover:bg-[#131c2e]/60'
                      }`}
                    >
                      <td
                        className={`py-3.5 px-4 border-l-2 ${
                          isSelected ? 'border-[#09929e]' : 'border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="accent-[#09929e] cursor-pointer rounded"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(id)}
                        />
                      </td>
                      <td className="py-3.5 px-5 font-normal text-white">{item.name || '—'}</td>
                      <td className="py-3.5 px-5 text-slate-300">{item.phone || '—'}</td>
                      <td className="py-3.5 px-5 text-slate-300">{item.email || '—'}</td>
                      <td className="py-3.5 px-5 text-slate-300">{item.district || '—'}</td>
                      <td className="py-3.5 px-5 text-slate-300">{item.course || '—'}</td>
                      <td className="py-3.5 px-5 text-slate-300">{item.source || '—'}</td>
                      <td className="py-3.5 px-5 text-slate-200">{String(item.status || 'New')}</td>
                      <td className="py-3.5 px-5 text-slate-300">
                        {item.employee ? (
                          <span>
                            {item.employee}
                            {item.employee_id ? (
                              <span className="text-slate-500"> ({item.employee_id})</span>
                            ) : null}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => setViewingLead(item)}
                            className="inline-flex items-center gap-1.5 text-[13px] text-slate-300 hover:text-white transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4 text-slate-400" />
                            <span>View</span>
                          </button>
                          <button
                            onClick={() => setEditingLead(item)}
                            className="inline-flex items-center gap-1.5 text-[13px] text-[#09929e] hover:text-[#08818c] transition cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5 text-[#09929e]" />
                            <span>Edit</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    No leads found. Click &quot;New lead&quot; to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#1c283f] flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] text-slate-400">
          <span>
            {filteredLeads.length > 0
              ? `Showing ${(currentPage - 1) * perPage + 1} to ${Math.min(
                  currentPage * perPage,
                  filteredLeads.length
                )} of ${filteredLeads.length} results`
              : 'Showing 0 results'}
          </span>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              Per page:
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-[#080d1a] border border-slate-700 rounded px-2 py-1 text-white text-[13px] focus:outline-none focus:ring-1 focus:ring-[#09929e]"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* IMPORT LEADS MODAL matching Screenshot 3                     */}
      {/* ------------------------------------------------------------- */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#101728] border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-700/70 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Import leads</h3>
              <button
                onClick={() => {
                  setImportModalOpen(false);
                  setImportFile(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Download CSV Example Link */}
              <button
                type="button"
                onClick={handleDownloadExampleCSV}
                className="text-[13px] text-[#09929e] hover:underline block font-medium cursor-pointer"
              >
                Download example CSV file
              </button>

              {/* Drag & Drop File Area matching Screenshot 3 */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setImportFile(e.target.files[0]);
                  }
                }}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border border-slate-700/80 bg-[#080d1a] hover:bg-[#0c1424] hover:border-[#09929e] transition rounded-xl p-10 text-center cursor-pointer group"
              >
                <FileSpreadsheet className="w-8 h-8 text-slate-400 group-hover:text-[#09929e] mx-auto mb-2 transition" />
                <span className="text-sm text-slate-300 font-medium block">
                  {importFile ? importFile.name : 'Upload a CSV file'}
                </span>
                {importFile && (
                  <span className="text-xs text-emerald-400 mt-1 block">
                    {(importFile.size / 1024).toFixed(1)} KB selected
                  </span>
                )}
              </div>
            </div>

            {/* Modal Footer Buttons matching Screenshot 3 */}
            <div className="px-6 py-4 bg-[#0b1322] border-t border-slate-800 flex items-center gap-3">
              <button
                type="button"
                disabled={isImporting || !importFile}
                onClick={handleImportCSV}
                className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white text-[13px] font-semibold rounded-lg shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isImporting ? 'Importing…' : 'Import'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportModalOpen(false);
                  setImportFile(null);
                }}
                className="px-4 py-2 bg-[#101728] hover:bg-slate-800 text-white text-[13px] font-semibold rounded-lg border border-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW LEAD MODAL                                               */}
      {/* ------------------------------------------------------------- */}
      {viewingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#101728] border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-700/70 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Lead Details</h3>
                <p className="text-xs text-slate-400">{viewingLead.name}</p>
              </div>
              <button
                onClick={() => setViewingLead(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3 text-[13px]">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-[#080d1a] p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Phone</span>
                  <span className="text-white font-medium">{viewingLead.phone || '—'}</span>
                </div>
                <div className="bg-[#080d1a] p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Email</span>
                  <span className="text-white font-medium">{viewingLead.email || '—'}</span>
                </div>
                <div className="bg-[#080d1a] p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">WhatsApp</span>
                  <span className="text-white font-medium">
                    {viewingLead.whats_number || viewingLead.phone || '—'}
                  </span>
                </div>
                <div className="bg-[#080d1a] p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Place</span>
                  <span className="text-white font-medium">{viewingLead.place || '—'}</span>
                </div>
                <div className="bg-[#080d1a] p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Age</span>
                  <span className="text-white font-medium">{viewingLead.age || '—'}</span>
                </div>
                <div className="bg-[#080d1a] p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Qualification</span>
                  <span className="text-white font-medium">{viewingLead.qualification || '—'}</span>
                </div>
                <div className="bg-[#080d1a] p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">College / Institute</span>
                  <span className="text-white font-medium">{viewingLead.college_name || '—'}</span>
                </div>
                <div className="bg-[#080d1a] p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Current Year</span>
                  <span className="text-white font-medium">{viewingLead.current_year || '—'}</span>
                </div>
                <div className="bg-[#080d1a] p-3 rounded-lg border border-slate-800 col-span-2">
                  <span className="text-slate-400 block mb-0.5">Interested Topic</span>
                  <span className="text-white font-medium">{viewingLead.interested_topic || '—'}</span>
                </div>
                <div className="bg-[#080d1a] p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">District</span>
                  <span className="text-white font-medium">{viewingLead.district || '—'}</span>
                </div>
                <div className="bg-[#080d1a] p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Course</span>
                  <span className="text-white font-medium">{viewingLead.course || '—'}</span>
                </div>
                <div className="bg-[#080d1a] p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Lead Source</span>
                  <span className="text-white font-medium">{viewingLead.source || '—'}</span>
                </div>
                <div className="bg-[#080d1a] p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Lead Status</span>
                  <span className="text-emerald-400 font-medium">{String(viewingLead.status || 'New')}</span>
                </div>
                <div className="bg-[#080d1a] p-3 rounded-lg border border-slate-800 col-span-2">
                  <span className="text-slate-400 block mb-0.5">Assigned Employee</span>
                  <span className="text-white font-medium">{viewingLead.employee || '—'}</span>
                </div>
                {viewingLead.notes && (
                  <div className="bg-[#080d1a] p-3 rounded-lg border border-slate-800 col-span-2">
                    <span className="text-slate-400 block mb-0.5">Notes</span>
                    <span className="text-slate-300">{viewingLead.notes}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-3.5 bg-[#0b1322] border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setViewingLead(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* EDIT LEAD MODAL                                               */}
      {/* ------------------------------------------------------------- */}
      {editingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#101728] border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-700/70 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Edit Lead</h3>
              <button
                onClick={() => setEditingLead(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateLead} className="p-6 space-y-4 text-[13px]">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingLead.name || ''}
                  onChange={(e) => setEditingLead({ ...editingLead, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] focus:ring-1 focus:ring-[#09929e]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Phone</label>
                  <input
                    type="text"
                    value={editingLead.phone || ''}
                    onChange={(e) => setEditingLead({ ...editingLead, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] focus:ring-1 focus:ring-[#09929e]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={editingLead.email || ''}
                    onChange={(e) => setEditingLead({ ...editingLead, email: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] focus:ring-1 focus:ring-[#09929e]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">WhatsApp Number</label>
                  <input
                    type="text"
                    value={editingLead.whats_number || ''}
                    onChange={(e) => setEditingLead({ ...editingLead, whats_number: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] focus:ring-1 focus:ring-[#09929e]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Place</label>
                  <input
                    type="text"
                    value={editingLead.place || ''}
                    onChange={(e) => setEditingLead({ ...editingLead, place: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] focus:ring-1 focus:ring-[#09929e]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Age</label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={editingLead.age ?? ''}
                    onChange={(e) => setEditingLead({ ...editingLead, age: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] focus:ring-1 focus:ring-[#09929e]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Qualification</label>
                  <input
                    type="text"
                    value={editingLead.qualification || ''}
                    onChange={(e) => setEditingLead({ ...editingLead, qualification: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] focus:ring-1 focus:ring-[#09929e]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">College / Institute Name</label>
                  <input
                    type="text"
                    value={editingLead.college_name || ''}
                    onChange={(e) => setEditingLead({ ...editingLead, college_name: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] focus:ring-1 focus:ring-[#09929e]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Current Year</label>
                  <input
                    type="text"
                    value={editingLead.current_year || ''}
                    onChange={(e) => setEditingLead({ ...editingLead, current_year: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] focus:ring-1 focus:ring-[#09929e]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Interested Topic</label>
                <input
                  type="text"
                  value={editingLead.interested_topic || ''}
                  onChange={(e) => setEditingLead({ ...editingLead, interested_topic: e.target.value })}
                  className="w-full px-3 py-2 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] focus:ring-1 focus:ring-[#09929e]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">District</label>
                  <select
                    value={editingLead.district || ''}
                    onChange={(e) => setEditingLead({ ...editingLead, district: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] focus:ring-1 focus:ring-[#09929e]"
                  >
                    <option value="">Select district</option>
                    {districts.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Course</label>
                  <select
                    value={editingLead.course || ''}
                    onChange={(e) => setEditingLead({ ...editingLead, course: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] focus:ring-1 focus:ring-[#09929e]"
                  >
                    <option value="">Select course</option>
                    {courses.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Lead Source</label>
                  <select
                    value={editingLead.source || ''}
                    onChange={(e) => setEditingLead({ ...editingLead, source: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] focus:ring-1 focus:ring-[#09929e]"
                  >
                    {DEFAULT_SOURCES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Lead Status</label>
                  <select
                    value={String(editingLead.status || 'New')}
                    onChange={(e) => setEditingLead({ ...editingLead, status: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] focus:ring-1 focus:ring-[#09929e]"
                  >
                    {DEFAULT_STATUSES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Assigned Employee</label>
                <select
                  value={editingLead.employee || ''}
                  onChange={(e) => setEditingLead({ ...editingLead, employee: e.target.value })}
                  className="w-full px-3 py-2 bg-[#080d1a] border border-slate-700 rounded-lg text-white text-[13px] focus:ring-1 focus:ring-[#09929e]"
                >
                  <option value="">Select employee</option>
                  {employees.map((emp) => (
                    <option key={emp.name} value={emp.name}>
                      {emp.employee_id ? `${emp.name} (${emp.employee_id})` : emp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingLead(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-[#09929e] hover:bg-[#08818c] text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
