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

      // 创建PDF文档
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      let currentY = margin;

      // 设置字体
      pdf.setFont('helvetica');
      
      // 第一页：头部和统计信息
      // Header
      pdf.setFontSize(24);
      pdf.setTextColor(31, 41, 55);
      pdf.text('PACMC Youth Fellowship', pageWidth / 2, currentY, { align: 'center' });
      currentY += 15;
      
      pdf.setFontSize(16);
      pdf.setTextColor(107, 114, 128);
      pdf.text('Financial Report', pageWidth / 2, currentY, { align: 'center' });
      currentY += 20;

      // Report info
      pdf.setFontSize(10);
      pdf.setTextColor(107, 114, 128);
      const reportInfo = [
        `Report Period: ${new Date(dateRange.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} - ${new Date(dateRange.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        `Generated: ${new Date().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
        `Total Records: ${filteredRecords.length} | Type: ${exportType === 'all' ? 'All Records' : exportType === 'income' ? 'Income Only' : 'Expense Only'}`
      ];
      
      reportInfo.forEach(info => {
        pdf.text(info, margin, currentY);
        currentY += 6;
      });
      currentY += 10;

      // Summary Statistics
      pdf.setFontSize(14);
      pdf.setTextColor(31, 41, 55);
      pdf.text('Summary Statistics', margin, currentY);
      currentY += 15;

      // Statistics boxes
      const boxWidth = (contentWidth - 15) / 2;
      const boxHeight = 25;
      
      // Income box
      pdf.setFillColor(240, 253, 244);
      pdf.rect(margin, currentY, boxWidth, boxHeight, 'F');
      pdf.setDrawColor(187, 247, 208);
      pdf.rect(margin, currentY, boxWidth, boxHeight, 'S');
      pdf.setFontSize(16);
      pdf.setTextColor(22, 101, 52);
      pdf.text(`RM${totalIncome.toFixed(2)}`, margin + boxWidth/2, currentY + 8, { align: 'center' });
      pdf.setFontSize(10);
      pdf.text('Total Income', margin + boxWidth/2, currentY + 18, { align: 'center' });

      // Expense box
      pdf.setFillColor(254, 242, 242);
      pdf.rect(margin + boxWidth + 15, currentY, boxWidth, boxHeight, 'F');
      pdf.setDrawColor(254, 202, 202);
      pdf.rect(margin + boxWidth + 15, currentY, boxWidth, boxHeight, 'S');
      pdf.setFontSize(16);
      pdf.setTextColor(153, 27, 27);
      pdf.text(`RM${totalExpense.toFixed(2)}`, margin + boxWidth + 15 + boxWidth/2, currentY + 8, { align: 'center' });
      pdf.setFontSize(10);
      pdf.text('Total Expense', margin + boxWidth + 15 + boxWidth/2, currentY + 18, { align: 'center' });
      currentY += boxHeight + 15;

      // Balance and Records boxes
      pdf.setFillColor(239, 246, 255);
      pdf.rect(margin, currentY, boxWidth, boxHeight, 'F');
      pdf.setDrawColor(191, 219, 254);
      pdf.rect(margin, currentY, boxWidth, boxHeight, 'S');
      pdf.setFontSize(16);
      pdf.setTextColor(30, 64, 175);
      pdf.text(`RM${balance.toFixed(2)}`, margin + boxWidth/2, currentY + 8, { align: 'center' });
      pdf.setFontSize(10);
      pdf.text('Net Balance', margin + boxWidth/2, currentY + 18, { align: 'center' });

      pdf.setFillColor(250, 245, 255);
      pdf.rect(margin + boxWidth + 15, currentY, boxWidth, boxHeight, 'F');
      pdf.setDrawColor(233, 213, 255);
      pdf.rect(margin + boxWidth + 15, currentY, boxWidth, boxHeight, 'S');
      pdf.setFontSize(16);
      pdf.setTextColor(124, 58, 237);
      pdf.text(`${filteredRecords.length}`, margin + boxWidth + 15 + boxWidth/2, currentY + 8, { align: 'center' });
      pdf.setFontSize(10);
      pdf.text('Total Records', margin + boxWidth + 15 + boxWidth/2, currentY + 18, { align: 'center' });
      currentY += boxHeight + 20;

      // Status breakdown
      pdf.setFontSize(12);
      pdf.setTextColor(31, 41, 55);
      pdf.text('Status Breakdown:', margin, currentY);
      currentY += 10;

      const statusBoxWidth = (contentWidth - 15) / 2;
      const statusBoxHeight = 20;

      // Approved records
      pdf.setFillColor(240, 253, 244);
      pdf.rect(margin, currentY, statusBoxWidth, statusBoxHeight, 'F');
      pdf.setDrawColor(187, 247, 208);
      pdf.rect(margin, currentY, statusBoxWidth, statusBoxHeight, 'S');
      pdf.setFontSize(14);
      pdf.setTextColor(22, 101, 52);
      pdf.text(`${approvedRecords}`, margin + statusBoxWidth/2, currentY + 8, { align: 'center' });
      pdf.setFontSize(9);
      pdf.text('Approved Records', margin + statusBoxWidth/2, currentY + 16, { align: 'center' });

      // Pending records
      pdf.setFillColor(254, 243, 199);
      pdf.rect(margin + statusBoxWidth + 15, currentY, statusBoxWidth, statusBoxHeight, 'F');
      pdf.setDrawColor(253, 230, 138);
      pdf.rect(margin + statusBoxWidth + 15, currentY, statusBoxWidth, statusBoxHeight, 'S');
      pdf.setFontSize(14);
      pdf.setTextColor(217, 119, 6);
      pdf.text(`${pendingRecords}`, margin + statusBoxWidth + 15 + statusBoxWidth/2, currentY + 8, { align: 'center' });
      pdf.setFontSize(9);
      pdf.text('Pending Records', margin + statusBoxWidth + 15 + statusBoxWidth/2, currentY + 16, { align: 'center' });
      currentY += statusBoxHeight + 20;

      // Monthly breakdown (if exists)
      if (Object.keys(monthlyStats).length > 0) {
        pdf.setFontSize(12);
        pdf.setTextColor(31, 41, 55);
        pdf.text('Monthly Breakdown:', margin, currentY);
        currentY += 10;

        // Monthly table headers
        const monthlyColWidths = [50, 30, 30, 30, 25];
        const monthlyHeaders = ['Month', 'Income', 'Expense', 'Balance', 'Records'];
        
        pdf.setFontSize(9);
        pdf.setTextColor(31, 41, 55);
        let xPos = margin;
        monthlyHeaders.forEach((header, index) => {
          pdf.rect(xPos, currentY, monthlyColWidths[index], 8, 'S');
          pdf.text(header, xPos + 2, currentY + 6);
          xPos += monthlyColWidths[index];
        });
        currentY += 8;

        // Monthly data
        pdf.setFontSize(8);
        Object.entries(monthlyStats).forEach(([month, stats]) => {
          if (currentY > pageHeight - 40) {
            pdf.addPage();
            currentY = margin;
          }
          
          xPos = margin;
          pdf.rect(xPos, currentY, monthlyColWidths[0], 6, 'S');
          pdf.text(month, xPos + 2, currentY + 4);
          xPos += monthlyColWidths[0];
          
          pdf.rect(xPos, currentY, monthlyColWidths[1], 6, 'S');
          pdf.setTextColor(22, 101, 52);
          pdf.text(`RM${stats.income.toFixed(2)}`, xPos + 2, currentY + 4);
          xPos += monthlyColWidths[1];
          
          pdf.rect(xPos, currentY, monthlyColWidths[2], 6, 'S');
          pdf.setTextColor(153, 27, 27);
          pdf.text(`RM${stats.expense.toFixed(2)}`, xPos + 2, currentY + 4);
          xPos += monthlyColWidths[2];
          
          pdf.rect(xPos, currentY, monthlyColWidths[3], 6, 'S');
          pdf.setTextColor(stats.income - stats.expense >= 0 ? 22 : 153, stats.income - stats.expense >= 0 ? 101 : 27, stats.income - stats.expense >= 0 ? 52 : 27);
          pdf.text(`RM${(stats.income - stats.expense).toFixed(2)}`, xPos + 2, currentY + 4);
          xPos += monthlyColWidths[3];
          
          pdf.rect(xPos, currentY, monthlyColWidths[4], 6, 'S');
          pdf.setTextColor(31, 41, 55);
          pdf.text(`${stats.count}`, xPos + 2, currentY + 4);
          
          currentY += 6;
        });
        currentY += 15;
      }

      // Detailed records table
      pdf.setFontSize(12);
      pdf.setTextColor(31, 41, 55);
      pdf.text('Detailed Records:', margin, currentY);
      currentY += 10;

      // Table headers
      const colWidths = [25, 20, 25, 60, 30, 20];
      const headers = ['Date', 'Type', 'Amount', 'Description', 'Created By', 'Status'];
      
      pdf.setFontSize(8);
      pdf.setTextColor(31, 41, 55);
      let xPos = margin;
      headers.forEach((header, index) => {
        pdf.rect(xPos, currentY, colWidths[index], 8, 'S');
        pdf.text(header, xPos + 2, currentY + 6);
        xPos += colWidths[index];
      });
      currentY += 8;

      // Table data
      pdf.setFontSize(7);
      filteredRecords.forEach((record, index) => {
        // Check if we need a new page
        if (currentY > pageHeight - 30) {
          pdf.addPage();
          currentY = margin;
          
          // Add table headers on new page
          xPos = margin;
          headers.forEach((header, headerIndex) => {
            pdf.rect(xPos, currentY, colWidths[headerIndex], 8, 'S');
            pdf.setFontSize(8);
            pdf.setTextColor(31, 41, 55);
            pdf.text(header, xPos + 2, currentY + 6);
            xPos += colWidths[headerIndex];
          });
          currentY += 8;
        }

        // Row data
        xPos = margin;
        
        // Date
        pdf.rect(xPos, currentY, colWidths[0], 6, 'S');
        pdf.setTextColor(31, 41, 55);
        pdf.text(new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), xPos + 2, currentY + 4);
        xPos += colWidths[0];
        
        // Type
        pdf.rect(xPos, currentY, colWidths[1], 6, 'S');
        pdf.setTextColor(record.type === 'Income' ? 22 : 153, record.type === 'Income' ? 101 : 27, record.type === 'Income' ? 52 : 27);
        pdf.text(record.type === 'Income' ? 'Income' : 'Expense', xPos + 2, currentY + 4);
        xPos += colWidths[1];
        
        // Amount
        pdf.rect(xPos, currentY, colWidths[2], 6, 'S');
        pdf.setTextColor(31, 41, 55);
        pdf.text(`RM${record.amount.toFixed(2)}`, xPos + 2, currentY + 4);
        xPos += colWidths[2];
        
        // Description
        pdf.rect(xPos, currentY, colWidths[3], 6, 'S');
        pdf.text(record.description || '-', xPos + 2, currentY + 4);
        xPos += colWidths[3];
        
        // Created By
        pdf.rect(xPos, currentY, colWidths[4], 6, 'S');
        pdf.text(record.createdBy || 'Unknown', xPos + 2, currentY + 4);
        xPos += colWidths[4];
        
        // Status
        pdf.rect(xPos, currentY, colWidths[5], 6, 'S');
        pdf.setTextColor(record.status === 'Approved' ? 22 : 217, record.status === 'Approved' ? 101 : 119, record.status === 'Approved' ? 52 : 6);
        pdf.text(record.status === 'Approved' ? 'Approved' : 'Pending', xPos + 2, currentY + 4);
        
        currentY += 6;
      });

      // Footer on last page
      pdf.setFontSize(8);
      pdf.setTextColor(107, 114, 128);
      pdf.text('This report was generated automatically by PACMC Financial Management System', pageWidth / 2, pageHeight - 15, { align: 'center' });
      pdf.text('For any questions, please contact the system administrator', pageWidth / 2, pageHeight - 10, { align: 'center' });

      // 下载 PDF with English filename
      const fileName = `PACMC_Financial_Report_${dateRange.startDate}_${dateRange.endDate}.pdf`;
      pdf.save(fileName);
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
                  RM{filteredRecords.filter(r => r.type === 'Income').reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 truncate">Total Income</div>
              </div>
              
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-bold text-red-600 truncate">
                  RM{filteredRecords.filter(r => r.type === 'Expense').reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 truncate">Total Expense</div>
              </div>
              
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-bold text-purple-600 truncate">
                  RM{(filteredRecords.filter(r => r.type === 'Income').reduce((sum, r) => sum + r.amount, 0) - 
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