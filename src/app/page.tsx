'use client';
import { LoginButton } from '@/components/LoginButton';
import { FinanceOnly, CoreAndAbove, AllUsers } from '@/components/PermissionGate';
import { useAuth } from '@/contexts/AuthContext';
import { DollarSign, BarChart3, FileText, Plus, Users, Shield } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const { user, userProfile, loading, error } = useAuth();

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
            您的权限：{userProfile?.role === 'finance' && '财政成员'}
            {userProfile?.role === 'core' && '核心团队'}
            {userProfile?.role === 'leadership' && '高层顾问'}
          </p>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* 财务列表 */}
          <CoreAndAbove
            fallback={
              <div className="bg-gray-100 p-6 rounded-lg border-2 border-dashed border-gray-300">
                <div className="flex items-center mb-4">
                  <FileText className="h-6 w-6 text-gray-400 mr-3" />
                  <h3 className="text-lg font-medium text-gray-400">财务列表</h3>
                </div>
                <p className="text-gray-400 text-sm">需要核心团队或以上权限</p>
              </div>
            }
          >
            <Link href="/financial-list">
              <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center mb-4">
                  <FileText className="h-6 w-6 text-blue-600 mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">财务列表</h3>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  查看所有收入和支出记录
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {userProfile?.role === 'finance' ? '可编辑' : '仅查看'}
                  </span>
                </div>
              </div>
            </Link>
          </CoreAndAbove>

          {/* 图表分析 */}
          <FinanceOnly
            fallback={
              <div className="bg-gray-100 p-6 rounded-lg border-2 border-dashed border-gray-300">
                <div className="flex items-center mb-4">
                  <BarChart3 className="h-6 w-6 text-gray-400 mr-3" />
                  <h3 className="text-lg font-medium text-gray-400">图表分析</h3>
                </div>
                <p className="text-gray-400 text-sm">仅财政成员可访问</p>
              </div>
            }
          >
            <Link href="/dashboard">
              <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center mb-4">
                  <BarChart3 className="h-6 w-6 text-green-600 mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">图表分析</h3>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  查看财务趋势和分类统计
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                    仅财政成员
                  </span>
                </div>
              </div>
            </Link>
          </FinanceOnly>

          {/* 新增记录 */}
          <FinanceOnly
            fallback={
              <div className="bg-gray-100 p-6 rounded-lg border-2 border-dashed border-gray-300">
                <div className="flex items-center mb-4">
                  <Plus className="h-6 w-6 text-gray-400 mr-3" />
                  <h3 className="text-lg font-medium text-gray-400">新增记录</h3>
                </div>
                <p className="text-gray-400 text-sm">仅财政成员可访问</p>
              </div>
            }
          >
            <Link href="/add-record">
              <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center mb-4">
                  <Plus className="h-6 w-6 text-purple-600 mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">新增记录</h3>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  添加新的收入或支出记录
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                    仅财政成员
                  </span>
                </div>
              </div>
            </Link>
          </FinanceOnly>

          {/* 用户管理 */}
          <FinanceOnly
            fallback={
              <div className="bg-gray-100 p-6 rounded-lg border-2 border-dashed border-gray-300">
                <div className="flex items-center mb-4">
                  <Users className="h-6 w-6 text-gray-400 mr-3" />
                  <h3 className="text-lg font-medium text-gray-400">用户管理</h3>
                </div>
                <p className="text-gray-400 text-sm">仅财政成员可访问</p>
              </div>
            }
          >
            <Link href="/user-management">
              <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center mb-4">
                  <Users className="h-6 w-6 text-orange-600 mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">用户管理</h3>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  管理用户权限和角色
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded">
                    仅财政成员
                  </span>
                </div>
              </div>
            </Link>
          </FinanceOnly>

          {/* 报表导出 */}
          <CoreAndAbove
            fallback={
              <div className="bg-gray-100 p-6 rounded-lg border-2 border-dashed border-gray-300">
                <div className="flex items-center mb-4">
                  <Shield className="h-6 w-6 text-gray-400 mr-3" />
                  <h3 className="text-lg font-medium text-gray-400">报表导出</h3>
                </div>
                <p className="text-gray-400 text-sm">需要核心团队或以上权限</p>
              </div>
            }
          >
            <Link href="/export">
              <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center mb-4">
                  <Shield className="h-6 w-6 text-red-600 mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">报表导出</h3>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  导出 PDF 和 Excel 报表
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span className="bg-red-100 text-red-800 px-2 py-1 rounded">
                    核心团队以上
                  </span>
                </div>
              </div>
            </Link>
          </CoreAndAbove>
        </div>

        {/* Quick Stats */}
        <AllUsers>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-medium text-gray-900 mb-4">快速统计</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">$12,450</div>
                <div className="text-sm text-gray-600">本月收入</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">$8,230</div>
                <div className="text-sm text-gray-600">本月支出</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">$4,220</div>
                <div className="text-sm text-gray-600">本月结余</div>
              </div>
            </div>
          </div>
        </AllUsers>
      </main>
    </div>
  );
} 