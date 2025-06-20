'use client';
import { LoginButton } from '@/components/LoginButton';
import { SuperAdminOnly, AdminOrSuperAdmin, LoggedInUser } from '@/components/PermissionGate';
import { useAuth } from '@/contexts/AuthContext';
import { DollarSign, BarChart3, FileText, Plus, Users, Shield, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

interface FinancialRecord {
  key: string;
  account: string;
  date: string;
  type: 'Income' | 'Expense';
  who: string;
  amount: number;
  description: string;
  status: string;
  takePut: boolean;
  remark: string;
  createdDate: string;
  createdBy: string;
  approvedDate: string;
  approvedBy: string;
  lastUserUpdate: string;
  lastDateUpdate: string;
  cashInHand?: number;
}

// Main Home Component
export default function Home() {
  const { user, userProfile, loading, error } = useAuth();
  const [financialData, setFinancialData] = useState<FinancialRecord[]>([]);
  const [stats, setStats] = useState({
    monthlyIncome: 0,
    monthlyExpense: 0,
    monthlyBalance: 0,
    cashInHand: 0,
    totalIncome: 0,
    totalExpense: 0,
    totalBalance: 0,
  });

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
    try {
      const response = await fetch('/api/sheets/read');
      if (response.ok) {
        const data = await response.json();
        setFinancialData(data.records || []);
      }
    } catch (error) {
      console.error('获取财务数据失败:', error);
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
      console.error('获取现金在手失败:', error);
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
      cashInHand: prev.cashInHand, // 保持现金在手不变，因为它来自独立的 API
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
            <h1 className="text-3xl font-bold text-red-900 mb-2">连接错误</h1>
            <p className="text-red-600 mb-4">Firebase 连接出现问题</p>
            <div className="bg-red-100 border border-red-300 rounded-md p-4 text-left">
              <p className="text-sm text-red-800 font-mono">{error}</p>
            </div>
          </div>
          <div className="flex justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              重新加载
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">PACMC 青少年团契</h1>
            <h2 className="text-xl text-gray-600 mb-6">财务管理系统</h2>
            <p className="text-gray-500">请登录以访问财务管理功能</p>
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
              <h1 className="text-xl font-semibold text-gray-900">PACMC 财务管理系统</h1>
            </div>
            <LoginButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">欢迎回来，{userProfile?.name}！</h2>
          <p className="text-gray-600 mb-1">邮箱：{userProfile?.email}</p>
          <p className="text-gray-600">
            您的权限：<span className="font-semibold">{userProfile?.role}</span>
          </p>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* 财务列表 */}
          <LoggedInUser>
            <Link href="/financial-list" className="block h-full">
              <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer h-full">
                <div className="flex items-center mb-4">
                  <FileText className="h-6 w-6 text-blue-600 mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">财务列表</h3>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  查看所有收入和支出记录，并根据权限进行管理
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    所有用户可查看
                  </span>
                </div>
              </div>
            </Link>
          </LoggedInUser>

          {/* 图表分析 */}
          <LoggedInUser>
            <Link href="/dashboard" className="block h-full">
              <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer h-full">
                <div className="flex items-center mb-4">
                  <BarChart3 className="h-6 w-6 text-green-600 mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">图表分析</h3>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  查看财务趋势和分类统计
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                    所有用户可查看
                  </span>
                </div>
              </div>
            </Link>
          </LoggedInUser>

          {/* 新增记录 */}
          <AdminOrSuperAdmin>
            <Link href="/add-record" className="block h-full">
              <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer h-full">
                <div className="flex items-center mb-4">
                  <Plus className="h-6 w-6 text-purple-600 mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">新增记录</h3>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  添加新的收入或支出记录
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                    管理员及以上
                  </span>
                </div>
              </div>
            </Link>
          </AdminOrSuperAdmin>

          {/* 用户管理 */}
          <SuperAdminOnly>
            <Link href="/admin/users" className="block h-full">
              <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer h-full">
                <div className="flex items-center mb-4">
                  <Users className="h-6 w-6 text-orange-600 mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">用户管理</h3>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  管理用户权限和角色
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded">
                    仅超级管理员
                  </span>
                </div>
              </div>
            </Link>
          </SuperAdminOnly>

          {/* 报表导出 */}
          <LoggedInUser>
            <Link href="/export" className="block h-full">
              <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer h-full">
                <div className="flex items-center mb-4">
                  <Shield className="h-6 w-6 text-red-600 mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">报表导出</h3>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  导出 PDF 和 Excel 报表
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span className="bg-red-100 text-red-800 px-2 py-1 rounded">
                    所有用户可查看
                  </span>
                </div>
              </div>
            </Link>
          </LoggedInUser>
        </div>

        {/* Quick Stats */}
        <LoggedInUser>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-medium text-gray-900 mb-4">快速统计</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">${stats.monthlyIncome.toFixed(2)}</div>
                <div className="text-sm text-gray-600">本月收入</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">${stats.monthlyExpense.toFixed(2)}</div>
                <div className="text-sm text-gray-600">本月支出</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">${stats.monthlyBalance.toFixed(2)}</div>
                <div className="text-sm text-gray-600">本月结余</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">${stats.cashInHand.toFixed(2)}</div>
                <div className="text-sm text-gray-600">现金在手</div>
              </div>
            </div>
            
            {/* 总统计 */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-md font-medium text-gray-700 mb-3">总体统计</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-lg font-bold text-green-600">${stats.totalIncome.toFixed(2)}</div>
                  <div className="text-xs text-gray-600">总收入</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-lg font-bold text-red-600">${stats.totalExpense.toFixed(2)}</div>
                  <div className="text-xs text-gray-600">总支出</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-lg font-bold text-blue-600">${stats.totalBalance.toFixed(2)}</div>
                  <div className="text-xs text-gray-600">总结余</div>
                </div>
              </div>
            </div>
          </div>
        </LoggedInUser>
      </main>
    </div>
  );
} 