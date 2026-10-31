'use client';

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  Award,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  Search,
  RefreshCw,
  FileCheck,
  Building2,
  Users,
} from 'lucide-react';
import { authHeaders } from '../../services/api';

interface AccountsViewProps {
  showToast?: (type: 'success' | 'danger', message: string) => void;
}

export default function AccountsView({ showToast }: AccountsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<
    'salaries' | 'withdrawals' | 'admissions'
  >('salaries');

  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Data states
  const [salaryRequests, setSalaryRequests] = useState<any[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [incentives, setIncentives] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);

  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState<boolean>(false);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [paymentType, setPaymentType] = useState<'salary' | 'withdrawal'>('salary');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Load all accounts data
  const loadData = async () => {
    try {
      setLoading(true);
      const [salRes, withRes, incRes, leadsRes] = await Promise.all([
        fetch('/api/salary/requests', { headers: authHeaders() }),
        fetch('/api/admin/wallet-withdraw-requests', { headers: authHeaders() }),
        fetch('/api/incentives', { headers: authHeaders() }),
        fetch('/api/admin/leads', { headers: authHeaders() }),
      ]);

      const [salJson, withJson, incJson, leadsJson] = await Promise.all([
        salRes.json(),
        withRes.json(),
        incRes.json(),
        leadsRes.json(),
      ]);

      if (salJson.success && Array.isArray(salJson.data)) {
        setSalaryRequests(salJson.data);
      }
      if (withJson.success && Array.isArray(withJson.data)) {
        setWithdrawalRequests(withJson.data);
      }
      if (incJson.success && Array.isArray(incJson.data)) {
        setIncentives(incJson.data);
      }
      if (leadsJson.success && Array.isArray(leadsJson.data)) {
        setLeads(leadsJson.data);
      }
    } catch (err) {
      console.error('Failed to load accounts data:', err);
      showToast?.('danger', 'Failed to load accounts data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Financial Calculations
  const closedAdmissions = leads.filter(
    (l) =>
      l.admission_status === 'Admitted' ||
      l.admission_status === 'Closed' ||
      l.status === 4 ||
      l.status === 5
  );

  const totalAdmissionsCount = closedAdmissions.length;

  // Total Income: sum of payment_amount (or average ₹25,000 per admission if payment_amount is 0)
  const totalIncome = closedAdmissions.reduce((acc, lead) => {
    const amount = Number(lead.payment_amount || lead.payment || 0);
    return acc + (amount > 0 ? amount : 25000);
  }, 0);

  // Total Incentives (₹1,000 earned per closed admission)
  const totalIncentivesEarned = totalAdmissionsCount * 1000;
  const totalIncentivesPaid = withdrawalRequests
    .filter((w) => w.status === 'Paid')
    .reduce((acc, w) => acc + (Number(w.amount) || 0), 0);

  // Total Salaries: sum of approved/paid salary requests
  const totalSalaryExpenses = salaryRequests
    .filter((s) => s.status === 'Paid' || s.status === 'Approved')
    .reduce((acc, s) => acc + (Number(s.amount) || 5000), 0);

  // Total Expenses = Total Incentives Paid (or earned) + Total Salary Expenses
  const totalExpenses = totalIncentivesEarned + totalSalaryExpenses;

  // Formula as required: Total Admissions × Income – (Incentives + Salaries)
  const totalProfit = Math.max(0, totalIncome - totalExpenses);

  // Handle Workflow Action (Approve / Forward / Sanction / Reject)
  const handleWorkflowAction = async (
    type: 'salary' | 'withdrawal',
    item: any,
    action: string,
    remarks: string = ''
  ) => {
    try {
      setActionLoading(true);
      const endpoint =
        type === 'salary' ? '/api/salary/workflow' : '/api/wallet/workflow';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          id: item._id || item.id,
          request_id: item.request_id,
          action,
          remarks: remarks || `Accounts operation: ${action}`,
        }),
      });

      const json = await res.json();
      if (json.success) {
        showToast?.('success', json.message || `Request updated successfully`);
        loadData();
      } else {
        showToast?.('danger', json.message || 'Action failed');
      }
    } catch (err) {
      console.error('Workflow error:', err);
      showToast?.('danger', 'Failed to update workflow');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Payment Modal
  const openPayModal = (type: 'salary' | 'withdrawal', item: any) => {
    setSelectedRequest(item);
    setPaymentType(type);
    setTransactionRef(`TXN-${Date.now().toString().slice(-6)}`);
    setPaymentModalOpen(true);
  };

  // Confirm Mark as Paid
  const handleConfirmPayment = async () => {
    if (!selectedRequest) return;
    try {
      setActionLoading(true);
      const endpoint =
        paymentType === 'salary'
          ? '/api/salary/workflow'
          : '/api/wallet/workflow';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          id: selectedRequest._id || selectedRequest.id,
          request_id: selectedRequest.request_id,
          action: 'pay',
          remarks: 'Payment sanctioned and completed by Accounts Department',
          transaction_reference: transactionRef,
        }),
      });

      const json = await res.json();
      if (json.success) {
        showToast?.(
          'success',
          `Payment of ₹${selectedRequest.amount} marked as Paid (Ref: ${transactionRef})`
        );
        setPaymentModalOpen(false);
        setSelectedRequest(null);
        loadData();
      } else {
        showToast?.('danger', json.message || 'Payment update failed');
      }
    } catch (err) {
      console.error('Payment error:', err);
      showToast?.('danger', 'Failed to process payment');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered lists
  const filteredSalaries = salaryRequests.filter((item) => {
    if (statusFilter !== 'all' && item.status?.toLowerCase() !== statusFilter.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.employee_name?.toLowerCase().includes(q) ||
        item.employee_id?.toLowerCase().includes(q) ||
        item.team?.toLowerCase().includes(q) ||
        item.request_id?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredWithdrawals = withdrawalRequests.filter((item) => {
    if (statusFilter !== 'all' && item.status?.toLowerCase() !== statusFilter.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name?.toLowerCase().includes(q) ||
        item.employee?.toLowerCase().includes(q) ||
        item.employee_id?.toLowerCase().includes(q) ||
        item.request_id?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredAdmissions = closedAdmissions.filter((item) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name?.toLowerCase().includes(q) ||
        item.student_id?.toLowerCase().includes(q) ||
        item.lead_id?.toLowerCase().includes(q) ||
        item.course?.toLowerCase().includes(q) ||
        item.employee?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#09929e]" />
            <span>Accounts & Financial Operations</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Kerala Institute of Digital Education — Approval Workflows, Incentive Payouts & Profit Analytics
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:text-white border border-slate-700 text-xs font-medium cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#09929e]' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 1. FINANCIAL KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Admissions */}
        <div className="p-4 rounded-xl bg-[#0f172a] border border-slate-800 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Admissions
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">{totalAdmissionsCount}</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="text-[10px] text-emerald-400 mt-1">Closed Leads</span>
        </div>

        {/* Total Income */}
        <div className="p-4 rounded-xl bg-[#0f172a] border border-slate-800 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Income
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-emerald-400">
              ₹{totalIncome.toLocaleString('en-IN')}
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-[10px] text-slate-400 mt-1">Course Admissions</span>
        </div>

        {/* Total Incentives */}
        <div className="p-4 rounded-xl bg-[#0f172a] border border-slate-800 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Incentives (₹1k)
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-amber-400">
              ₹{totalIncentivesEarned.toLocaleString('en-IN')}
            </span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-[10px] text-slate-400 mt-1">
            Paid: ₹{totalIncentivesPaid.toLocaleString('en-IN')}
          </span>
        </div>

        {/* Salary Expenses */}
        <div className="p-4 rounded-xl bg-[#0f172a] border border-slate-800 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Salaries (₹5k+)
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-indigo-400">
              ₹{totalSalaryExpenses.toLocaleString('en-IN')}
            </span>
            <CreditCard className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-[10px] text-slate-400 mt-1">Approved/Paid</span>
        </div>

        {/* Total Expenses */}
        <div className="p-4 rounded-xl bg-[#0f172a] border border-slate-800 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Expenses
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-red-400">
              ₹{totalExpenses.toLocaleString('en-IN')}
            </span>
            <DollarSign className="w-4 h-4 text-red-400" />
          </div>
          <span className="text-[10px] text-slate-400 mt-1">Salaries + Incentives</span>
        </div>

        {/* Net Profit */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-800/50 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
            Total Profit
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-emerald-300">
              ₹{totalProfit.toLocaleString('en-IN')}
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-[10px] text-emerald-400/80 mt-1">Income – Expenses</span>
        </div>
      </div>

      {/* 2. SUB-NAVIGATION TABS */}
      <div className="flex border-b border-slate-800 gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveSubTab('salaries')}
          className={`pb-3 px-1 border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'salaries'
              ? 'border-[#09929e] text-[#38bdf8]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Salary Requests (BDE → ASM → SM → Accounts)</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
            {salaryRequests.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('withdrawals')}
          className={`pb-3 px-1 border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'withdrawals'
              ? 'border-[#09929e] text-[#38bdf8]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Incentive Withdrawals (Max ₹5k)</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
            {withdrawalRequests.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('admissions')}
          className={`pb-3 px-1 border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'admissions'
              ? 'border-[#09929e] text-[#38bdf8]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Closed Admissions & Incentives (₹1,000/close)</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
            {closedAdmissions.length}
          </span>
        </button>
      </div>

      {/* Filters & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, employee ID, request ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0d1424] border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#09929e]"
          />
        </div>

        {activeSubTab !== 'admissions' && (
          <div className="flex items-center gap-2 self-end">
            <span className="text-xs text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#0d1424] border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-[#09929e]"
            >
              <option value="all">All Statuses</option>
              <option value="Submitted to ASM">Submitted to ASM</option>
              <option value="Forwarded to SM">Forwarded to SM</option>
              <option value="Forwarded to Accounts">Forwarded to Accounts</option>
              <option value="Approved">Approved / Sanctioned</option>
              <option value="Paid">Paid</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        )}
      </div>

      {/* 3. TAB CONTENT */}

      {/* SUB-TAB 1: SALARY REQUESTS */}
      {activeSubTab === 'salaries' && (
        <div className="bg-[#0c1220] border border-slate-800/80 rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#11192e] text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Team & ASM</th>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Workflow Status</th>
                  <th className="py-3 px-4 text-right">Accounts Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredSalaries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No salary requests found.
                    </td>
                  </tr>
                ) : (
                  filteredSalaries.map((req) => (
                    <tr key={req._id || req.request_id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                        {req.request_id}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-white font-semibold">{req.employee_name}</div>
                        <div className="text-[10px] text-slate-400">{req.employee_id} • {req.designation}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div>{req.team || 'Regional Team'}</div>
                        <div className="text-[10px] text-slate-400">ASM: {req.asm_name || req.asm_id || '—'}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {req.period}
                      </td>
                      <td className="py-3 px-4 font-bold text-white">
                        ₹{(req.amount || 5000).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            req.status === 'Paid'
                              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60'
                              : req.status === 'Approved'
                                ? 'bg-cyan-950/40 text-cyan-400 border-cyan-800/60'
                                : req.status === 'Rejected'
                                  ? 'bg-red-950/40 text-red-400 border-red-800/60'
                                  : req.status === 'Forwarded to Accounts'
                                    ? 'bg-amber-950/40 text-amber-400 border-amber-800/60'
                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>{req.status}</span>
                        </span>
                        {req.transaction_reference && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Ref: {req.transaction_reference}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {req.status === 'Forwarded to Accounts' && (
                          <>
                            <button
                              onClick={() => handleWorkflowAction('salary', req, 'sanction')}
                              disabled={actionLoading}
                              className="px-2.5 py-1 rounded bg-cyan-700 hover:bg-cyan-600 text-white text-[11px] font-semibold cursor-pointer"
                            >
                              Sanction
                            </button>
                            <button
                              onClick={() => handleWorkflowAction('salary', req, 'reject')}
                              disabled={actionLoading}
                              className="px-2 py-1 rounded bg-red-900/60 hover:bg-red-800 text-red-200 text-[11px] cursor-pointer"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {req.status === 'Approved' && (
                          <button
                            onClick={() => openPayModal('salary', req)}
                            disabled={actionLoading}
                            className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold cursor-pointer"
                          >
                            Mark Paid
                          </button>
                        )}
                        {req.status === 'Submitted to ASM' && (
                          <button
                            onClick={() => handleWorkflowAction('salary', req, 'forward_to_sm')}
                            disabled={actionLoading}
                            title="Forward as ASM"
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
                          >
                            ASM Fwd →
                          </button>
                        )}
                        {req.status === 'Forwarded to SM' && (
                          <button
                            onClick={() => handleWorkflowAction('salary', req, 'forward_to_accounts')}
                            disabled={actionLoading}
                            title="Forward as SM"
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
                          >
                            SM Fwd →
                          </button>
                        )}
                        {req.status === 'Paid' && (
                          <span className="text-emerald-400 text-xs font-semibold">
                            ✓ Disbursed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: INCENTIVE WITHDRAWAL REQUESTS */}
      {activeSubTab === 'withdrawals' && (
        <div className="bg-[#0c1220] border border-slate-800/80 rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#11192e] text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Team</th>
                  <th className="py-3 px-4">Withdraw Amount</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Workflow Status</th>
                  <th className="py-3 px-4 text-right">Accounts Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredWithdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No incentive withdrawal requests found.
                    </td>
                  </tr>
                ) : (
                  filteredWithdrawals.map((item) => (
                    <tr key={item._id || item.request_id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono font-bold text-amber-400">
                        {item.request_id || `WDR-${item.id || 1001}`}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-white font-semibold">{item.name || item.employee}</div>
                        <div className="text-[10px] text-slate-400">{item.employee_id || 'BDE'}</div>
                      </td>
                      <td className="py-3 px-4">
                        {item.team || 'Regional Team'}
                      </td>
                      <td className="py-3 px-4 font-bold text-white">
                        ₹{(Number(item.amount) || 0).toLocaleString('en-IN')}
                        <span className="block text-[10px] font-normal text-slate-400">
                          (Max limit: ₹5k)
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {item.upi_id ? (
                          <div>
                            <span className="text-[10px] text-cyan-400 font-bold">UPI:</span>{' '}
                            <span className="font-mono text-[11px] text-slate-200">{item.upi_id}</span>
                          </div>
                        ) : item.account_number ? (
                          <div>
                            <span className="text-[10px] text-slate-400">{item.bank_name || 'Bank'}:</span>{' '}
                            <span className="font-mono text-[11px] text-slate-200">{item.account_number}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">Direct transfer</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            item.status === 'Paid'
                              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60'
                              : item.status === 'Approved'
                                ? 'bg-cyan-950/40 text-cyan-400 border-cyan-800/60'
                                : item.status === 'Rejected'
                                  ? 'bg-red-950/40 text-red-400 border-red-800/60'
                                  : item.status === 'Forwarded to Accounts'
                                    ? 'bg-amber-950/40 text-amber-400 border-amber-800/60'
                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>{item.status || 'Submitted to ASM'}</span>
                        </span>
                        {item.transaction_reference && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Ref: {item.transaction_reference}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {item.status === 'Forwarded to Accounts' && (
                          <>
                            <button
                              onClick={() => handleWorkflowAction('withdrawal', item, 'sanction')}
                              disabled={actionLoading}
                              className="px-2.5 py-1 rounded bg-cyan-700 hover:bg-cyan-600 text-white text-[11px] font-semibold cursor-pointer"
                            >
                              Sanction
                            </button>
                            <button
                              onClick={() => handleWorkflowAction('withdrawal', item, 'reject')}
                              disabled={actionLoading}
                              className="px-2 py-1 rounded bg-red-900/60 hover:bg-red-800 text-red-200 text-[11px] cursor-pointer"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {item.status === 'Approved' && (
                          <button
                            onClick={() => openPayModal('withdrawal', item)}
                            disabled={actionLoading}
                            className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold cursor-pointer"
                          >
                            Mark Paid
                          </button>
                        )}
                        {(item.status === 'Submitted to ASM' || !item.status) && (
                          <button
                            onClick={() => handleWorkflowAction('withdrawal', item, 'forward_to_sm')}
                            disabled={actionLoading}
                            title="Forward as ASM"
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
                          >
                            ASM Fwd →
                          </button>
                        )}
                        {item.status === 'Forwarded to SM' && (
                          <button
                            onClick={() => handleWorkflowAction('withdrawal', item, 'forward_to_accounts')}
                            disabled={actionLoading}
                            title="Forward as SM"
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
                          >
                            SM Fwd →
                          </button>
                        )}
                        {item.status === 'Paid' && (
                          <span className="text-emerald-400 text-xs font-semibold">
                            ✓ Paid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: CLOSED ADMISSIONS & INCENTIVES */}
      {activeSubTab === 'admissions' && (
        <div className="bg-[#0c1220] border border-slate-800/80 rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#11192e] text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Student ID</th>
                  <th className="py-3 px-4">Lead ID</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Selected Course</th>
                  <th className="py-3 px-4">BDE & Team</th>
                  <th className="py-3 px-4">Payment Verification</th>
                  <th className="py-3 px-4 text-right">Incentive</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredAdmissions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No closed admissions yet.
                    </td>
                  </tr>
                ) : (
                  filteredAdmissions.map((adm) => (
                    <tr key={adm._id || adm.lead_id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        {adm.student_id || 'STU-001'}
                      </td>
                      <td className="py-3 px-4 font-mono text-cyan-400">
                        {adm.lead_id}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">
                        {adm.name}
                        <div className="text-[10px] text-slate-400">{adm.phone || adm.contact_number}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-200">
                        {adm.course || adm.interested_course || 'Flutter'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-white">{adm.employee || 'BDE'}</div>
                        <div className="text-[10px] text-slate-400">{adm.team || adm.district}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            adm.payment_verification === 'Verified'
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                              : 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                          }`}
                        >
                          <CheckCircle className="w-2.5 h-2.5" />
                          <span>{adm.payment_verification || 'Verified'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-extrabold text-amber-400">
                          +₹1,000
                        </span>
                        <div className="text-[10px] text-emerald-400">Credited to BDE</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PAYMENT TRANSACTION MODAL */}
      {paymentModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#11192e] border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span>Sanction & Complete Payment</span>
              </h3>
              <button
                onClick={() => setPaymentModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 bg-slate-900/80 rounded-lg space-y-1">
                <div>
                  <span className="text-slate-400">Recipient:</span>{' '}
                  <strong className="text-white">
                    {selectedRequest.employee_name || selectedRequest.name}
                  </strong>{' '}
                  ({selectedRequest.employee_id})
                </div>
                <div>
                  <span className="text-slate-400">Amount to Disburse:</span>{' '}
                  <strong className="text-emerald-400 text-sm">
                    ₹{Number(selectedRequest.amount).toLocaleString('en-IN')}
                  </strong>
                </div>
                {selectedRequest.upi_id && (
                  <div>
                    <span className="text-slate-400">UPI ID:</span>{' '}
                    <span className="font-mono text-cyan-400">{selectedRequest.upi_id}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Bank / UPI Transaction Reference (UTR / IMPS / Txn ID) *
                </label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="e.g. UTR1234567890"
                  className="w-full bg-[#0b101d] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setPaymentModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={actionLoading || !transactionRef.trim()}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading ? 'Processing...' : 'Confirm & Disburse'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
