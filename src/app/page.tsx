'use client';

import { LoginForm } from '@/components/LoginForm';
import { SuperAdminOnly, AdminOrSuperAdmin, LoggedInUser } from '@/components/PermissionGate';
import { useAuth } from '@/contexts/AuthContext';
import { DollarSign, BarChart3, FileText, Plus, Users, Shield, Wallet, Bell } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { FinancialRecord } from '@/lib/googleSheets';
import NotificationBell from '@/components/NotificationBell';

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
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  // 获取所有年份
  const allYears = Array.from(new Set(financialData.map(r => new Date(r.date).getFullYear()))).sort((a, b) => b - a);
  // 计算所选年份的统计
  const yearRecords = financialData.filter(r => new Date(r.date).getFullYear() === selectedYear);
  const yearIncome = yearRecords.filter(r => r.type === 'Income').reduce((sum, r) => sum + r.amount, 0);
  const yearExpense = yearRecords.filter(r => r.type === 'Expense').reduce((sum, r) => sum + r.amount, 0);
  const yearBalance = yearIncome - yearExpense;

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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 relative overflow-hidden dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob dark:bg-blue-900 dark:opacity-30"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000 dark:bg-purple-900 dark:opacity-30"></div>
          <div className="absolute top-40 left-40 w-80 h-80 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000 dark:bg-indigo-900 dark:opacity-30"></div>
        </div>

        {/* Main content */}
        <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            {/* Logo and Title Section */}
            <div className="text-center mb-8">
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <img
                    src="/pacmc.jpg"
                    alt="PACMC Logo"
                    className="h-20 w-20 rounded-full object-cover shadow-lg border-4 border-white dark:border-slate-700"
                  />
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-white dark:border-slate-700 flex items-center justify-center">
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                  </div>
                </div>
              </div>
              
              <h1 className="text-4xl font-bold text-gray-900 mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-purple-400">
                PACMC Youth Fellowship
              </h1>
              <h2 className="text-xl text-gray-600 mb-2 font-medium dark:text-slate-300">
                Financial Management System
              </h2>
              <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full mb-6"></div>
              
              <p className="text-gray-500 mb-8 leading-relaxed dark:text-slate-400">
                Secure, efficient, and transparent financial management for our community
              </p>
            </div>

            {/* Login Card */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8 dark:bg-slate-800/80 dark:border-slate-600/20">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2 dark:text-slate-100">Welcome Back</h3>
                <p className="text-gray-600 text-sm dark:text-slate-400">Please login to access financial management features</p>
              </div>
              
              <div className="space-y-4">
                <LoginForm />
                
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    By logging in, you agree to our terms of service and privacy policy
                  </p>
                </div>
              </div>
            </div>

            {/* Features Preview */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 text-center border border-white/20 dark:bg-slate-800/60 dark:border-slate-600/20">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 dark:bg-blue-900">
                  <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h4 className="text-sm font-semibold text-gray-900 mb-1 dark:text-slate-100">Financial Tracking</h4>
                <div className="text-xs font-normal text-gray-500 mt-0.5">Monitor income and expenses</div>
              </div>
              
              <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 text-center border border-white/20 dark:bg-slate-800/60 dark:border-slate-600/20">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 dark:bg-green-900">
                  <BarChart3 className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h4 className="text-sm font-semibold text-gray-900 mb-1 dark:text-slate-100">Reports & Analytics</h4>
                <div className="text-xs font-normal text-gray-500 mt-0.5">Generate detailed reports</div>
              </div>
              
              <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 text-center border border-white/20 dark:bg-slate-800/60 dark:border-slate-600/20">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3 dark:bg-purple-900">
                  <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h4 className="text-sm font-semibold text-gray-900 mb-1 dark:text-slate-100">Secure Access</h4>
                <div className="text-xs font-normal text-gray-500 mt-0.5">Role-based permissions</div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center">
              <p className="text-xs text-gray-500 dark:text-slate-400">
                © 2024 PACMC Youth Fellowship. All rights reserved.
              </p>
              <div className="flex justify-center space-x-4 mt-2">
                <span className="text-xs text-gray-400 dark:text-slate-500">Privacy Policy</span>
                <span className="text-xs text-gray-400 dark:text-slate-500">Terms of Service</span>
                <span className="text-xs text-gray-400 dark:text-slate-500">Contact Support</span>
              </div>
            </div>
          </div>
        </div>

        {/* Floating elements */}
        <div className="absolute top-20 left-10 animate-bounce">
          <div className="w-4 h-4 bg-blue-400 rounded-full opacity-60 dark:bg-blue-600"></div>
        </div>
        <div className="absolute bottom-20 right-10 animate-bounce animation-delay-2000">
          <div className="w-3 h-3 bg-purple-400 rounded-full opacity-60 dark:bg-purple-600"></div>
        </div>
        <div className="absolute top-1/2 left-5 animate-pulse">
          <div className="w-2 h-2 bg-indigo-400 rounded-full opacity-40 dark:bg-indigo-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b dark:bg-slate-800 dark:border-slate-700">
        <div className="w-full px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-10 sm:h-12">
            <div className="flex items-center">
              <img
                src="/pacmc.jpg"
                alt="PACMC Logo"
                className="h-6 w-6 sm:h-8 sm:w-8 rounded-full mr-2 sm:mr-3 object-cover"
              />
              <h1 className="text-xs sm:text-sm lg:text-base font-semibold text-gray-900 dark:text-slate-100">
                <span className="hidden sm:inline">PACMC Financial Management System</span>
                <span className="sm:hidden">PACMC Finance</span>
              </h1>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2">
              <NotificationBell />
              {(user && (userProfile?.role === 'Admin' || userProfile?.role === 'Super Admin')) && (
                <Link href="/admin/pending-records" className="flex items-center px-3 py-1.5 rounded-md bg-white border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 transition shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-600" style={{ minWidth: 'auto' }}>
                  Pending Record
                </Link>
              )}
              <LoginForm />
            </div>
          </div>
        </div>
      </header>
      {/* Main Content */}
      <main className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Welcome Section */}
        {/* 用户欢迎区已移除 */}

        {/* Navigation Cards */}
        <div className={`grid ${userProfile?.role === 'Basic User' ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-2 lg:grid-cols-3'} gap-3 sm:gap-6 mb-6 sm:mb-8`}>
          {/* Financial Records - All logged in users can view */}
          <LoggedInUser>
            <Link href="/financial-list" className="block h-full">
              <div className="bg-white p-3 sm:p-6 rounded-2xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer h-full flex items-center sm:block">
                <FileText className="h-7 w-7 text-blue-600 mr-3 sm:mr-0" />
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">
                    财务记录
                  </h3>
                  <div className="text-xs font-normal text-gray-500 mt-0.5">Financial Records</div>
                </div>
              </div>
            </Link>
          </LoggedInUser>

          {/* Add Record - All logged in users can add */}
          <LoggedInUser>
            <Link href="/add-record" className="block h-full">
              <div className="bg-white p-3 sm:p-6 rounded-2xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer h-full flex items-center sm:block">
                <Plus className="h-7 w-7 text-purple-600 mr-3 sm:mr-0" />
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">
                    新增记录
                  </h3>
                  <div className="text-xs font-normal text-gray-500 mt-0.5">Add Record</div>
                </div>
              </div>
            </Link>
          </LoggedInUser>

          {/* Export - All logged in users can view */}
          <LoggedInUser>
            <Link href="/export" className="block h-full">
              <div className="bg-white p-3 sm:p-6 rounded-2xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer h-full flex items-center sm:block">
                <Shield className="h-7 w-7 text-red-600 mr-3 sm:mr-0" />
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">
                    报表导出
                  </h3>
                  <div className="text-xs font-normal text-gray-500 mt-0.5">Report Export</div>
                </div>
              </div>
            </Link>
          </LoggedInUser>

          {/* 其它卡片仅 admin 及以上可见 */}
          {(userProfile?.role === 'Admin' || userProfile?.role === 'Super Admin') && (
            <>
              <Link href="/dashboard" className="block h-full">
                <div className="bg-white p-3 sm:p-6 rounded-2xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer h-full flex items-center sm:block">
                  <BarChart3 className="h-7 w-7 text-green-600 mr-3 sm:mr-0" />
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">
                      图表分析
                    </h3>
                    <div className="text-xs font-normal text-gray-500 mt-0.5">Chart Analysis</div>
                  </div>
                </div>
              </Link>
              <Link href="/admin/users" className="block h-full">
                <div className="bg-white p-3 sm:p-6 rounded-2xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer h-full flex items-center sm:block">
                  <Users className="h-7 w-7 text-orange-600 mr-3 sm:mr-0" />
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">
                      用户管理
                    </h3>
                    <div className="text-xs font-normal text-gray-500 mt-0.5">User Management</div>
                  </div>
                </div>
              </Link>
              <Link href="/set-cash" className="block h-full">
                <div className="bg-white p-3 sm:p-6 rounded-2xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer h-full flex items-center sm:block">
                  <Wallet className="h-7 w-7 text-yellow-600 mr-3 sm:mr-0" />
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">
                      现金设置
                    </h3>
                    <div className="text-xs font-normal text-gray-500 mt-0.5">Set Cash</div>
                  </div>
                </div>
              </Link>
            </>
          )}
        </div>

        {/* Quick Stats（仅 admin 及以上可见） */}
        {(userProfile?.role === 'Admin' || userProfile?.role === 'Super Admin') && (
          <LoggedInUser>
            <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6 dark:bg-slate-800 dark:border-slate-700">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 dark:text-slate-100">Monthly Statistics</h3>
              {/* 年份选择器 */}
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs text-gray-500">Year:</span>
                <select
                  className="text-xs px-2 py-1 border border-gray-300 rounded dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                >
                  {allYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              {/* 统计卡片 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="text-center p-2 sm:p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-xs sm:text-sm lg:text-base font-bold text-green-600 truncate">RM{yearIncome.toFixed(2)}</div>
                  <div className="text-xs text-gray-500 truncate">Total Income</div>
                </div>
                <div className="text-center p-2 sm:p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="text-xs sm:text-sm lg:text-base font-bold text-red-600 truncate">RM{yearExpense.toFixed(2)}</div>
                  <div className="text-xs text-gray-500 truncate">Total Expense</div>
                </div>
                <div className="text-center p-2 sm:p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-xs sm:text-sm lg:text-base font-bold text-blue-600 truncate">RM{yearBalance.toFixed(2)}</div>
                  <div className="text-xs text-gray-500 truncate">Total Balance</div>
                </div>
              </div>
            </div>
          </LoggedInUser>
        )}
      </main>
    </div>
  );
} 