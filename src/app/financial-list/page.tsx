'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AdminOrSuperAdmin, SuperAdminOnly } from '@/components/PermissionGate';
import { readFinancialRecords, deleteFinancialRecord, FinancialRecord, formatGoogleSheetsDate } from '@/lib/googleSheets';
import { DollarSign, Plus, Edit, Trash2, RefreshCw, CheckCircle, Clock, Wallet, Settings, Users, Search, Check, X, Eye } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function FinancialListPage() {
  const { userProfile, isSuperAdmin, isAdmin } = useAuth();
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<Partial<FinancialRecord> | null>(null);
  const [cashInHand, setCashInHand] = useState(0);
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashForm, setCashForm] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    description: '',
  });
  const [groupBy, setGroupBy] = useState<'none' | 'status' | 'month'>('month');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  
  // 高级搜索和过滤状态
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [searchFilters, setSearchFilters] = useState({
    keyword: '',
    type: 'all' as 'all' | 'Income' | 'Expense',
    status: 'all' as 'all' | 'Pending' | 'Approved',
    dateFrom: '',
    dateTo: '',
    amountFrom: '',
    amountTo: '',
    account: 'all' as 'all' | 'MIYF' | 'Other',
  });
  const [savedSearches, setSavedSearches] = useState<Array<{
    id: string;
    name: string;
    filters: typeof searchFilters;
  }>>([]);
  
  // 可折叠月份分组状态
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  
  // Toast notification state
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
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

  // Auto-dismiss toast notifications
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleDelete = async (key: string) => {
    if (!confirm('确定要删除这条记录吗？此操作不可撤销。')) {
      return;
    }

    // 保存原始状态以便回滚
    const originalRecords = [...records];
    const deletedRecord = records.find(r => r.key === key);

    // 立即从本地状态中移除，实现即时反馈
    setRecords(prevRecords => prevRecords.filter(record => record.key !== key));

    // 后台发送删除请求，不阻塞UI
    try {
      await deleteFinancialRecord(key);
      // 删除成功，不需要做任何操作
    } catch (err) {
      // 如果删除失败，回滚到原状态
      console.error('Error deleting record:', err);
      setRecords(originalRecords);
      console.warn('Delete failed, reverted to original state');
      // 可以添加一个小的toast通知
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
      
      setToast({ type: 'success', message: result.message || '现金在手更新成功！' });
    } catch (err) {
      console.error('Error updating cash in hand:', err);
      setToast({ type: 'error', message: `更新失败: ${err instanceof Error ? err.message : '未知错误'}` });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: 'MYR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return formatGoogleSheetsDate(dateString);
  };

  const formatDateTime = (dateString: string) => {
    return formatGoogleSheetsDate(dateString, 'zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
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

  // 应用搜索过滤器
  const applyFilters = (records: FinancialRecord[]) => {
    return records.filter(record => {
      // 关键词搜索（搜索描述、姓名、备注）
      if (searchFilters.keyword) {
        const keyword = searchFilters.keyword.toLowerCase();
        const searchableText = [
          record.description,
          record.who,
          record.remark,
          record.account
        ].join(' ').toLowerCase();
        
        if (!searchableText.includes(keyword)) {
          return false;
        }
      }

      // 类型过滤
      if (searchFilters.type !== 'all' && record.type !== searchFilters.type) {
        return false;
      }

      // 状态过滤
      if (searchFilters.status !== 'all' && record.status !== searchFilters.status) {
        return false;
      }

      // 账户过滤
      if (searchFilters.account !== 'all' && record.account !== searchFilters.account) {
        return false;
      }

      // 日期范围过滤
      if (searchFilters.dateFrom) {
        const recordDate = new Date(record.date);
        const fromDate = new Date(searchFilters.dateFrom);
        if (recordDate < fromDate) {
          return false;
        }
      }

      if (searchFilters.dateTo) {
        const recordDate = new Date(record.date);
        const toDate = new Date(searchFilters.dateTo);
        if (recordDate > toDate) {
          return false;
        }
      }

      // 金额范围过滤
      if (searchFilters.amountFrom) {
        const fromAmount = parseFloat(searchFilters.amountFrom);
        if (record.amount < fromAmount) {
          return false;
        }
      }

      if (searchFilters.amountTo) {
        const toAmount = parseFloat(searchFilters.amountTo);
        if (record.amount > toAmount) {
          return false;
        }
      }

      return true;
    });
  };

  // 保存当前搜索
  const saveCurrentSearch = () => {
    const searchName = prompt('请输入搜索名称：');
    if (!searchName) return;

    const newSearch = {
      id: Date.now().toString(),
      name: searchName,
      filters: { ...searchFilters }
    };

    setSavedSearches(prev => [...prev, newSearch]);
    
    // 保存到本地存储
    const saved = JSON.parse(localStorage.getItem('savedSearches') || '[]');
    saved.push(newSearch);
    localStorage.setItem('savedSearches', JSON.stringify(saved));
    
    setToast({ type: 'success', message: '搜索已保存！' });
  };

  // 加载保存的搜索
  const loadSavedSearch = (savedSearch: typeof savedSearches[0]) => {
    setSearchFilters(savedSearch.filters);
  };

  // 删除保存的搜索
  const deleteSavedSearch = (searchId: string) => {
    if (!confirm('确定要删除这个保存的搜索吗？')) return;
    
    setSavedSearches(prev => prev.filter(s => s.id !== searchId));
    
    // 从本地存储删除
    const saved = JSON.parse(localStorage.getItem('savedSearches') || '[]');
    const updated = saved.filter((s: any) => s.id !== searchId);
    localStorage.setItem('savedSearches', JSON.stringify(updated));
  };

  // 清除所有过滤器
  const clearAllFilters = () => {
    setSearchFilters({
      keyword: '',
      type: 'all',
      status: 'all',
      dateFrom: '',
      dateTo: '',
      amountFrom: '',
      amountTo: '',
      account: 'all',
    });
  };

  // 加载保存的搜索从本地存储
  useEffect(() => {
    const saved = localStorage.getItem('savedSearches');
    if (saved) {
      try {
        setSavedSearches(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading saved searches:', error);
      }
    }
  }, []);

  const handleStatusToggle = async (key: string, newStatus: 'Pending' | 'Approved') => {
    // 如果是审批操作，需要确认
    if (newStatus === 'Approved') {
      const record = records.find(r => r.key === key);
      if (record) {
        const confirmed = confirm(
          `Are you sure you want to approve this record?\n\n` +
          `Type: ${record.type}\n` +
          `Amount: RM${formatCurrency(record.amount)}\n` +
          `Description: ${record.description}\n` +
          `Created by: ${record.createdBy || 'Unknown'}`
        );
        
        if (!confirmed) {
          return;
        }
      }
    }

    // 保存原始状态以便回滚
    const originalRecords = [...records];
    const originalStatus = records.find(r => r.key === key)?.status;

    // 立即更新本地状态，实现即时反馈
    setRecords(prevRecords =>
      prevRecords.map(record =>
        record.key === key ? { ...record, status: newStatus } : record
      )
    );

    // 后台发送API请求，不阻塞UI
    try {
      const response = await fetch('/api/sheets/update-record-status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          key, 
          status: newStatus,
          approvedBy: userProfile?.name || userProfile?.email || 'Unknown User'
        }),
      });

      if (!response.ok) {
        // 如果API失败，回滚到原状态
        console.error('Failed to update status:', response.status);
        setRecords(originalRecords);
        setToast({ type: 'error', message: 'Failed to update record status. Please try again.' });
        console.warn('Status update failed, reverted to original state');
      } else {
        // 成功更新状态
        const result = await response.json();
        if (newStatus === 'Approved') {
          setToast({ type: 'success', message: `Record approved successfully! ${result.message || ''}` });
        }
      }
    } catch (error) {
      // 如果API失败，回滚到原状态
      console.error('Error updating status:', error);
      setRecords(originalRecords);
      setToast({ type: 'error', message: 'Failed to update record status. Please try again.' });
      console.warn('Status update failed, reverted to original state');
    }
  };

  // 开始内联编辑
  const startInlineEdit = (record: FinancialRecord) => {
    setEditingKey(record.key);
    setEditingRecord({
      date: record.date,
      type: record.type,
      who: record.who,
      description: record.description,
      amount: record.amount,
      remark: record.remark,
      account: record.account,
      takePut: record.takePut,
    });
  };

  // 取消内联编辑
  const cancelInlineEdit = () => {
    setEditingKey(null);
    setEditingRecord(null);
  };

  // 保存内联编辑
  const saveInlineEdit = async () => {
    if (!editingKey || !editingRecord) return;

    // 保存原始状态以便回滚
    const originalRecords = [...records];
    const originalRecord = records.find(r => r.key === editingKey);

    // 立即更新本地状态，实现即时反馈
    setRecords(prevRecords =>
      prevRecords.map(record =>
        record.key === editingKey ? { 
          ...record, 
          ...editingRecord,
          // 确保日期格式正确
          date: editingRecord.date || record.date,
          // 确保金额是数字
          amount: typeof editingRecord.amount === 'number' ? editingRecord.amount : record.amount,
        } : record
      )
    );
    
    // 立即重置编辑状态，让用户看到更新结果
    setEditingKey(null);
    setEditingRecord(null);

    // 后台发送API请求，不阻塞UI
    try {
      const response = await fetch(`/api/sheets/update/${editingKey}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingRecord),
      });

      if (!response.ok) {
        // 如果API失败，回滚到原状态
        console.error('Failed to update record:', response.status);
        setRecords(originalRecords);
        // 恢复编辑状态
        if (originalRecord) {
          setEditingKey(editingKey);
          setEditingRecord({
            date: originalRecord.date,
            type: originalRecord.type,
            who: originalRecord.who,
            description: originalRecord.description,
            amount: originalRecord.amount,
            remark: originalRecord.remark,
            account: originalRecord.account,
            takePut: originalRecord.takePut,
          });
        }
        console.warn('Record update failed, reverted to original state');
      }
    } catch (error) {
      // 如果API失败，回滚到原状态
      console.error('Error updating record:', error);
      setRecords(originalRecords);
      // 恢复编辑状态
      if (originalRecord) {
        setEditingKey(editingKey);
        setEditingRecord({
          date: originalRecord.date,
          type: originalRecord.type,
          who: originalRecord.who,
          description: originalRecord.description,
          amount: originalRecord.amount,
          remark: originalRecord.remark,
          account: originalRecord.account,
          takePut: originalRecord.takePut,
        });
      }
      console.warn('Record update failed, reverted to original state');
    }
  };

  // 分组和排序逻辑
  const getGroupedAndSortedRecords = () => {
    // 首先应用搜索过滤器
    let processedRecords = applyFilters([...records]);

    // 按创建时间排序（最新的在上）
    processedRecords.sort((a, b) => {
      let createdTimeA = 0;
      let createdTimeB = 0;
      
      if (a.createdDate) {
        try {
          createdTimeA = new Date(a.createdDate).getTime();
        } catch (e) {
          createdTimeA = 0;
        }
      }
      
      if (b.createdDate) {
        try {
          createdTimeB = new Date(b.createdDate).getTime();
        } catch (e) {
          createdTimeB = 0;
        }
      }
      
      // 最新的创建时间在上，新记录排在最上面
      return createdTimeB - createdTimeA;
    });

    // 按月份分组（基于date字段）
    const grouped: { [key: string]: FinancialRecord[] } = {};
    
    processedRecords.forEach(record => {
      const date = new Date(record.date);
      const monthKey = `${date.getFullYear()}年${date.getMonth() + 1}月`;
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(record);
    });

    // 按月份排序（最新的在上）
    return Object.fromEntries(
      Object.entries(grouped)
        .sort(([monthKeyA], [monthKeyB]) => {
          // 解析月份字符串，格式：2025年5月
          const parseMonthKey = (monthKey: string) => {
            const match = monthKey.match(/(\d{4})年(\d{1,2})月/);
            if (match) {
              const year = parseInt(match[1]);
              const month = parseInt(match[2]);
              return new Date(year, month - 1, 1).getTime(); // 月份从0开始，所以减1
            }
            return 0;
          };
          
          const timeA = parseMonthKey(monthKeyA);
          const timeB = parseMonthKey(monthKeyB);
          
          return timeB - timeA; // 最新的月份在上
        })
    );
  };

  const groupedRecords = getGroupedAndSortedRecords();

  // 计算过滤后的记录总数
  const filteredRecordsCount = Object.values(groupedRecords).reduce((total, group) => total + group.length, 0);

  // 设置默认展开最新的月份
  useEffect(() => {
    const monthKeys = Object.keys(groupedRecords);
    if (monthKeys.length > 0 && expandedMonths.size === 0) {
      // 默认展开最新的月份
      setExpandedMonths(new Set([monthKeys[0]]));
    }
  }, [groupedRecords, expandedMonths.size]);

  // 切换月份展开/收起状态
  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey);
      } else {
        newSet.add(monthKey);
      }
      return newSet;
    });
  };

  // 展开所有月份
  const expandAllMonths = () => {
    const allMonthKeys = Object.keys(groupedRecords);
    setExpandedMonths(new Set(allMonthKeys));
  };

  // 收起所有月份
  const collapseAllMonths = () => {
    setExpandedMonths(new Set());
  };

  // 计算过滤后的统计数据
  const filteredRecords = applyFilters(records);
  const filteredTotalIncome = filteredRecords
    .filter(record => record.type === 'Income')
    .reduce((sum, record) => sum + record.amount, 0);
  const filteredTotalExpense = filteredRecords
    .filter(record => record.type === 'Expense')
    .reduce((sum, record) => sum + record.amount, 0);
  const filteredBalance = filteredTotalIncome - filteredTotalExpense;
  const filteredPendingRecords = filteredRecords.filter(record => record.status === 'Pending');

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
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center h-auto sm:h-16 py-4 sm:py-0">
            <div className="flex items-center mb-4 sm:mb-0">
              <Link href="/" className="mr-4">
                <img
                  src="/pacmc.jpg"
                  alt="PACMC Logo"
                  className="h-9 w-9 rounded-full object-cover"
                />
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">Financial Records</h1>
            </div>
            
            {/* Desktop buttons */}
            <div className="hidden sm:flex items-center gap-4">
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

            {/* Mobile buttons - simplified */}
            <div className="flex items-center gap-2 w-full sm:hidden">
              <Link
                href="/"
                className="flex items-center justify-center w-10 h-10 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                title="Back to Home"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <button
                onClick={loadRecords}
                disabled={refreshing}
                className="flex items-center justify-center w-10 h-10 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title={refreshing ? 'Refreshing...' : 'Refresh'}
              >
                {refreshing ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
                ) : (
                  <RefreshCw className="h-5 w-5" />
                )}
              </button>
              <AdminOrSuperAdmin>
                <Link
                  href="/add-record"
                  className="flex items-center justify-center w-10 h-10 text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  title="Add Record"
                >
                  <Plus className="h-5 w-5" />
                </Link>
              </AdminOrSuperAdmin>
              <SuperAdminOnly>
                <Link
                  href="/admin/users"
                  className="flex items-center justify-center w-10 h-10 text-white bg-purple-600 rounded-md hover:bg-purple-700"
                  title="Manage Users"
                >
                  <Users className="h-5 w-5" />
                </Link>
              </SuperAdminOnly>
              <AdminOrSuperAdmin>
                <button
                  onClick={() => setShowCashModal(true)}
                  className="flex items-center justify-center w-10 h-10 text-white bg-yellow-600 rounded-md hover:bg-yellow-700"
                  title="Set Cash"
                >
                  <Settings className="h-5 w-5" />
                </button>
              </AdminOrSuperAdmin>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-6 mb-8">
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
              </div>
              <div className="ml-3 sm:ml-4 min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Total Income</p>
                <p className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-bold text-green-600 break-words">
                  {formatCurrency(filteredTotalIncome)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-2 bg-red-100 rounded-lg">
                <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
              </div>
              <div className="ml-3 sm:ml-4 min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Total Expense</p>
                <p className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-bold text-red-600 break-words">
                  {formatCurrency(filteredTotalExpense)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
              </div>
              <div className="ml-3 sm:ml-4 min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Balance</p>
                <p className={`text-sm sm:text-lg lg:text-xl xl:text-2xl font-bold break-words ${filteredBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {formatCurrency(filteredBalance)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-2 bg-yellow-100 rounded-lg">
                <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600" />
              </div>
              <div className="ml-3 sm:ml-4 min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Cash in Hand</p>
                <p className={`text-sm sm:text-lg lg:text-xl xl:text-2xl font-bold break-words ${cashInHand >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {formatCurrency(cashInHand)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-2 bg-orange-100 rounded-lg">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
              </div>
              <div className="ml-3 sm:ml-4 min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Pending</p>
                <p className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-bold text-orange-600">
                  {filteredPendingRecords.length}
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-lg font-medium text-gray-900">
                Financial Records ({filteredRecordsCount} records)
              </h2>
              
              {/* 高级搜索控件 */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
                {/* 高级搜索按钮 */}
                <button
                  onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Search className="h-4 w-4" />
                  Advanced Search
                </button>
              </div>
            </div>

            {/* 高级搜索面板 */}
            {showAdvancedSearch && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* 关键词搜索 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Keyword Search</label>
                    <input
                      type="text"
                      placeholder="Search description, name, remark..."
                      value={searchFilters.keyword}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, keyword: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>

                  {/* 类型过滤 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={searchFilters.type}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, type: e.target.value as any }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    >
                      <option value="all">All Types</option>
                      <option value="Income">Income</option>
                      <option value="Expense">Expense</option>
                    </select>
                  </div>

                  {/* 状态过滤 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={searchFilters.status}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    >
                      <option value="all">All Status</option>
                      <option value="Pending">Pending</option>
                      <option value="Approved">Approved</option>
                    </select>
                  </div>

                  {/* 账户过滤 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
                    <select
                      value={searchFilters.account}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, account: e.target.value as any }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    >
                      <option value="all">All Accounts</option>
                      <option value="MIYF">MIYF</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* 日期范围 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                    <input
                      type="date"
                      value={searchFilters.dateFrom}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                    <input
                      type="date"
                      value={searchFilters.dateTo}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>

                  {/* 金额范围 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount From (RM)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={searchFilters.amountFrom}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, amountFrom: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount To (RM)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={searchFilters.amountTo}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, amountTo: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                </div>

                {/* 搜索操作按钮 */}
                <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={saveCurrentSearch}
                    className="px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                  >
                    Save Search
                  </button>
                  <button
                    onClick={clearAllFilters}
                    className="px-3 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    Clear All
                  </button>
                  
                  {/* 保存的搜索列表 */}
                  {savedSearches.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Saved:</span>
                      <div className="flex flex-wrap gap-1">
                        {savedSearches.map((savedSearch) => (
                          <div key={savedSearch.id} className="flex items-center gap-1">
                            <button
                              onClick={() => loadSavedSearch(savedSearch)}
                              className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors"
                            >
                              {savedSearch.name}
                            </button>
                            <button
                              onClick={() => deleteSavedSearch(savedSearch.id)}
                              className="text-red-500 hover:text-red-700 text-xs"
                              title="Delete saved search"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 当前过滤器显示 */}
            {Object.values(searchFilters).some(value => value !== '' && value !== 'all') && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-600">Active filters:</span>
                {searchFilters.keyword && (
                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                    Keyword: {searchFilters.keyword}
                  </span>
                )}
                {searchFilters.type !== 'all' && (
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                    Type: {searchFilters.type}
                  </span>
                )}
                {searchFilters.status !== 'all' && (
                  <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                    Status: {searchFilters.status}
                  </span>
                )}
                {searchFilters.account !== 'all' && (
                  <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                    Account: {searchFilters.account}
                  </span>
                )}
                {searchFilters.dateFrom && (
                  <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded">
                    From: {searchFilters.dateFrom}
                  </span>
                )}
                {searchFilters.dateTo && (
                  <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded">
                    To: {searchFilters.dateTo}
                  </span>
                )}
                {searchFilters.amountFrom && (
                  <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                    Amount ≥ RM {searchFilters.amountFrom}
                  </span>
                )}
                {searchFilters.amountTo && (
                  <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                    Amount ≤ RM {searchFilters.amountTo}
                  </span>
                )}
              </div>
            )}
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
              {/* 展开/收起所有按钮 */}
              <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Quick Actions:</span>
                  <button
                    onClick={expandAllMonths}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Expand All
                  </button>
                  <button
                    onClick={collapseAllMonths}
                    className="px-3 py-1 text-xs bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    Collapse All
                  </button>
                </div>
                <div className="text-xs text-gray-500">
                  {Object.keys(groupedRecords).filter(key => expandedMonths.has(key)).length} of {Object.keys(groupedRecords).length} months expanded
                </div>
              </div>

              {Object.entries(groupedRecords)
                .filter(([groupName, groupRecords]) => groupRecords.length > 0)
                .map(([groupName, groupRecords]) => {
                  const isExpanded = expandedMonths.has(groupName);
                  const monthIncome = groupRecords.filter(r => r.type === 'Income').reduce((sum, r) => sum + r.amount, 0);
                  const monthExpense = groupRecords.filter(r => r.type === 'Expense').reduce((sum, r) => sum + r.amount, 0);
                  const monthBalance = monthIncome - monthExpense;
                  
                  return (
                    <div key={groupName} className="border-b border-gray-200 last:border-b-0">
                      {/* 分组标题和统计 - 可点击展开/收起 */}
                      <div 
                        className="px-6 py-4 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => toggleMonth(groupName)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {/* 展开/收起图标 */}
                            <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}>
                              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                            
                            {/* 月份标题 */}
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold text-gray-900">
                                {(() => {
                                  const [year, month] = groupName.replace('年', '-').replace('月', '').split('-');
                                  return `${year}-${month.padStart(2, '0')}`;
                                })()}
                              </h3>
                              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                {groupRecords.length} records
                              </span>
                            </div>
                          </div>
                          
                          {/* 月份统计 */}
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-green-700 font-medium">
                                {formatCurrency(monthIncome)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                              <span className="text-red-700 font-medium">
                                {formatCurrency(monthExpense)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className={`w-2 h-2 rounded-full ${monthBalance >= 0 ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                              <span className={`font-medium ${monthBalance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                                {formatCurrency(monthBalance)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 可折叠的记录内容 */}
                      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                        isExpanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
                      }`}>
                        {/* 桌面端表格布局 */}
                        <div className="hidden md:block">
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
                                    {editingKey === record.key ? (
                                      <input
                                        type="date"
                                        value={editingRecord?.date || ''}
                                        onChange={(e) => setEditingRecord(prev => ({ ...prev, date: e.target.value }))}
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    ) : (
                                      formatDate(record.date)
                                    )}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap border-r border-gray-300">
                                    {editingKey === record.key ? (
                                      <select
                                        value={editingRecord?.type || 'Income'}
                                        onChange={(e) => setEditingRecord(prev => ({ ...prev, type: e.target.value as 'Income' | 'Expense' }))}
                                        className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                                      >
                                        <option value="Income">Income</option>
                                        <option value="Expense">Expense</option>
                                      </select>
                                    ) : (
                                      <span
                                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                          record.type === 'Income'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                        }`}
                                      >
                                        {record.type === 'Income' ? 'Income' : 'Expense'}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-r border-gray-300">
                                    {editingKey === record.key ? (
                                      <input
                                        type="text"
                                        value={editingRecord?.who || ''}
                                        onChange={(e) => setEditingRecord(prev => ({ ...prev, who: e.target.value }))}
                                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-32 text-gray-900"
                                        placeholder="Name"
                                      />
                                    ) : (
                                      <span className="text-sm text-gray-700">{record.who}</span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate border-r border-gray-300">
                                    {editingKey === record.key ? (
                                      <input
                                        type="text"
                                        value={editingRecord?.description || ''}
                                        onChange={(e) => setEditingRecord(prev => ({ ...prev, description: e.target.value }))}
                                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-32 text-gray-900"
                                        placeholder="Description"
                                      />
                                    ) : (
                                      record.description
                                    )}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium border-r border-gray-300">
                                    {editingKey === record.key ? (
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={editingRecord?.amount || 0}
                                        onChange={(e) => setEditingRecord(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-24 text-gray-900"
                                        placeholder="0.00"
                                      />
                                    ) : (
                                      <span
                                        className={`text-sm font-medium ${
                                          record.type === 'Income' ? 'text-green-600' : 'text-red-600'
                                        }`}
                                      >
                                        {formatCurrency(record.amount)}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap border-r border-gray-300">
                                    <div className="flex items-center gap-2">
                                      {record.status === 'Approved' ? (
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                      ) : (
                                        <Clock className="h-4 w-4 text-yellow-500" />
                                      )}
                                      {(isAdmin || isSuperAdmin) ? (
                                        <select
                                          value={record.status}
                                          onChange={(e) => handleStatusToggle(record.key, e.target.value as 'Pending' | 'Approved')}
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
                                    {editingKey === record.key ? (
                                      <input
                                        type="text"
                                        value={editingRecord?.remark || ''}
                                        onChange={(e) => setEditingRecord(prev => ({ ...prev, remark: e.target.value }))}
                                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-32 text-gray-900"
                                        placeholder="Remark"
                                      />
                                    ) : (
                                      record.remark || '-'
                                    )}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <div className="flex items-center gap-2">
                                      {/* View Details Button */}
                                      <Link
                                        href={`/financial-list/${record.key}`}
                                        className="text-blue-600 hover:text-blue-900 p-1"
                                        title="View record details"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Link>
                                      
                                      <AdminOrSuperAdmin>
                                        {editingKey === record.key ? (
                                          <>
                                            <button
                                              onClick={saveInlineEdit}
                                              className="text-green-600 hover:text-green-900 p-1"
                                            >
                                              <Check className="h-4 w-4" />
                                            </button>
                                            <button
                                              onClick={cancelInlineEdit}
                                              className="text-gray-600 hover:text-gray-900 p-1"
                                            >
                                              <X className="h-4 w-4" />
                                            </button>
                                          </>
                                        ) : (
                                          <button
                                            onClick={() => startInlineEdit(record)}
                                            className="text-blue-600 hover:text-blue-900 p-1"
                                            disabled={deletingKey === record.key}
                                          >
                                            <Edit className="h-4 w-4" />
                                          </button>
                                        )}
                                      </AdminOrSuperAdmin>
                                      <SuperAdminOnly>
                                        <button
                                          onClick={() => handleDelete(record.key)}
                                          disabled={deletingKey === record.key || editingKey === record.key}
                                          className={`p-1 ${
                                            deletingKey === record.key || editingKey === record.key
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

                        {/* 手机端卡片布局 */}
                        <div className="md:hidden">
                          <div className="space-y-4 p-4">
                            {groupRecords.map((record) => (
                              <div key={record.key} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <div className="flex justify-between items-start mb-3">
                                  <div className="flex items-center gap-2">
                                    {editingKey === record.key ? (
                                      <select
                                        value={editingRecord?.type || 'Income'}
                                        onChange={(e) => setEditingRecord(prev => ({ ...prev, type: e.target.value as 'Income' | 'Expense' }))}
                                        className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                                      >
                                        <option value="Income">Income</option>
                                        <option value="Expense">Expense</option>
                                      </select>
                                    ) : (
                                      <span
                                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                          record.type === 'Income'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                        }`}
                                      >
                                        {record.type === 'Income' ? 'Income' : 'Expense'}
                                      </span>
                                    )}
                                    {editingKey === record.key ? (
                                      <input
                                        type="date"
                                        value={editingRecord?.date || ''}
                                        onChange={(e) => setEditingRecord(prev => ({ ...prev, date: e.target.value }))}
                                        className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    ) : (
                                      <span className="text-sm text-gray-500">{formatDate(record.date)}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {record.status === 'Approved' ? (
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <Clock className="h-4 w-4 text-yellow-500" />
                                    )}
                                    {(isAdmin || isSuperAdmin) ? (
                                      <select
                                        value={record.status}
                                        onChange={(e) => handleStatusToggle(record.key, e.target.value as 'Pending' | 'Approved')}
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
                                </div>
                                
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-gray-900">Name:</span>
                                    {editingKey === record.key ? (
                                      <input
                                        type="text"
                                        value={editingRecord?.who || ''}
                                        onChange={(e) => setEditingRecord(prev => ({ ...prev, who: e.target.value }))}
                                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-32 text-gray-900"
                                        placeholder="Name"
                                      />
                                    ) : (
                                      <span className="text-sm text-gray-700">{record.who}</span>
                                    )}
                                  </div>
                                  
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-gray-900">Amount:</span>
                                    {editingKey === record.key ? (
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={editingRecord?.amount || 0}
                                        onChange={(e) => setEditingRecord(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-24 text-gray-900"
                                        placeholder="0.00"
                                      />
                                    ) : (
                                      <span
                                        className={`text-sm font-medium ${
                                          record.type === 'Income' ? 'text-green-600' : 'text-red-600'
                                        }`}
                                      >
                                        {formatCurrency(record.amount)}
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="flex justify-between items-start">
                                    <span className="text-sm font-medium text-gray-900">Description:</span>
                                    {editingKey === record.key ? (
                                      <input
                                        type="text"
                                        value={editingRecord?.description || ''}
                                        onChange={(e) => setEditingRecord(prev => ({ ...prev, description: e.target.value }))}
                                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-32 text-gray-900"
                                        placeholder="Description"
                                      />
                                    ) : (
                                      <span className="text-sm text-gray-700 text-right max-w-[60%]">{record.description}</span>
                                    )}
                                  </div>
                                  
                                  <div className="flex justify-between items-start">
                                    <span className="text-sm font-medium text-gray-900">Remark:</span>
                                    {editingKey === record.key ? (
                                      <input
                                        type="text"
                                        value={editingRecord?.remark || ''}
                                        onChange={(e) => setEditingRecord(prev => ({ ...prev, remark: e.target.value }))}
                                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-32 text-gray-900"
                                        placeholder="Remark"
                                      />
                                    ) : (
                                      <span className="text-sm text-gray-500 text-right max-w-[60%]">{record.remark || '-'}</span>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex justify-end items-center gap-2 mt-4 pt-3 border-t border-gray-200">
                                  {/* View Details Button */}
                                  <Link
                                    href={`/financial-list/${record.key}`}
                                    className="text-blue-600 hover:text-blue-900 p-1"
                                    title="View record details"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Link>
                                  
                                  <AdminOrSuperAdmin>
                                    {editingKey === record.key ? (
                                      <>
                                        <button
                                          onClick={saveInlineEdit}
                                          className="text-green-600 hover:text-green-900 p-1"
                                        >
                                          <Check className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={cancelInlineEdit}
                                          className="text-gray-600 hover:text-gray-900 p-1"
                                        >
                                          <X className="h-4 w-4" />
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        onClick={() => startInlineEdit(record)}
                                        className="text-blue-600 hover:text-blue-900 p-1"
                                        disabled={deletingKey === record.key}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </button>
                                    )}
                                  </AdminOrSuperAdmin>
                                  <SuperAdminOnly>
                                    <button
                                      onClick={() => handleDelete(record.key)}
                                      disabled={deletingKey === record.key || editingKey === record.key}
                                      className={`p-1 ${
                                        deletingKey === record.key || editingKey === record.key
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
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
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

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`px-4 py-3 rounded-md shadow-lg max-w-sm ${
            toast.type === 'success' 
              ? 'bg-green-500 text-white' 
              : 'bg-red-500 text-white'
          }`}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                {toast.type === 'success' ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <X className="h-5 w-5" />
                )}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">{toast.message}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 