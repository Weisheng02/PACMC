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
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [monthlyData, setMonthlyData] = useState<ChartData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [cumulativeData, setCumulativeData] = useState<ChartData[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await readFinancialRecords();
      setRecords(data);
      processChartData(data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
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
    return `$${value.toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <LoggedInUser>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Link href="/" className="mr-4">
                  <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </Link>
                <h1 className="text-xl font-semibold text-gray-900">财务图表分析</h1>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={fetchData}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  刷新数据
                </button>
                <Link
                  href="/financial-list"
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <DollarSign className="h-4 w-4" />
                  查看记录
                </Link>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">总收入</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    ${records.filter(r => r.type === 'Income').reduce((sum, r) => sum + (Number(r.amount) || 0), 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">总支出</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    ${records.filter(r => r.type === 'Expense').reduce((sum, r) => sum + (Number(r.amount) || 0), 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">当前结余</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    ${(records.filter(r => r.type === 'Income').reduce((sum, r) => sum + (Number(r.amount) || 0), 0) - 
                       records.filter(r => r.type === 'Expense').reduce((sum, r) => sum + (Number(r.amount) || 0), 0)).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Calendar className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">记录总数</p>
                  <p className="text-2xl font-semibold text-gray-900">{records.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  月度收支图
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
                  <Bar dataKey="income" fill="#10B981" name="收入" />
                  <Bar dataKey="expense" fill="#EF4444" name="支出" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  累积结余图
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
                    name="累积结余"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  类别支出比例图
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