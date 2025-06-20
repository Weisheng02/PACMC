'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AdminOrSuperAdmin, SuperAdminOnly } from '@/components/PermissionGate';
import { readFinancialRecords, deleteFinancialRecord, FinancialRecord } from '@/lib/googleSheets';
import { DollarSign, Plus, Edit, Trash2, RefreshCw, CheckCircle, Clock, Wallet, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function FinancialListPage() {
  const { userProfile, isSuperAdmin, isAdmin } = useAuth();
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [cashInHand, setCashInHand] = useState(0);
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashForm, setCashForm] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    description: '',
  });
  const [groupBy, setGroupBy] = useState<'none' | 'status' | 'month'>('status');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const router = useRouter();

  const loadRecords = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch('/api/sheets/read');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setRecords(data.records || []);
      setLastRefreshTime(new Date());
      
      // 获取现金在手
      const cashResponse = await fetch('/api/sheets/cash-in-hand');
      if (cashResponse.ok) {
        const cashData = await cashResponse.json();
        setCashInHand(cashData.cashInHand || 0);
        // 设置表单的默认金额为当前现金在手
        setCashForm(prev => ({
          ...prev,
          amount: cashData.cashInHand || 0,
        }));
      }
    } catch (error) {
      console.error('Failed to load records:', error);
      setError('Failed to load financial data. Please check your connection and try again.');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
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

  const handleAddCashInHand = async () => {
    try {
      // 计算需要调整的金额（新金额 - 当前金额）
      const adjustmentAmount = cashForm.amount - cashInHand;
      
      const response = await fetch('/api/sheets/cash-in-hand', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: cashForm.date,
          type: 'Adjustment',
          amount: adjustmentAmount, // 发送调整金额
          description: cashForm.description || '现金调整', // 如果没有描述，使用默认值
          createdBy: userProfile?.name || userProfile?.email || '未知用户',
        }),
      });

      if (!response.ok) {
        throw new Error('更新失败');
      }

      const result = await response.json();
      
      // 重新加载现金在手
      const cashResponse = await fetch('/api/sheets/cash-in-hand');
      if (cashResponse.ok) {
        const cashData = await cashResponse.json();
        setCashInHand(cashData.cashInHand || 0);
      }

      setShowCashModal(false);
      setCashForm({
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        description: '',
      });
      
      alert(result.message || '现金在手更新成功！');
    } catch (err) {
      console.error('Error updating cash in hand:', err);
      alert(`更新失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: 'MYR',
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

  const handleStatusToggle = async (key: string, newStatus: string) => {
    // 保存原始状态以便回滚
    const originalRecords = [...records];
    const originalStatus = records.find(r => r.key === key)?.status;

    // 立即更新本地状态，实现即时反馈
    setRecords(records.map(record =>
      record.key === key ? { ...record, status: newStatus } : record
    ));

    // 后台发送API请求，不阻塞UI
    try {
      const response = await fetch('/api/sheets/update-record-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key,
          status: newStatus,
          approvedBy: userProfile?.name || userProfile?.email || 'Unknown User',
        }),
      });

      if (!response.ok) {
        // 如果API失败，回滚到原状态
        const errorText = await response.text();
        console.error('Status update failed:', response.status, errorText);
        setRecords(originalRecords);
      }
    } catch (err) {
      console.error('Error updating record status:', err);
      // 如果API失败，回滚到原状态
      setRecords(originalRecords);
    }
  };

  // 分组和排序逻辑
  const getGroupedAndSortedRecords = () => {
    let processedRecords = [...records];

    // 排序
    processedRecords.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // 分组
    if (groupBy === 'none') {
      return { 'All Records': processedRecords };
    }

    if (groupBy === 'status') {
      const grouped = {
        'Pending': processedRecords.filter(r => r.status === 'Pending'),
        'Approved': processedRecords.filter(r => r.status === 'Approved'),
      };
      return grouped;
    }

    if (groupBy === 'month') {
      const grouped: { [key: string]: FinancialRecord[] } = {};
      
      processedRecords.forEach(record => {
        const date = new Date(record.date);
        const monthKey = `${date.getFullYear()}年${date.getMonth() + 1}月`;
        
        if (!grouped[monthKey]) {
          grouped[monthKey] = [];
        }
        grouped[monthKey].push(record);
      });

      // 按月份排序
      return Object.fromEntries(
        Object.entries(grouped).sort(([a], [b]) => {
          const dateA = new Date(a.replace(/年|月/g, '-'));
          const dateB = new Date(b.replace(/年|月/g, '-'));
          return sortOrder === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
        })
      );
    }

    return { 'All Records': processedRecords };
  };

  const groupedRecords = getGroupedAndSortedRecords();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Financial Records</h3>
          <p className="text-gray-600">Please wait while we fetch your data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="mx-auto h-12 w-12 text-red-400 mb-4">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to Load Data</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadRecords}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </button>
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
              <Link href="/" className="mr-4">
                <DollarSign className="h-8 w-8 text-blue-600" />
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">Financial Records</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Home
              </Link>
              <button
                onClick={loadRecords}
                disabled={refreshing}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {refreshing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              {lastRefreshTime && (
                <span className="text-xs text-gray-500">
                  Last updated: {lastRefreshTime.toLocaleTimeString()}
                </span>
              )}
              <SuperAdminOnly>
                <Link
                  href="/admin/users"
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700"
                >
                  <Users className="h-4 w-4" />
                  Manage Users
                </Link>
              </SuperAdminOnly>
              <AdminOrSuperAdmin>
                <button
                  onClick={() => setShowCashModal(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700"
                >
                  <Settings className="h-4 w-4" />
                  Set Cash
                </button>
                <Link
                  href="/add-record"
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Record
                </Link>
              </AdminOrSuperAdmin>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Income</p>
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
                <p className="text-sm font-medium text-gray-600">Total Expense</p>
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
                <p className="text-sm font-medium text-gray-600">Balance</p>
                <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {formatCurrency(balance)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Wallet className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Cash in Hand</p>
                <p className={`text-2xl font-bold ${cashInHand >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {formatCurrency(cashInHand)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-orange-600">
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
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">
                Financial Records ({records.length} records)
              </h2>
              
              {/* 分组和排序控件 */}
              <div className="flex items-center gap-4">
                {/* 分组选择 */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Group:</label>
                  <select
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value as 'none' | 'status' | 'month')}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="none">No Group</option>
                    <option value="status">By Status</option>
                    <option value="month">By Month</option>
                  </select>
                </div>

                {/* 排序选择 */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Sort:</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'date' | 'amount' | 'type')}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="date">By Date</option>
                    <option value="amount">By Amount</option>
                    <option value="type">By Type</option>
                  </select>
                  
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                    title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                  >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {records.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No Records</h3>
              <p className="mt-1 text-sm text-gray-500">
                {isAdmin || isSuperAdmin ? 'Click "Add Record" to start adding' : 'Waiting for admin to add records'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {Object.entries(groupedRecords).map(([groupName, groupRecords]) => (
                <div key={groupName} className="border-b border-gray-200 last:border-b-0">
                  {/* 分组标题和统计 */}
                  <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-medium text-gray-900">
                        {groupName} ({groupRecords.length} records)
                      </h3>
                      {groupRecords.length > 0 && (
                        <div className="flex items-center gap-4 text-xs text-gray-600">
                          <span>
                            Income: {formatCurrency(groupRecords.filter(r => r.type === 'Income').reduce((sum, r) => sum + r.amount, 0))}
                          </span>
                          <span>
                            Expense: {formatCurrency(groupRecords.filter(r => r.type === 'Expense').reduce((sum, r) => sum + r.amount, 0))}
                          </span>
                          <span>
                            Balance: {formatCurrency(
                              groupRecords.filter(r => r.type === 'Income').reduce((sum, r) => sum + r.amount, 0) -
                              groupRecords.filter(r => r.type === 'Expense').reduce((sum, r) => sum + r.amount, 0)
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 分组内的表格 */}
                  <table className="min-w-full border border-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-300 border-r border-gray-300">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-300 border-r border-gray-300">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-300 border-r border-gray-300">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-300 border-r border-gray-300">
                          Description
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-300 border-r border-gray-300">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-300 border-r border-gray-300">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-300 border-r border-gray-300">
                          Remark
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-300">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {groupRecords.map((record) => (
                        <tr key={record.key} className="hover:bg-gray-50 border-b border-gray-300">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-r border-gray-300">
                            {formatDate(record.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap border-r border-gray-300">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                record.type === 'Income'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {record.type === 'Income' ? 'Income' : 'Expense'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-r border-gray-300">
                            {record.who}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate border-r border-gray-300">
                            {record.description}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium border-r border-gray-300">
                            <span
                              className={
                                record.type === 'Income' ? 'text-green-600' : 'text-red-600'
                              }
                            >
                              {formatCurrency(record.amount)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap border-r border-gray-300">
                            <div className="flex items-center">
                              {record.status === 'Approved' ? (
                                <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                              ) : (
                                <Clock className="h-4 w-4 text-yellow-500 mr-1" />
                              )}
                              {(isAdmin || isSuperAdmin) ? (
                                <select
                                  value={record.status}
                                  onChange={(e) => handleStatusToggle(record.key, e.target.value)}
                                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded border-0 cursor-pointer ${
                                    record.status === 'Approved'
                                      ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                      : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                  }`}
                                >
                                  <option value="Pending">Pending</option>
                                  <option value="Approved">Approved</option>
                                </select>
                              ) : (
                                <span
                                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    record.status === 'Approved'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}
                                >
                                  {record.status === 'Approved' ? 'Approved' : 'Pending'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate border-r border-gray-300">
                            {record.remark || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center gap-2">
                              <AdminOrSuperAdmin>
                                <button
                                  onClick={() => router.push(`/edit-record/${record.key}`)}
                                  className="text-blue-600 hover:text-blue-900"
                                  disabled={deletingKey === record.key}
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                              </AdminOrSuperAdmin>
                              <SuperAdminOnly>
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
                              </SuperAdminOnly>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Cash In Hand Modal */}
      {showCashModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Set Cash in Hand</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={cashForm.date}
                    onChange={(e) => setCashForm({ ...cashForm, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cash in Hand Amount
                  </label>
                  <input
                    type="number"
                    value={cashForm.amount}
                    onChange={(e) => setCashForm({ ...cashForm, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    step="0.01"
                    placeholder="Enter new cash in hand amount"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Current cash in hand: {formatCurrency(cashInHand)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adjustment Reason (Optional)
                  </label>
                  <textarea
                    value={cashForm.description}
                    onChange={(e) => setCashForm({ ...cashForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    rows={3}
                    placeholder="For example: Bank fees, cash deposit, account adjustment, etc. (Optional)"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCashModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCashInHand}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Confirm Set
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 