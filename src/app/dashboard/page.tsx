'use client';
import { useState, useEffect } from 'react';
import { LoggedInUser } from '@/components/PermissionGate';
import { useAuth } from '@/contexts/AuthContext';
import { readFinancialRecords, FinancialRecord } from '@/lib/googleSheets';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { BarChart3, PieChart as PieChartIcon, TrendingUp, DollarSign, Calendar, RefreshCw, ArrowLeft, Download, Filter, X as XIcon } from 'lucide-react';
import Link from 'next/link';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

interface ChartData {
  month: string;
  income: number;
  expense: number;
  balance: number;
}

interface CategoryData {
  name: string;
  value: number;
}

export default function DashboardPage() {
  const { userProfile: _userProfile } = useAuth();
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [monthlyData, setMonthlyData] = useState<ChartData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [cumulativeData, setCumulativeData] = useState<ChartData[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    setRefreshing(true);
    try {
      const data = await readFinancialRecords();
      setRecords(data);
      processChartData(data);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('An error occurred while fetching data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLastRefreshTime(new Date());
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const processChartData = (data: FinancialRecord[]) => {
    const monthlyMap = new Map<string, { income: number; expense: number }>();
    
    data.forEach(record => {
      if (!record.date) return;
      
      let monthKey = '';
      try {
        if (typeof record.date === 'number') {
          const googleSheetsEpoch = new Date(1900, 0, 1);
          const date = new Date(googleSheetsEpoch.getTime() + (record.date - 2) * 24 * 60 * 60 * 1000);
          monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } else if (typeof record.date === 'string') {
          const date = new Date(record.date);
          if (!isNaN(date.getTime())) {
            monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          } else {
            const parts = record.date.split('/');
            if (parts.length === 3) {
              monthKey = `${parts[2]}-${parts[1].padStart(2, '0')}`;
            }
          }
        }
      } catch {
        return;
      }

      if (!monthKey) return;

      const current = monthlyMap.get(monthKey) || { income: 0, expense: 0 };
      if (record.type === 'Income') {
        current.income += Number(record.amount) || 0;
      } else {
        current.expense += Number(record.amount) || 0;
      }
      monthlyMap.set(monthKey, current);
    });

    const monthlyChartData: ChartData[] = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        income: data.income,
        expense: data.expense,
        balance: data.income - data.expense,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    setMonthlyData(monthlyChartData);

    let cumulativeBalance = 0;
    const cumulativeChartData: ChartData[] = monthlyChartData.map(item => {
      cumulativeBalance += item.balance;
      return {
        ...item,
        balance: cumulativeBalance,
      };
    });
    setCumulativeData(cumulativeChartData);

    if (monthlyChartData.length > 0) {
      const latestMonth = monthlyChartData[monthlyChartData.length - 1].month;
      setSelectedMonth(latestMonth);
      processCategoryData(data, latestMonth);
    }
  };

  const processCategoryData = (data: FinancialRecord[], month: string) => {
    const categoryMap = new Map<string, number>();
    
    data.forEach(record => {
      if (!record.date || record.type !== 'Expense') return;
      
      let recordMonth = '';
      try {
        if (typeof record.date === 'number') {
          const googleSheetsEpoch = new Date(1900, 0, 1);
          const date = new Date(googleSheetsEpoch.getTime() + (record.date - 2) * 24 * 60 * 60 * 1000);
          recordMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } else if (typeof record.date === 'string') {
          const date = new Date(record.date);
          if (!isNaN(date.getTime())) {
            recordMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          } else {
            const parts = record.date.split('/');
            if (parts.length === 3) {
              recordMonth = `${parts[2]}-${parts[1].padStart(2, '0')}`;
            }
          }
        }
      } catch {
        return;
      }

      if (recordMonth === month) {
        const category = record.description || '其他';
        const current = categoryMap.get(category) || 0;
        categoryMap.set(category, current + (Number(record.amount) || 0));
      }
    });

    const categoryChartData: CategoryData[] = Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    setCategoryData(categoryChartData);
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    processCategoryData(records, month);
  };

  const formatMonth = (month: string) => {
    const [year, monthNum] = month.split('-');
    return `${year}年${monthNum}月`;
  };

  const formatCurrency = (value: number) => {
    return `RM${value.toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Dashboard</h3>
          <p className="text-gray-600">Please wait while we prepare your financial overview...</p>
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
          <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to Load Dashboard</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchData}
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
    <LoggedInUser>
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-50 bg-white shadow-sm border-b">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center h-auto sm:h-16 py-4 sm:py-0">
              <div className="flex items-center mb-4 sm:mb-0">
                <Link href="/" className="mr-4">
                  <ArrowLeft className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600" />
                </Link>
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
                  <span className="hidden sm:inline">Financial Dashboard</span>
                  <span className="sm:hidden">Dashboard</span>
                </h1>
              </div>
              
              {/* Desktop buttons */}
              <div className="hidden sm:flex items-center gap-4">
                <button
                  onClick={fetchData}
                  disabled={refreshing}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {refreshing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {refreshing ? 'Refreshing...' : 'Refresh Data'}
                </button>
                {lastRefreshTime && (
                  <span className="text-xs text-gray-500">
                    Last updated: {lastRefreshTime.toLocaleTimeString()}
                  </span>
                )}
                <Link
                  href="/financial-list"
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <DollarSign className="h-4 w-4" />
                  View Records
                </Link>
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
                  onClick={fetchData}
                  disabled={refreshing}
                  className="flex items-center justify-center w-10 h-10 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={refreshing ? 'Refreshing...' : 'Refresh Data'}
                >
                  {refreshing ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
                  ) : (
                    <RefreshCw className="h-5 w-5" />
                  )}
                </button>
                <Link
                  href="/financial-list"
                  className="flex items-center justify-center w-10 h-10 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  title="View Records"
                >
                  <DollarSign className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
        </header>

        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
                <div className="ml-3 sm:ml-4 min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Total Income</p>
                  <p className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-semibold text-gray-900 whitespace-nowrap truncate">
                    {formatCurrency(records.filter(r => r.type === 'Income').reduce((sum, r) => sum + (Number(r.amount) || 0), 0))}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-2 bg-red-100 rounded-lg">
                  <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                </div>
                <div className="ml-3 sm:ml-4 min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Total Expense</p>
                  <p className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-semibold text-gray-900 whitespace-nowrap truncate">
                    {formatCurrency(records.filter(r => r.type === 'Expense').reduce((sum, r) => sum + (Number(r.amount) || 0), 0))}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-2 bg-blue-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
                <div className="ml-3 sm:ml-4 min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Balance</p>
                  <p className={`text-sm sm:text-lg lg:text-xl xl:text-2xl font-semibold whitespace-nowrap truncate ${records.filter(r => r.type === 'Income').reduce((sum, r) => sum + (Number(r.amount) || 0), 0) - records.filter(r => r.type === 'Expense').reduce((sum, r) => sum + (Number(r.amount) || 0), 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {formatCurrency(records.filter(r => r.type === 'Income').reduce((sum, r) => sum + (Number(r.amount) || 0), 0) - records.filter(r => r.type === 'Expense').reduce((sum, r) => sum + (Number(r.amount) || 0), 0))}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-2 bg-purple-100 rounded-lg">
                  <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                </div>
                <div className="ml-3 sm:ml-4 min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Total Records</p>
                  <p className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-semibold text-gray-900 truncate">{records.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Monthly Trend
                </h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="month" 
                    tickFormatter={formatMonth}
                    fontSize={12}
                  />
                  <YAxis 
                    tickFormatter={formatCurrency}
                    fontSize={12}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), '']}
                    labelFormatter={formatMonth}
                  />
                  <Legend />
                  <Bar dataKey="income" fill="#10B981" name="Income" />
                  <Bar dataKey="expense" fill="#EF4444" name="Expense" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Cumulative Balance
                </h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={cumulativeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="month" 
                    tickFormatter={formatMonth}
                    fontSize={12}
                  />
                  <YAxis 
                    tickFormatter={formatCurrency}
                    fontSize={12}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), '']}
                    labelFormatter={formatMonth}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="balance" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    name="Cumulative Balance"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Category Distribution
                </h2>
                <select
                  value={selectedMonth}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  {monthlyData.map((item) => (
                    <option key={item.month} value={item.month}>
                      {formatMonth(item.month)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [formatCurrency(value), '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </LoggedInUser>
  );
} 