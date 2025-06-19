'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { CoreAndAbove } from '@/components/PermissionGate';
import { ArrowLeft, Download, FileText, BarChart3, Calendar, Filter } from 'lucide-react';
import Link from 'next/link';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

interface FinancialRecord {
  key: string;
  account: string;
  date: string;
  type: 'Income' | 'Expense';
  who: string;
  amount: number;
  description: string;
  status: string;
  takePut: boolean;
  remark: string;
  createdDate: string;
  createdBy: string;
  approvedDate: string;
  approvedBy: string;
  lastUserUpdate: string;
  lastDateUpdate: string;
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

  // 获取财务记录
  useEffect(() => {
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

  const fetchRecords = async () => {
    try {
      const response = await fetch('/api/sheets/read');
      if (response.ok) {
        const data = await response.json();
        setRecords(data.records || []);
      }
    } catch (error) {
      console.error('获取记录失败:', error);
    }
  };

  // 导出 PDF
  const exportToPDF = async () => {
    setLoading(true);
    try {
      // 创建 PDF 内容
      const pdfContent = document.createElement('div');
      pdfContent.style.padding = '20px';
      pdfContent.style.fontFamily = 'Arial, sans-serif';
      pdfContent.style.width = '800px';
      pdfContent.style.backgroundColor = 'white';

      // 添加标题和 Logo
      pdfContent.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1f2937; margin-bottom: 10px;">PACMC 青少年团契</h1>
          <h2 style="color: #6b7280; margin-bottom: 20px;">财务报告</h2>
          <p style="color: #9ca3af; font-size: 14px;">
            导出时间: ${new Date().toLocaleString('zh-TW')} | 
            日期范围: ${dateRange.startDate} 至 ${dateRange.endDate} | 
            记录数量: ${filteredRecords.length} 笔
          </p>
        </div>
      `;

      // 添加统计信息
      const totalIncome = filteredRecords
        .filter(r => r.type === 'Income')
        .reduce((sum, r) => sum + r.amount, 0);
      const totalExpense = filteredRecords
        .filter(r => r.type === 'Expense')
        .reduce((sum, r) => sum + r.amount, 0);
      const balance = totalIncome - totalExpense;

      pdfContent.innerHTML += `
        <div style="margin-bottom: 30px; display: flex; justify-content: space-around;">
          <div style="text-align: center; padding: 15px; background-color: #dcfce7; border-radius: 8px; min-width: 150px;">
            <div style="font-size: 24px; font-weight: bold; color: #166534;">$${totalIncome.toFixed(2)}</div>
            <div style="font-size: 14px; color: #166534;">总收入</div>
          </div>
          <div style="text-align: center; padding: 15px; background-color: #fee2e2; border-radius: 8px; min-width: 150px;">
            <div style="font-size: 24px; font-weight: bold; color: #991b1b;">$${totalExpense.toFixed(2)}</div>
            <div style="font-size: 14px; color: #991b1b;">总支出</div>
          </div>
          <div style="text-align: center; padding: 15px; background-color: #dbeafe; border-radius: 8px; min-width: 150px;">
            <div style="font-size: 24px; font-weight: bold; color: #1e40af;">$${balance.toFixed(2)}</div>
            <div style="font-size: 14px; color: #1e40af;">结余</div>
          </div>
        </div>
      `;

      // 添加表格
      if (filteredRecords.length > 0) {
        pdfContent.innerHTML += `
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px;">日期</th>
                <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px;">类型</th>
                <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px;">金额</th>
                <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px;">描述</th>
                <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px;">记录人</th>
                <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px;">状态</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRecords.map(record => `
                <tr>
                  <td style="border: 1px solid #d1d5db; padding: 8px; font-size: 11px;">${record.date}</td>
                  <td style="border: 1px solid #d1d5db; padding: 8px; font-size: 11px; color: ${record.type === 'Income' ? '#166534' : '#991b1b'};">
                    ${record.type === 'Income' ? '收入' : '支出'}
                  </td>
                  <td style="border: 1px solid #d1d5db; padding: 8px; font-size: 11px; font-weight: bold; color: ${record.type === 'Income' ? '#166534' : '#991b1b'};">
                    $${record.amount.toFixed(2)}
                  </td>
                  <td style="border: 1px solid #d1d5db; padding: 8px; font-size: 11px;">${record.description}</td>
                  <td style="border: 1px solid #d1d5db; padding: 8px; font-size: 11px;">${record.who}</td>
                  <td style="border: 1px solid #d1d5db; padding: 8px; font-size: 11px;">${record.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }

      // 将内容添加到页面（隐藏）
      pdfContent.style.position = 'absolute';
      pdfContent.style.left = '-9999px';
      document.body.appendChild(pdfContent);

      // 转换为 PDF
      const canvas = await html2canvas(pdfContent, {
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
      document.body.removeChild(pdfContent);
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
    <CoreAndAbove
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-400 text-6xl mb-4">🚫</div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">权限不足</h3>
            <p className="mt-1 text-sm text-gray-500">只有核心团队或以上权限可以导出报表</p>
            <div className="mt-6">
              <Link href="/" className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                返回首页
              </Link>
            </div>
          </div>
        </div>
      }
    >
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Link href="/" className="mr-4">
                  <ArrowLeft className="h-8 w-8 text-gray-600" />
                </Link>
                <h1 className="text-xl font-semibold text-gray-900">报表导出</h1>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 筛选设置 */}
          <div className="bg-white shadow-sm border rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Filter className="h-5 w-5 mr-2" />
              筛选设置
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 日期范围 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">开始日期</label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">结束日期</label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">记录类型</label>
                <select
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value as 'all' | 'income' | 'expense')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">全部记录</option>
                  <option value="income">仅收入</option>
                  <option value="expense">仅支出</option>
                </select>
              </div>
            </div>
          </div>

          {/* 统计信息 */}
          <div className="bg-white shadow-sm border rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              统计信息
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{filteredRecords.length}</div>
                <div className="text-sm text-gray-600">记录数量</div>
              </div>
              
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  ${filteredRecords.filter(r => r.type === 'Income').reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">总收入</div>
              </div>
              
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  ${filteredRecords.filter(r => r.type === 'Expense').reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">总支出</div>
              </div>
              
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  ${(filteredRecords.filter(r => r.type === 'Income').reduce((sum, r) => sum + r.amount, 0) - 
                     filteredRecords.filter(r => r.type === 'Expense').reduce((sum, r) => sum + r.amount, 0)).toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">结余</div>
              </div>
            </div>
          </div>

          {/* 导出按钮 */}
          <div className="bg-white shadow-sm border rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Download className="h-5 w-5 mr-2" />
              导出选项
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* PDF 导出 */}
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <FileText className="h-8 w-8 text-red-600 mr-3" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">PDF 报表</h3>
                    <p className="text-sm text-gray-500">包含统计图表和详细记录</p>
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
                  {loading ? '生成中...' : '导出 PDF'}
                </button>
              </div>

              {/* Excel 导出 */}
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <BarChart3 className="h-8 w-8 text-green-600 mr-3" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Excel 文件</h3>
                    <p className="text-sm text-gray-500">原始数据格式，便于进一步分析</p>
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
                  {loading ? '生成中...' : '导出 Excel'}
                </button>
              </div>
            </div>

            {filteredRecords.length === 0 && (
              <div className="mt-4 text-center text-gray-500">
                当前筛选条件下没有记录可导出
              </div>
            )}
          </div>
        </main>
      </div>
    </CoreAndAbove>
  );
} 