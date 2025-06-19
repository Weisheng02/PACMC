'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PermissionGate, FinanceOnly } from '@/components/PermissionGate';
import { readFinancialRecords, deleteFinancialRecord, FinancialRecord } from '@/lib/googleSheets';
import { DollarSign, Plus, Edit, Trash2, RefreshCw, Download, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function FinancialListPage() {
  const { userProfile } = useAuth();
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const router = useRouter();

  const loadRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await readFinancialRecords();
      setRecords(data);
    } catch (err) {
      setError('加载财务记录失败');
      console.error('Error loading records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleDelete = async (key: string) => {
    if (!confirm('确定要删除这条记录吗？此操作不可撤销。')) {
      return;
    }

    try {
      setDeletingKey(key);
      await deleteFinancialRecord(key);
      setRecords(records.filter(record => record.key !== key));
      alert('记录删除成功！');
    } catch (err) {
      console.error('Error deleting record:', err);
      alert(`删除失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setDeletingKey(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: 'TWD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('zh-TW');
  };

  const totalIncome = records
    .filter(record => record.type === 'Income')
    .reduce((sum, record) => sum + record.amount, 0);

  const totalExpense = records
    .filter(record => record.type === 'Expense')
    .reduce((sum, record) => sum + record.amount, 0);

  const balance = totalIncome - totalExpense;

  const approvedRecords = records.filter(record => record.status === 'Approved');
  const pendingRecords = records.filter(record => record.status === 'Pending');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
              <Link href="/" className="mr-4">
                <DollarSign className="h-8 w-8 text-blue-600" />
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">财务列表</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                返回首页
              </Link>
              <button
                onClick={loadRecords}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <RefreshCw className="h-4 w-4" />
                刷新
              </button>
              <FinanceOnly>
                <Link
                  href="/add-record"
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  新增记录
                </Link>
              </FinanceOnly>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">总收入</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalIncome)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">总支出</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(totalExpense)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">结余</p>
                <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {formatCurrency(balance)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">待审核</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {pendingRecords.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Records Table */}
        <div className="bg-white shadow-sm border rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              财务记录 ({records.length} 条)
            </h2>
          </div>

          {records.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">暂无记录</h3>
              <p className="mt-1 text-sm text-gray-500">
                {userProfile?.role === 'finance' ? '点击"新增记录"开始添加' : '等待财政成员添加记录'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      日期
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      类型
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      记录人
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      描述
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      金额
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      备注
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {records.map((record) => (
                    <tr key={record.key} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(record.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            record.type === 'Income'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {record.type === 'Income' ? '收入' : '支出'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.who}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {record.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <span
                          className={
                            record.type === 'Income' ? 'text-green-600' : 'text-red-600'
                          }
                        >
                          {formatCurrency(record.amount)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {record.status === 'Approved' ? (
                            <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                          ) : (
                            <Clock className="h-4 w-4 text-yellow-500 mr-1" />
                          )}
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              record.status === 'Approved'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {record.status === 'Approved' ? '已审核' : '待审核'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {record.remark || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <FinanceOnly>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => router.push(`/edit-record/${record.key}`)}
                              className="text-blue-600 hover:text-blue-900"
                              disabled={deletingKey === record.key}
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(record.key)}
                              disabled={deletingKey === record.key}
                              className={`${
                                deletingKey === record.key 
                                  ? 'text-gray-400 cursor-not-allowed' 
                                  : 'text-red-600 hover:text-red-900'
                              }`}
                            >
                              {deletingKey === record.key ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </FinanceOnly>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 