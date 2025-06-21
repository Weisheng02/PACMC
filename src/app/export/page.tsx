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
      // Create PDF content
      const pdfContent = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
          <!-- Add title and logo -->
          <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px;">
            <h1 style="color: #1f2937; margin-bottom: 10px;">PACMC Youth Fellowship</h1>
            <h2 style="color: #6b7280; margin-bottom: 20px;">Financial Report</h2>
            <div style="font-size: 12px; color: #6b7280;">
              Export time: ${new Date().toLocaleString('en-US')} |
              Date range: ${dateRange.startDate} to ${dateRange.endDate} |
              Record count: ${filteredRecords.length} records
            </div>
          </div>

          <!-- Add statistics -->
          <div style="margin-bottom: 30px;">
            <h3 style="color: #1f2937; margin-bottom: 15px;">Summary Statistics</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 20px;">
              <div style="text-align: center; padding: 15px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
                <div style="font-size: 24px; font-weight: bold; color: #166534;">
                  RM${filteredRecords.filter(r => r.type === 'Income').reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                </div>
                <div style="font-size: 14px; color: #166534;">Total Income</div>
              </div>
              <div style="text-align: center; padding: 15px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
                <div style="font-size: 24px; font-weight: bold; color: #991b1b;">
                  RM${filteredRecords.filter(r => r.type === 'Expense').reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                </div>
                <div style="font-size: 14px; color: #991b1b;">Total Expense</div>
              </div>
              <div style="text-align: center; padding: 15px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;">
                <div style="font-size: 24px; font-weight: bold; color: #1e40af;">
                  RM${(filteredRecords.filter(r => r.type === 'Income').reduce((sum, r) => sum + r.amount, 0) - 
                     filteredRecords.filter(r => r.type === 'Expense').reduce((sum, r) => sum + r.amount, 0)).toFixed(2)}
                </div>
                <div style="font-size: 14px; color: #1e40af;">Balance</div>
              </div>
            </div>
          </div>

          <!-- Add table -->
          <div>
            <h3 style="color: #1f2937; margin-bottom: 15px;">Detailed Records</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="background-color: #f9fafb;">
                  <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px;">Date</th>
                  <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px;">Type</th>
                  <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px;">Amount</th>
                  <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px;">Description</th>
                  <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px;">Name</th>
                  <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${filteredRecords.map(record => `
                  <tr>
                    <td style="border: 1px solid #d1d5db; padding: 8px;">${new Date(record.date).toLocaleDateString()}</td>
                    <td style="border: 1px solid #d1d5db; padding: 8px; color: ${record.type === 'Income' ? '#166534' : '#991b1b'};">
                      ${record.type === 'Income' ? 'Income' : 'Expense'}
                    </td>
                    <td style="border: 1px solid #d1d5db; padding: 8px; text-align: right;">RM${record.amount.toFixed(2)}</td>
                    <td style="border: 1px solid #d1d5db; padding: 8px;">${record.description}</td>
                    <td style="border: 1px solid #d1d5db; padding: 8px;">${record.createdBy || 'Unknown'}</td>
                    <td style="border: 1px solid #d1d5db; padding: 8px; color: ${record.status === 'Approved' ? '#166534' : '#d97706'};">
                      ${record.status === 'Approved' ? 'Approved' : 'Pending'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      // 将内容添加到页面（隐藏）
      const pdfContentElement = document.createElement('div');
      pdfContentElement.style.position = 'absolute';
      pdfContentElement.style.left = '-9999px';
      pdfContentElement.innerHTML = pdfContent;
      document.body.appendChild(pdfContentElement);

      // 转换为 PDF
      const canvas = await html2canvas(pdfContentElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
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

      // 下载 PDF
      const fileName = `PACMC_财务报告_${dateRange.startDate}_${dateRange.endDate}.pdf`;
      pdf.save(fileName);

      // 清理
      document.body.removeChild(pdfContentElement);
    } catch (error) {
      console.error('导出 PDF 失败:', error);
      alert('导出 PDF 失败，请重试');
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
      const fileName = `PACMC_财务记录_${dateRange.startDate}_${dateRange.endDate}.xlsx`;
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                <div className="text-lg sm:text-2xl font-bold text-blue-600">{filteredRecords.length}</div>
                <div className="text-xs sm:text-sm text-gray-600">Record Count</div>
              </div>
              
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-lg sm:text-2xl font-bold text-green-600">
                  RM${filteredRecords.filter(r => r.type === 'Income').reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                </div>
                <div className="text-xs sm:text-sm text-gray-600">Total Income</div>
              </div>
              
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-lg sm:text-2xl font-bold text-red-600">
                  RM${filteredRecords.filter(r => r.type === 'Expense').reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                </div>
                <div className="text-xs sm:text-sm text-gray-600">Total Expense</div>
              </div>
              
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-lg sm:text-2xl font-bold text-purple-600">
                  RM${(filteredRecords.filter(r => r.type === 'Income').reduce((sum, r) => sum + r.amount, 0) - 
                     filteredRecords.filter(r => r.type === 'Expense').reduce((sum, r) => sum + r.amount, 0)).toFixed(2)}
                </div>
                <div className="text-xs sm:text-sm text-gray-600">Balance</div>
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