'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { LoggedInUser } from '@/components/PermissionGate';
import { ArrowLeft, RefreshCw, FileText, BarChart3, Calendar, TrendingUp, Download, DollarSign } from 'lucide-react';
import Link from 'next/link';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { readFinancialRecords, FinancialRecord } from '@/lib/googleSheets';

function formatCurrency(amount: number) {
  return 'RM' + amount.toFixed(2);
}

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
        'Type': record.type === 'Income' ? 'Income' : 'Expense',
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
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
        <header className="sticky top-0 z-50 bg-white shadow-sm border-b dark:bg-slate-800 dark:border-slate-700">
          <div className="w-full px-3 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center h-auto sm:h-16 py-3 sm:py-0">
              <div className="flex items-center mb-3 sm:mb-0">
                <Link href="/" className="mr-3 sm:mr-4">
                  <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-gray-600 dark:text-slate-400" />
                </Link>
                <h1 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-slate-100">
                  <span className="hidden sm:inline">Export Data</span>
                  <span className="sm:hidden">Export</span>
                </h1>
              </div>
              
              {/* Desktop buttons */}
              <div className="hidden sm:flex items-center gap-3 sm:gap-4">
                <button
                  onClick={exportToPDF}
                  disabled={loading || filteredRecords.length === 0}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:text-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 dark:border-slate-400"></div>
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  {loading ? 'Generating...' : 'Export PDF'}
                </button>
                <button
                  onClick={exportToExcel}
                  disabled={loading || filteredRecords.length === 0}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:text-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 dark:border-slate-400"></div>
                  ) : (
                    <BarChart3 className="h-4 w-4" />
                  )}
                  {loading ? 'Generating...' : 'Export Excel'}
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
                  onClick={exportToPDF}
                  disabled={loading || filteredRecords.length === 0}
                  className="flex items-center justify-center w-10 h-10 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:text-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"
                  title={loading ? 'Generating...' : 'Export PDF'}
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600 dark:border-slate-400"></div>
                  ) : (
                    <FileText className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-6 dark:bg-slate-800 dark:border-slate-700">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-2 bg-green-100 rounded-lg dark:bg-green-900">
                  <DollarSign className="h-4 w-4 sm:h-5 sm:w-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate dark:text-slate-400">Total Income</p>
                  <p className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-semibold text-gray-900 whitespace-nowrap truncate dark:text-slate-100">
                    {formatCurrency(records.filter(r => r.type === 'Income').reduce((sum, r) => sum + (Number(r.amount) || 0), 0))}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-6 dark:bg-slate-800 dark:border-slate-700">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-2 bg-red-100 rounded-lg dark:bg-red-900">
                  <DollarSign className="h-4 w-4 sm:h-5 sm:w-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate dark:text-slate-400">Total Expense</p>
                  <p className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-semibold text-gray-900 whitespace-nowrap truncate dark:text-slate-100">
                    {formatCurrency(records.filter(r => r.type === 'Expense').reduce((sum, r) => sum + (Number(r.amount) || 0), 0))}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-6 dark:bg-slate-800 dark:border-slate-700">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-2 bg-blue-100 rounded-lg dark:bg-blue-900">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate dark:text-slate-400">Balance</p>
                  <p className={`text-sm sm:text-lg lg:text-xl xl:text-2xl font-semibold whitespace-nowrap truncate ${records.filter(r => r.type === 'Income').reduce((sum, r) => sum + (Number(r.amount) || 0), 0) - records.filter(r => r.type === 'Expense').reduce((sum, r) => sum + (Number(r.amount) || 0), 0) >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(records.filter(r => r.type === 'Income').reduce((sum, r) => sum + (Number(r.amount) || 0), 0) - records.filter(r => r.type === 'Expense').reduce((sum, r) => sum + (Number(r.amount) || 0), 0))}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-6 dark:bg-slate-800 dark:border-slate-700">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-2 bg-purple-100 rounded-lg dark:bg-purple-900">
                  <Calendar className="h-4 w-4 sm:h-5 sm:w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate dark:text-slate-400">Total Records</p>
                  <p className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-semibold text-gray-900 truncate dark:text-slate-100">{records.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Export Options */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6 dark:bg-slate-800 dark:border-slate-700">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-base sm:text-lg font-medium text-gray-900 dark:text-slate-100 flex items-center gap-2">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                  Export Options
                </h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Date Range</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    <input
                      type="date"
                      value={dateRange.startDate}
                      onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-600 dark:border-slate-500 dark:text-slate-100"
                    />
                    <input
                      type="date"
                      value={dateRange.endDate}
                      onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-600 dark:border-slate-500 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Record Type</label>
                  <select
                    value={exportType}
                    onChange={(e) => setExportType(e.target.value as 'all' | 'income' | 'expense')}
                    className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-600 dark:border-slate-500 dark:text-slate-100"
                  >
                    <option value="all">All Records</option>
                    <option value="income">Income Only</option>
                    <option value="expense">Expense Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Export Format</label>
                  <select
                    value="pdf"
                    onChange={(e) => {}}
                    className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-600 dark:border-slate-500 dark:text-slate-100"
                  >
                    <option value="pdf">PDF</option>
                  </select>
                </div>

                <button
                  onClick={exportToPDF}
                  disabled={loading || filteredRecords.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  {loading ? 'Generating...' : 'Export PDF'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6 dark:bg-slate-800 dark:border-slate-700">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-base sm:text-lg font-medium text-gray-900 dark:text-slate-100 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
                  Data Preview
                </h2>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-600 dark:text-slate-400">Filtered Records:</span>
                  <span className="font-medium text-gray-900 dark:text-slate-100">{filteredRecords.length}</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-600 dark:text-slate-400">Date Range:</span>
                  <span className="font-medium text-gray-900 dark:text-slate-100">
                    {dateRange.startDate} to {dateRange.endDate}
                  </span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-600 dark:text-slate-400">Type:</span>
                  <span className="font-medium text-gray-900 dark:text-slate-100">{exportType === 'all' ? 'All Records' : exportType === 'income' ? 'Income Only' : 'Expense Only'}</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-600 dark:text-slate-400">Format:</span>
                  <span className="font-medium text-gray-900 dark:text-slate-100">PDF</span>
                </div>
              </div>

              {filteredRecords.length > 0 && (
                <div className="mt-4 sm:mt-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-2 dark:text-slate-100">Sample Data (First 5 records)</h3>
                  <div className="bg-gray-50 dark:bg-slate-700 rounded-md p-3 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-slate-600">
                          <th className="text-left py-1 font-medium text-gray-700 dark:text-slate-300">Date</th>
                          <th className="text-left py-1 font-medium text-gray-700 dark:text-slate-300">Type</th>
                          <th className="text-left py-1 font-medium text-gray-700 dark:text-slate-300">Amount</th>
                          <th className="text-left py-1 font-medium text-gray-700 dark:text-slate-300">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecords.slice(0, 5).map((record, index) => (
                          <tr key={index} className="border-b border-gray-100 dark:border-slate-600">
                            <td className="py-1 text-gray-600 dark:text-slate-400">{record.date?.split(' ')[0]}</td>
                            <td className="py-1">
                              <span className={`px-1 py-0.5 text-xs rounded ${
                                record.type === 'Income' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              }`}>
                                {record.type}
                              </span>
                            </td>
                            <td className="py-1 text-gray-900 dark:text-slate-100">{formatCurrency(Number(record.amount))}</td>
                            <td className="py-1 text-gray-600 dark:text-slate-400 truncate max-w-20">{record.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </LoggedInUser>
  );
} 