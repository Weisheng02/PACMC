'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { LoggedInUser } from '@/components/PermissionGate';
import { ArrowLeft, Download, FileText, BarChart3, Calendar, Filter } from 'lucide-react';
import Link from 'next/link';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { readFinancialRecords, FinancialRecord } from '@/lib/googleSheets';

export default function ExportPage() {
  const router = useRouter();
  const { userProfile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<FinancialRecord[]>([]);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [exportType, setExportType] = useState<'all' | 'income' | 'expense'>('all');
  const [error, setError] = useState<string | null>(null);

  // 获取财务记录
  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const data = await readFinancialRecords();
        setRecords(data || []);
      } catch (error) {
        console.error('获取记录失败:', error);
        setError('加载财务数据失败，请稍后重试。');
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, []);

  // 过滤记录
  useEffect(() => {
    let filtered = records.filter(record => {
      const recordDate = new Date(record.date);
      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);
      
      return recordDate >= startDate && recordDate <= endDate;
    });

    if (exportType === 'income') {
      filtered = filtered.filter(record => record.type === 'Income');
    } else if (exportType === 'expense') {
      filtered = filtered.filter(record => record.type === 'Expense');
    }

    setFilteredRecords(filtered);
  }, [records, dateRange, exportType]);

  // 导出 PDF
  const exportToPDF = async () => {
    setLoading(true);
    try {
      // 计算统计数据
      const totalIncome = filteredRecords.filter(r => r.type === 'Income').reduce((sum, r) => sum + r.amount, 0);
      const totalExpense = filteredRecords.filter(r => r.type === 'Expense').reduce((sum, r) => sum + r.amount, 0);
      const balance = totalIncome - totalExpense;
      const approvedRecords = filteredRecords.filter(r => r.status === 'Approved').length;
      const pendingRecords = filteredRecords.filter(r => r.status === 'Pending').length;
      
      // 按月份分组统计
      const monthlyStats = filteredRecords.reduce((acc, record) => {
        const month = new Date(record.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        if (!acc[month]) {
          acc[month] = { income: 0, expense: 0, count: 0 };
        }
        if (record.type === 'Income') {
          acc[month].income += record.amount;
        } else {
          acc[month].expense += record.amount;
        }
        acc[month].count += 1;
        return acc;
      }, {} as Record<string, { income: number; expense: number; count: number }>);

      // Create PDF content with better styling and more information
      const pdfContent = `
        <div style="font-family: 'Arial', 'Helvetica', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background-color: white; color: #333;">
          <!-- Header with Logo and Title -->
          <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2563eb; padding-bottom: 20px;">
            <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 15px;">
              <img src="/logo.jpg" alt="PACMC Logo" style="width: 50px; height: 50px; border-radius: 50%; margin-right: 15px; object-fit: cover;" />
              <h1 style="color: #1f2937; margin: 0; font-size: 28px; font-weight: bold;">PACMC Youth Fellowship</h1>
            </div>
            <h2 style="color: #6b7280; margin: 10px 0; font-size: 20px;">Financial Report</h2>
            <div style="font-size: 12px; color: #6b7280; line-height: 1.5;">
              <strong>Report Period:</strong> ${new Date(dateRange.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} - ${new Date(dateRange.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}<br>
              <strong>Generated:</strong> ${new Date().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}<br>
              <strong>Total Records:</strong> ${filteredRecords.length} | <strong>Type:</strong> ${exportType === 'all' ? 'All Records' : exportType === 'income' ? 'Income Only' : 'Expense Only'}
            </div>
          </div>

          <!-- Summary Statistics -->
          <div style="margin-bottom: 30px;">
            <h3 style="color: #1f2937; margin-bottom: 20px; font-size: 18px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Summary Statistics</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
              <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #bbf7d0; border-radius: 10px;">
                <div style="font-size: 24px; font-weight: bold; color: #166534; margin-bottom: 5px;">
                  RM${totalIncome.toFixed(2)}
                </div>
                <div style="font-size: 14px; color: #166534; font-weight: 500;">Total Income</div>
              </div>
              <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border: 2px solid #fecaca; border-radius: 10px;">
                <div style="font-size: 24px; font-weight: bold; color: #991b1b; margin-bottom: 5px;">
                  RM${totalExpense.toFixed(2)}
                </div>
                <div style="font-size: 14px; color: #991b1b; font-weight: 500;">Total Expense</div>
              </div>
              <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 2px solid #bfdbfe; border-radius: 10px;">
                <div style="font-size: 24px; font-weight: bold; color: #1e40af; margin-bottom: 5px;">
                  RM${balance.toFixed(2)}
                </div>
                <div style="font-size: 14px; color: #1e40af; font-weight: 500;">Net Balance</div>
              </div>
              <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); border: 2px solid #e9d5ff; border-radius: 10px;">
                <div style="font-size: 24px; font-weight: bold; color: #7c3aed; margin-bottom: 5px;">
                  ${filteredRecords.length}
                </div>
                <div style="font-size: 14px; color: #7c3aed; font-weight: 500;">Total Records</div>
              </div>
            </div>
            
            <!-- Status Breakdown -->
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
              <div style="text-align: center; padding: 15px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
                <div style="font-size: 20px; font-weight: bold; color: #166534;">${approvedRecords}</div>
                <div style="font-size: 12px; color: #166534;">Approved Records</div>
              </div>
              <div style="text-align: center; padding: 15px; background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 8px;">
                <div style="font-size: 20px; font-weight: bold; color: #d97706;">${pendingRecords}</div>
                <div style="font-size: 12px; color: #d97706;">Pending Records</div>
              </div>
            </div>
          </div>

          <!-- Monthly Breakdown -->
          ${Object.keys(monthlyStats).length > 0 ? `
          <div style="margin-bottom: 30px;">
            <h3 style="color: #1f2937; margin-bottom: 15px; font-size: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Monthly Breakdown</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 15px;">
              <thead>
                <tr style="background-color: #f8fafc;">
                  <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-weight: bold;">Month</th>
                  <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold;">Income</th>
                  <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold;">Expense</th>
                  <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold;">Balance</th>
                  <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">Records</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(monthlyStats).map(([month, stats]) => `
                  <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: 500;">${month}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #166534;">RM${stats.income.toFixed(2)}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #991b1b;">RM${stats.expense.toFixed(2)}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: ${stats.income - stats.expense >= 0 ? '#166534' : '#991b1b'}; font-weight: 500;">RM${(stats.income - stats.expense).toFixed(2)}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${stats.count}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          <!-- Detailed Records Table -->
          <div>
            <h3 style="color: #1f2937; margin-bottom: 15px; font-size: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Detailed Records</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
              <thead>
                <tr style="background-color: #f8fafc;">
                  <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left; font-weight: bold; font-size: 10px;">Date</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left; font-weight: bold; font-size: 10px;">Type</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: bold; font-size: 10px;">Amount</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left; font-weight: bold; font-size: 10px;">Description</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left; font-weight: bold; font-size: 10px;">Created By</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-weight: bold; font-size: 10px;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${filteredRecords.map((record, index) => `
                  <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                    <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 10px;">${new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 10px; color: ${record.type === 'Income' ? '#166534' : '#991b1b'}; font-weight: 500;">
                      ${record.type === 'Income' ? 'Income' : 'Expense'}
                    </td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-size: 10px; font-weight: 500;">RM${record.amount.toFixed(2)}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 10px; max-width: 150px; word-wrap: break-word;">${record.description || '-'}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 10px;">${record.createdBy || 'Unknown'}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-size: 10px; color: ${record.status === 'Approved' ? '#166534' : '#d97706'}; font-weight: 500;">
                      ${record.status === 'Approved' ? 'Approved' : 'Pending'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Footer -->
          <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; font-size: 10px; color: #6b7280;">
            <p>This report was generated automatically by PACMC Financial Management System</p>
            <p>For any questions, please contact the system administrator</p>
          </div>
        </div>
      `;

      // 将内容添加到页面（隐藏）
      const pdfContentElement = document.createElement('div');
      pdfContentElement.style.position = 'absolute';
      pdfContentElement.style.left = '-9999px';
      pdfContentElement.style.top = '0';
      pdfContentElement.style.width = '800px';
      pdfContentElement.style.backgroundColor = 'white';
      pdfContentElement.innerHTML = pdfContent;
      document.body.appendChild(pdfContentElement);

      // 转换为 PDF
      const canvas = await html2canvas(pdfContentElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 800,
        height: pdfContentElement.scrollHeight,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // 下载 PDF with English filename
      const fileName = `PACMC_Financial_Report_${dateRange.startDate}_${dateRange.endDate}.pdf`;
      pdf.save(fileName);

      // 清理
      document.body.removeChild(pdfContentElement);
    } catch (error) {
      console.error('Export PDF failed:', error);
      alert('Export PDF failed, please try again');
    } finally {
      setLoading(false);
    }
  };

  // 导出 Excel
  const exportToExcel = () => {
    setLoading(true);
    try {
      // 准备数据
      const excelData = filteredRecords.map(record => ({
        'Key': record.key,
        'Account': record.account,
        'Date': record.date,
        'Type': record.type === 'Income' ? '收入' : '支出',
        'Who': record.who,
        'Amount': record.amount,
        'Description': record.description,
        'Status': record.status,
        'Take/Put': record.takePut ? 'TRUE' : 'FALSE',
        'Remark': record.remark,
        'Created Date': record.createdDate,
        'Created By': record.createdBy,
        'Approved Date': record.approvedDate,
        'Approved By': record.approvedBy,
        'Last User Update': record.lastUserUpdate,
        'Last Date Update': record.lastDateUpdate,
      }));

      // 创建工作簿
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // 设置列宽
      const colWidths = [
        { wch: 10 }, // Key
        { wch: 8 },  // Account
        { wch: 12 }, // Date
        { wch: 8 },  // Type
        { wch: 12 }, // Who
        { wch: 12 }, // Amount
        { wch: 30 }, // Description
        { wch: 10 }, // Status
        { wch: 10 }, // Take/Put
        { wch: 20 }, // Remark
        { wch: 20 }, // Created Date
        { wch: 15 }, // Created By
        { wch: 20 }, // Approved Date
        { wch: 15 }, // Approved By
        { wch: 15 }, // Last User Update
        { wch: 20 }, // Last Date Update
      ];
      ws['!cols'] = colWidths;

      // 添加工作表
      XLSX.utils.book_append_sheet(wb, ws, '财务记录');

      // 下载文件
      const fileName = `PACMC_Financial_Records_${dateRange.startDate}_${dateRange.endDate}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error('导出 Excel 失败:', error);
      alert('导出 Excel 失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoggedInUser>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Link href="/" className="mr-4">
                  <ArrowLeft className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600" />
                </Link>
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
                  <span className="hidden sm:inline">Report Export</span>
                  <span className="sm:hidden">Export</span>
                </h1>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
          {/* Filter Settings */}
          <div className="bg-white shadow-sm border rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Filter className="h-5 w-5 mr-2" />
              Filter Settings
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Record Type</label>
                <select
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value as 'all' | 'income' | 'expense')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                >
                  <option value="all">All Records</option>
                  <option value="income">Income Only</option>
                  <option value="expense">Expense Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="bg-white shadow-sm border rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Statistics
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-bold text-blue-600 truncate">{filteredRecords.length}</div>
                <div className="text-xs sm:text-sm text-gray-600 truncate">Record Count</div>
              </div>
              
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-bold text-green-600 truncate">
                  RM${filteredRecords.filter(r => r.type === 'Income').reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 truncate">Total Income</div>
              </div>
              
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-bold text-red-600 truncate">
                  RM${filteredRecords.filter(r => r.type === 'Expense').reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 truncate">Total Expense</div>
              </div>
              
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-bold text-purple-600 truncate">
                  RM${(filteredRecords.filter(r => r.type === 'Income').reduce((sum, r) => sum + r.amount, 0) - 
                     filteredRecords.filter(r => r.type === 'Expense').reduce((sum, r) => sum + r.amount, 0)).toFixed(2)}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 truncate">Balance</div>
              </div>
            </div>
          </div>

          {/* Export Options */}
          <div className="bg-white shadow-sm border rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Download className="h-5 w-5 mr-2" />
              Export Options
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* PDF Export */}
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <FileText className="h-8 w-8 text-red-600 mr-3" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">PDF Report</h3>
                    <p className="text-sm text-gray-500">Includes statistics and detailed records</p>
                  </div>
                </div>
                <button
                  onClick={exportToPDF}
                  disabled={loading || filteredRecords.length === 0}
                  className="w-full flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  {loading ? 'Generating...' : 'Export PDF'}
                </button>
              </div>

              {/* Excel Export */}
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <BarChart3 className="h-8 w-8 text-green-600 mr-3" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Excel File</h3>
                    <p className="text-sm text-gray-500">Raw data format for further analysis</p>
                  </div>
                </div>
                <button
                  onClick={exportToExcel}
                  disabled={loading || filteredRecords.length === 0}
                  className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <BarChart3 className="h-4 w-4 mr-2" />
                  )}
                  {loading ? 'Generating...' : 'Export Excel'}
                </button>
              </div>
            </div>

            {filteredRecords.length === 0 && (
              <div className="mt-4 text-center text-gray-500">
                No records available for export under current filter conditions
              </div>
            )}
          </div>
        </main>
      </div>
    </LoggedInUser>
  );
} 