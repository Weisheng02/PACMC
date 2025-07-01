'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AdminOrSuperAdmin, SuperAdminOnly } from '@/components/PermissionGate';
import { readFinancialRecords, deleteFinancialRecord, FinancialRecord, formatGoogleSheetsDate } from '@/lib/googleSheets';
import { DollarSign, Plus, Trash2, RefreshCw, CheckCircle, Clock, Wallet, Settings, Users, Search, Check, X, Eye, ArrowLeft, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
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
  
  // 1. 新增年份和月份筛选状态
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  
  // 新增月份内排序状态
  const [monthSortOrder, setMonthSortOrder] = useState<'asc' | 'desc'>('desc'); // 默认从新到旧

  // 2. 计算所有有数据的年份和每年有数据的月份
  const yearMonthMap = records.reduce((acc, record) => {
    const dateStr = record.date?.split(' ')[0] || '';
    const [year, month] = dateStr.split('-');
    if (year && month) {
      if (!acc[year]) acc[year] = new Set();
      acc[year].add(month);
    }
    return acc;
  }, {} as Record<string, Set<string>>);
  const allYears = Object.keys(yearMonthMap).sort((a, b) => b.localeCompare(a));
  const monthsOfYear = selectedYear && yearMonthMap[selectedYear] ? Array.from(yearMonthMap[selectedYear]).sort((a, b) => a.localeCompare(b)) : [];

  // 3. 默认选中当前年月
  useEffect(() => {
    if (!selectedYear && allYears.length > 0) {
      setSelectedYear(allYears[0]);
    }
  }, [allYears, selectedYear]);
  useEffect(() => {
    if (selectedYear && monthsOfYear.length > 0 && !monthsOfYear.includes(selectedMonth)) {
      setSelectedMonth(monthsOfYear[0]);
    }
  }, [selectedYear, monthsOfYear, selectedMonth]);

  // 4. 只显示当前选中年月的记录，并按日期排序
  type YM = { year: string, month: string };
  const getYM = (dateStr: string): YM => {
    const [year, month] = (dateStr?.split(' ')[0] || '').split('-');
    return { year, month };
  };
  const filteredRecordsByYM = records.filter(r => {
    const { year, month } = getYM(r.date);
    return year === selectedYear && month === selectedMonth;
  }).sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return monthSortOrder === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
  });

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

  // 计算当前选中年月的收入、支出和余额
  const currentMonthIncome = filteredRecordsByYM.filter(r => r.type === 'Income').reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const currentMonthExpense = filteredRecordsByYM.filter(r => r.type === 'Expense').reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const currentMonthBalance = currentMonthIncome - currentMonthExpense;

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
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b dark:bg-slate-800 dark:border-slate-700">
        <div className="w-full px-3 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center h-auto sm:h-16 py-3 sm:py-0">
            <div className="flex items-center mb-3 sm:mb-0">
              <Link href="/" className="mr-3 sm:mr-4">
                <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-gray-600 dark:text-slate-400" />
              </Link>
              <h1 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-slate-100">
                <span className="hidden sm:inline">Financial Records</span>
                <span className="sm:hidden">Records</span>
              </h1>
            </div>
            
            {/* Desktop buttons */}
            <div className="hidden sm:flex items-center gap-3 sm:gap-4">
              <button
                onClick={loadRecords}
                disabled={refreshing}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:text-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"
              >
                {refreshing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 dark:border-slate-400"></div>
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              {lastRefreshTime && (
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  Last: {lastRefreshTime.toLocaleTimeString()}
                </span>
              )}
              <Link
                href="/add-record"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add Record
              </Link>
              <button
                onClick={() => setShowCashModal(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-yellow-600 border border-transparent rounded-md hover:bg-yellow-700"
              >
                <Wallet className="h-4 w-4" />
                Set Cash
              </button>
            </div>

            {/* Mobile buttons - simplified */}
            <div className="flex items-center gap-2 w-full sm:hidden">
              <Link
                href="/"
                className="flex items-center justify-center w-10 h-10 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:text-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"
                title="Back to Home"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <button
                onClick={loadRecords}
                disabled={refreshing}
                className="flex items-center justify-center w-10 h-10 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:text-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"
                title={refreshing ? 'Refreshing...' : 'Refresh Data'}
              >
                {refreshing ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600 dark:border-slate-400"></div>
                ) : (
                  <RefreshCw className="h-5 w-5" />
                )}
              </button>
              <Link
                href="/add-record"
                className="flex items-center justify-center w-10 h-10 text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                title="Add Record"
              >
                <Plus className="h-5 w-5" />
              </Link>
              <button
                onClick={() => setShowCashModal(true)}
                className="flex items-center justify-center w-10 h-10 text-white bg-yellow-600 border border-transparent rounded-md hover:bg-yellow-700"
                title="Set Cash"
              >
                <Wallet className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Toast Notification */}
        {toast && (
          <div className="fixed top-4 right-4 z-50">
            <div className={`px-3 py-2 rounded-md shadow-lg text-sm ${
              toast.type === 'success' 
                ? 'bg-green-500 text-white' 
                : 'bg-red-500 text-white'
            }`}>
              {toast.message}
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-green-100 border-l-4 border-green-600 rounded-lg p-3 sm:p-6 flex items-center shadow-sm dark:bg-green-100 dark:border-green-600">
            <div className="flex-shrink-0 p-2 bg-green-200 rounded-lg dark:bg-green-200">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-6 text-green-700 dark:text-green-700" />
            </div>
            <div className="ml-2 sm:ml-4 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-green-800 dark:text-green-800 truncate">Total Income</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-green-500 dark:text-green-900 whitespace-nowrap truncate">{formatCurrency(currentMonthIncome)}</p>
              <p className="text-xs text-green-700 dark:text-green-700 mt-1">for {selectedYear}-{selectedMonth}</p>
            </div>
          </div>
          <div className="bg-red-100 border-l-4 border-red-600 rounded-lg p-3 sm:p-6 flex items-center shadow-sm dark:bg-red-100 dark:border-red-600">
            <div className="flex-shrink-0 p-2 bg-red-200 rounded-lg dark:bg-red-200">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-6 text-red-700 dark:text-red-700" />
            </div>
            <div className="ml-2 sm:ml-4 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-red-800 dark:text-red-800 truncate">Total Expense</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-red-500 dark:text-red-500 whitespace-nowrap truncate">{formatCurrency(currentMonthExpense)}</p>
              <p className="text-xs text-red-700 dark:text-red-700 mt-1">for {selectedYear}-{selectedMonth}</p>
            </div>
          </div>
          <div className="bg-blue-100 border-l-4 border-blue-600 rounded-lg p-3 sm:p-6 flex items-center shadow-sm dark:bg-blue-100 dark:border-blue-600">
            <div className="flex-shrink-0 p-2 bg-blue-200 rounded-lg dark:bg-blue-200">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-6 text-blue-700 dark:text-blue-700" />
            </div>
            <div className="ml-2 sm:ml-4 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-blue-800 dark:text-blue-800 truncate">Balance</p>
              <p className={`text-lg sm:text-xl lg:text-2xl font-bold whitespace-nowrap truncate ${currentMonthBalance >= 0 ? 'text-blue-500 dark:text-blue-900' : 'text-red-700 dark:text-red-200'}`}>{formatCurrency(currentMonthBalance)}</p>
              <p className="text-xs text-blue-700 dark:text-blue-700 mt-1">for {selectedYear}-{selectedMonth}</p>
            </div>
          </div>
          <div className="bg-yellow-100 border-l-4 border-yellow-500 rounded-lg p-3 sm:p-6 flex items-center shadow-sm dark:bg-yellow-100 dark:border-yellow-500">
            <div className="flex-shrink-0 p-2 bg-yellow-200 rounded-lg dark:bg-yellow-200">
              <Wallet className="h-4 w-4 sm:h-5 sm:w-6 text-yellow-700 dark:text-yellow-700" />
            </div>
            <div className="ml-2 sm:ml-4 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-yellow-800 dark:text-yellow-800 truncate">Cash in Hand</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-yellow-900 dark:text-yellow-900 whitespace-nowrap truncate">{formatCurrency(cashInHand)}</p>
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
        <div className="bg-white shadow-sm border rounded-lg overflow-hidden dark:bg-slate-800 dark:border-slate-700">
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-slate-600">
              <span className="text-sm sm:text-base font-medium text-gray-900 dark:text-slate-100">Select Year and Month</span>
            <div className="mt-3 sm:mt-4 flex flex-wrap justify-center items-center gap-2 bg-white/80 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-lg p-2 sm:p-3 shadow-sm">
              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="px-2 sm:px-3 py-1 sm:py-2 border rounded-md text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
                {allYears.map(y => <option key={y} value={y}>{y}</option>)} 
              </select>
              <div className="flex flex-wrap gap-1">
                {monthsOfYear.map(m => (
                  <button
                    key={m}
                    onClick={() => setSelectedMonth(m)}
                    className={`px-2 py-1 rounded-md text-xs sm:text-sm border transition-colors duration-150 ${selectedMonth === m ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              
              {/* 月份内排序按钮 */}
              <button
                onClick={() => setMonthSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs sm:text-sm border transition-colors duration-150 bg-white text-gray-700 border-gray-300 hover:bg-blue-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                title={monthSortOrder === 'asc' ? 'Sort: Oldest to Newest' : 'Sort: Newest to Oldest'}
              >
                {monthSortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                <span>{monthSortOrder === 'asc' ? 'Sort' : 'Sort'}</span>
              </button>
              
              <button
                onClick={() => setShowAdvancedSearch(v => !v)}
                className="text-xs px-2 sm:px-3 py-1 border rounded-md text-gray-600 bg-gray-100 hover:bg-blue-600 hover:text-white transition-colors duration-150 ml-1 sm:ml-2 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
              >
                Advanced Search
              </button>
            </div>

            {/* 高级搜索面板 */}
            {showAdvancedSearch && (
              <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-gray-50 dark:bg-slate-700 rounded-lg border dark:border-slate-600">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {/* 关键词搜索 */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Keyword Search</label>
                    <input
                      type="text"
                      value={searchFilters.keyword}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, keyword: e.target.value }))}
                      placeholder="Search in description, who, remark..."
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-600 dark:border-slate-500 dark:text-slate-100"
                    />
                  </div>

                  {/* 类型筛选 */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Type</label>
                    <select
                      value={searchFilters.type}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, type: e.target.value as any }))}
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-600 dark:border-slate-500 dark:text-slate-100"
                    >
                      <option value="all">All Types</option>
                      <option value="Income">Income</option>
                      <option value="Expense">Expense</option>
                    </select>
                  </div>

                  {/* 状态筛选 */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Status</label>
                    <select
                      value={searchFilters.status}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-600 dark:border-slate-500 dark:text-slate-100"
                    >
                      <option value="all">All Status</option>
                      <option value="Pending">Pending</option>
                      <option value="Approved">Approved</option>
                    </select>
                  </div>

                  {/* 日期范围 */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Date From</label>
                    <input
                      type="date"
                      value={searchFilters.dateFrom}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-600 dark:border-slate-500 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Date To</label>
                    <input
                      type="date"
                      value={searchFilters.dateTo}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-600 dark:border-slate-500 dark:text-slate-100"
                    />
                  </div>

                  {/* 金额范围 */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Amount From</label>
                    <input
                      type="number"
                      value={searchFilters.amountFrom}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, amountFrom: e.target.value }))}
                      placeholder="0.00"
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-600 dark:border-slate-500 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Amount To</label>
                    <input
                      type="number"
                      value={searchFilters.amountTo}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, amountTo: e.target.value }))}
                      placeholder="0.00"
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-600 dark:border-slate-500 dark:text-slate-100"
                    />
                  </div>

                  {/* 账户筛选 */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Account</label>
                    <select
                      value={searchFilters.account}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, account: e.target.value as any }))}
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-600 dark:border-slate-500 dark:text-slate-100"
                    >
                      <option value="all">All Accounts</option>
                      <option value="MIYF">MIYF</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                {/* 搜索操作按钮 */}
                <div className="mt-3 sm:mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={clearAllFilters}
                    className="px-3 py-1 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:text-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={saveCurrentSearch}
                    className="px-3 py-1 sm:py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                  >
                    Save Search
                  </button>
                </div>

                {/* 保存的搜索 */}
                {savedSearches.length > 0 && (
                  <div className="mt-3 sm:mt-4">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Saved Searches</label>
                    <div className="flex flex-wrap gap-2">
                      {savedSearches.map((savedSearch) => (
                        <div key={savedSearch.id} className="flex items-center gap-1">
                          <button
                            onClick={() => loadSavedSearch(savedSearch)}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200"
                          >
                            {savedSearch.name}
                          </button>
                          <button
                            onClick={() => deleteSavedSearch(savedSearch.id)}
                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
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
              {/* 4. 只显示当前选中年月的记录 */}
              {filteredRecordsByYM.length > 0 ? (
                <div className="overflow-x-auto">
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
                        {filteredRecordsByYM.map((record) => (
                          <tr key={record.key} className="hover:bg-gray-50 border-b border-gray-300">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-r border-gray-300">
                              {record.date?.split(' ')[0]}
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
                              {formatCurrency(record.amount)}
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
                              {record.remark || '-'}
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
                                
                                <SuperAdminOnly>
                                  <button
                                    onClick={() => handleDelete(record.key)}
                                    disabled={deletingKey === record.key}
                                    className={`p-1 ${
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

                  {/* 手机端卡片布局 */}
                  <div className="md:hidden">
                    <div className="space-y-4 p-2">
                      {filteredRecordsByYM.map((record) => (
                        <div key={record.key} className="bg-gray-50 rounded-lg p-3 border border-gray-200 flex flex-col gap-2">
                          {/* 第一行：类型+金额 */}
                          <div className="flex justify-between items-center">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${record.type === 'Income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{record.type === 'Income' ? 'Income' : 'Expense'}</span>
                            <span className={`font-bold text-right whitespace-nowrap ${record.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(record.amount)}</span>
                          </div>
                          {/* 第二行：Date */}
                          <div className="text-xs text-gray-500 mt-1"><span className="font-medium">Date:</span> {record.date?.split(' ')[0]}</div>
                          {/* 第三行：Name */}
                          <div className="text-xs text-gray-500 mt-1"><span className="font-medium">Name:</span> {record.who}</div>
                          {/* 第四行：Description */}
                          <div className="text-xs text-gray-500 mt-1"><span className="font-medium">Description:</span> {record.description}</div>
                          {/* 第五行：Remark（如有） */}
                          {record.remark && <div className="text-xs text-gray-400 mt-1"><span className="font-medium">Remark:</span> {record.remark}</div>}
                          {/* 操作按钮区 */}
                          <div className="flex gap-2 mt-2">
                            <Link href={`/financial-list/${record.key}`} className="text-blue-600 hover:text-blue-900 p-1"><Eye className="h-4 w-4" /></Link>
                            <SuperAdminOnly>
                              <button onClick={() => handleDelete(record.key)} disabled={deletingKey === record.key} className={`p-1 ${deletingKey === record.key ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:text-red-900'}`}>{deletingKey === record.key ? (<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>) : (<Trash2 className="h-4 w-4" />)}</button>
                            </SuperAdminOnly>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-6 py-12 text-center">
                  <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No Records</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {isAdmin || isSuperAdmin ? 'Click "Add Record" to start adding' : 'Waiting for admin to add records'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

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