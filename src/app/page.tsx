'use client';

import { LoginButton } from '@/components/LoginButton';
import { SuperAdminOnly, AdminOrSuperAdmin, LoggedInUser } from '@/components/PermissionGate';
import { useAuth } from '@/contexts/AuthContext';
import { DollarSign, BarChart3, FileText, Plus, Users, Shield, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { FinancialRecord } from '@/lib/googleSheets';

// Main Home Component
export default function Home() {
  const { user, userProfile, loading, error } = useAuth();
  const [financialData, setFinancialData] = useState<FinancialRecord[]>([]);
  const [stats, setStats] = useState({
    monthlyIncome: 0,
    monthlyExpense: 0,
    monthlyBalance: 0,
    totalIncome: 0,
    totalExpense: 0,
    totalBalance: 0,
    cashInHand: 0,
  });
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // 获取财务数据
  useEffect(() => {
    if (user) {
      fetchFinancialData();
      fetchCashInHand();
    }
  }, [user]);

  // 计算统计数据
  useEffect(() => {
    if (financialData.length > 0) {
      calculateStats();
    }
  }, [financialData]);

  const fetchFinancialData = async () => {
    setDataLoading(true);
    setDataError(null);
    try {
      const response = await fetch('/api/sheets/read');
      if (response.ok) {
        const data = await response.json();
        setFinancialData(data.records || []);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to fetch financial data:', error);
      setDataError('Failed to load financial data. Please try again later.');
    } finally {
      setDataLoading(false);
    }
  };

  const fetchCashInHand = async () => {
    try {
      const response = await fetch('/api/sheets/cash-in-hand');
      if (response.ok) {
        const data = await response.json();
        setStats(prev => ({
          ...prev,
          cashInHand: data.cashInHand || 0,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch cash in hand:', error);
    }
  };

  const calculateStats = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // 过滤本月数据
    const monthlyRecords = financialData.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
    });

    // 计算本月统计
    const monthlyIncome = monthlyRecords
      .filter(r => r.type === 'Income')
      .reduce((sum, r) => sum + r.amount, 0);
    
    const monthlyExpense = monthlyRecords
      .filter(r => r.type === 'Expense')
      .reduce((sum, r) => sum + r.amount, 0);
    
    const monthlyBalance = monthlyIncome - monthlyExpense;

    // 计算总统计
    const totalIncome = financialData
      .filter(r => r.type === 'Income')
      .reduce((sum, r) => sum + r.amount, 0);
    
    const totalExpense = financialData
      .filter(r => r.type === 'Expense')
      .reduce((sum, r) => sum + r.amount, 0);
    
    const totalBalance = totalIncome - totalExpense;

    setStats(prev => ({
      monthlyIncome,
      monthlyExpense,
      monthlyBalance,
      cashInHand: prev.cashInHand, // Keep cash in hand unchanged, as it comes from a separate API
      totalIncome,
      totalExpense,
      totalBalance,
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
        <div className="max-w-md w-full mx-auto p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-red-900 mb-2">Connection Error</h1>
            <p className="text-red-600 mb-4">There was a problem connecting to Firebase</p>
            <div className="bg-red-100 border border-red-300 rounded-md p-4 text-left">
              <p className="text-sm text-red-800 font-mono">{error}</p>
            </div>
          </div>
          <div className="flex justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="max-w-md w-full mx-auto p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">PACMC Youth Fellowship</h1>
            <h2 className="text-xl text-gray-600 mb-6">Financial Management System</h2>
            <p className="text-gray-500">Please login to access financial management features</p>
          </div>
          <div className="flex justify-center">
            <LoginButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
                <span className="hidden sm:inline">PACMC Financial Management System</span>
                <span className="sm:hidden">PACMC Finance</span>
              </h1>
            </div>
            <LoginButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome back, {userProfile?.name}!</h2>
          <p className="text-gray-600 mb-1">Email: {userProfile?.email}</p>
          <p className="text-gray-600">
            Your role: <span className="font-semibold">{userProfile?.role}</span>
          </p>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Financial Records */}
          <LoggedInUser>
            <Link href="/financial-list" className="block h-full">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-300 hover:shadow-md transition-shadow cursor-pointer h-full">
                <div className="flex items-center mb-4">
                  <FileText className="h-6 w-6 text-blue-600 mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">Financial Records</h3>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  View all income and expense records, and manage them based on permissions
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    All users can view
                  </span>
                </div>
              </div>
            </Link>
          </LoggedInUser>

          {/* Chart Analysis */}
          <LoggedInUser>
            <Link href="/dashboard" className="block h-full">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-300 hover:shadow-md transition-shadow cursor-pointer h-full">
                <div className="flex items-center mb-4">
                  <BarChart3 className="h-6 w-6 text-green-600 mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">Chart Analysis</h3>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  View financial trends and category statistics
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                    All users can view
                  </span>
                </div>
              </div>
            </Link>
          </LoggedInUser>

          {/* Add Record */}
          <AdminOrSuperAdmin>
            <Link href="/add-record" className="block h-full">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-300 hover:shadow-md transition-shadow cursor-pointer h-full">
                <div className="flex items-center mb-4">
                  <Plus className="h-6 w-6 text-purple-600 mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">Add Record</h3>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  Add new income or expense records
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                    Admin and above
                  </span>
                </div>
              </div>
            </Link>
          </AdminOrSuperAdmin>

          {/* User Management */}
          <SuperAdminOnly>
            <Link href="/admin/users" className="block h-full">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-300 hover:shadow-md transition-shadow cursor-pointer h-full">
                <div className="flex items-center mb-4">
                  <Users className="h-6 w-6 text-orange-600 mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">User Management</h3>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  Manage user permissions and roles
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded">
                    Super Admin only
                  </span>
                </div>
              </div>
            </Link>
          </SuperAdminOnly>

          {/* Report Export */}
          <LoggedInUser>
            <Link href="/export" className="block h-full">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-300 hover:shadow-md transition-shadow cursor-pointer h-full">
                <div className="flex items-center mb-4">
                  <Shield className="h-6 w-6 text-red-600 mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">Report Export</h3>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  Export PDF and Excel reports
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span className="bg-red-100 text-red-800 px-2 py-1 rounded">
                    All users can view
                  </span>
                </div>
              </div>
            </Link>
          </LoggedInUser>
        </div>

        {/* Quick Stats */}
        <LoggedInUser>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Quick Statistics</h3>
              {dataLoading && (
                <div className="flex items-center text-sm text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  Updating...
                </div>
              )}
            </div>
            
            {dataError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center">
                  <svg className="h-4 w-4 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span className="text-sm text-red-700">{dataError}</span>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-bold text-green-600 truncate">RM{stats.monthlyIncome.toFixed(2)}</div>
                <div className="text-xs sm:text-sm text-gray-600 truncate">Monthly Income</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-bold text-red-600 truncate">RM{stats.monthlyExpense.toFixed(2)}</div>
                <div className="text-xs sm:text-sm text-gray-600 truncate">Monthly Expense</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-bold text-blue-600 truncate">RM{stats.monthlyBalance.toFixed(2)}</div>
                <div className="text-xs sm:text-sm text-gray-600 truncate">Monthly Balance</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-bold text-yellow-600 truncate">RM{stats.cashInHand.toFixed(2)}</div>
                <div className="text-xs sm:text-sm text-gray-600 truncate">Cash in Hand</div>
              </div>
            </div>
            
            {/* Total Statistics */}
            <div className="mt-6 pt-6 border-t border-gray-300">
              <h4 className="text-md font-medium text-gray-700 mb-3">Overall Statistics</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-xs sm:text-base lg:text-lg font-bold text-green-600 truncate">RM{stats.totalIncome.toFixed(2)}</div>
                  <div className="text-xs text-gray-600 truncate">Total Income</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="text-xs sm:text-base lg:text-lg font-bold text-red-600 truncate">RM{stats.totalExpense.toFixed(2)}</div>
                  <div className="text-xs text-gray-600 truncate">Total Expense</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-xs sm:text-base lg:text-lg font-bold text-blue-600 truncate">RM{stats.totalBalance.toFixed(2)}</div>
                  <div className="text-xs text-gray-600 truncate">Total Balance</div>
                </div>
              </div>
            </div>
          </div>
        </LoggedInUser>
      </main>
    </div>
  );
} 