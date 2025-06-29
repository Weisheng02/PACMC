'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AdminOrSuperAdmin } from '@/components/PermissionGate';
import { useAuth } from '@/contexts/AuthContext';
import { readFinancialRecords, updateFinancialRecord, FinancialRecord, formatGoogleSheetsDate } from '@/lib/googleSheets';
import { ArrowLeft, Save, X, Receipt, Plus, Eye, Download, Trash2, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import ReceiptUpload from '@/components/ReceiptUpload';
import { sendReceiptUploadNotification } from '@/lib/firebase';

const ACCOUNTS = ['MIYF'];
const TYPES = ['Income', 'Expense'];

interface Receipt {
  receiptKey: string;
  transactionKey: string;
  fileName: string;
  fileUrl: string;
  uploadDate: string;
  uploadBy: string;
  description: string;
  fileId?: string;
  downloadUrl?: string;
}

export default function EditRecordPage() {
  const params = useParams();
  const router = useRouter();
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const recordKey = params.key as string;

  // 加载记录
  useEffect(() => {
    async function fetchRecord() {
      setLoading(true);
      setError(null);
      try {
        const all = await readFinancialRecords();
        const record = all.find((r) => r.key === params.key);
        if (!record) {
          setError('未找到该记录');
        } else {
          // 处理日期格式
          let formattedDate = '';
          if (record.date) {
            try {
              // 处理 Google Sheets 日期格式
              const dateToParse = record.date;
              
              // 如果是 Google Sheets 的序列号日期，转换为日期对象
              if (typeof record.date === 'number') {
                // Google Sheets 日期是从 1900-01-01 开始的天数
                const googleSheetsEpoch = new Date(1900, 0, 1);
                const date = new Date(googleSheetsEpoch.getTime() + (record.date - 2) * 24 * 60 * 60 * 1000);
                formattedDate = date.toISOString().split('T')[0];
              } else if (typeof record.date === 'string') {
                // 尝试解析字符串日期
                const date = new Date(record.date);
                if (!isNaN(date.getTime())) {
                  formattedDate = date.toISOString().split('T')[0];
                } else {
                  // 如果解析失败，尝试其他格式
                  const parts = record.date.split('/');
                  if (parts.length === 3) {
                    // 处理 DD/MM/YYYY 或 MM/DD/YYYY 格式
                    const year = parts[2];
                    const month = parts[1].padStart(2, '0');
                    const day = parts[0].padStart(2, '0');
                    formattedDate = `${year}-${month}-${day}`;
                  } else {
                    // 如果都失败，使用原始值
                    formattedDate = record.date;
                  }
                }
              }
            } catch (e) {
              console.warn('Date parsing failed:', record.date);
              formattedDate = record.date || '';
            }
          }
          
          setFormData({ 
            ...record, 
            amount: record.amount.toString(),
            date: formattedDate
          });

          // 从Google Drive获取收据列表
          try {
            const receiptsResponse = await fetch(`/api/drive/list?transactionKey=${recordKey}`);
            if (receiptsResponse.ok) {
              const receiptsData = await receiptsResponse.json();
              setReceipts(receiptsData.receipts || []);
            } else {
              console.error('Failed to load receipts from Google Drive');
              setReceipts([]);
            }
          } catch (error) {
            console.error('Error loading receipts from Google Drive:', error);
            setReceipts([]);
          }
        }
      } catch (e) {
        setError('加载记录失败');
      } finally {
        setLoading(false);
      }
    }
    fetchRecord();
  }, [params.key, recordKey]);

  // toast自动消失
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;
    setSaving(true);
    setError(null);
    try {
      await updateFinancialRecord(formData.key, {
        ...formData,
        amount: Number(formData.amount),
        lastUserUpdate: userProfile?.name || '未知用户',
      });
      alert('保存成功！');
      router.push('/financial-list');
    } catch (e) {
      setError('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteReceipt = async (receiptKey: string) => {
    if (!confirm('Are you sure you want to delete this receipt?')) return;

    setDeleting(receiptKey);
    try {
      // 找到要删除的receipt
      const receiptToDelete = receipts.find(r => r.receiptKey === receiptKey);
      
      if (receiptToDelete?.fileId) {
        // 从Google Drive删除文件
        const response = await fetch(`/api/drive/delete/${receiptToDelete.fileId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          console.warn('Failed to delete file from Google Drive, but continuing with local deletion');
        }
      }

      // 从本地存储删除
      const updatedReceipts = receipts.filter(r => r.receiptKey !== receiptKey);
      setReceipts(updatedReceipts);
      
      setToast({ type: 'success', message: '删除成功' });
    } catch (error) {
      setToast({ type: 'error', message: '删除失败' });
    } finally {
      setDeleting(null);
    }
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

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension || '')) {
      return <Eye className="h-4 w-4" />;
    }
    return <Download className="h-4 w-4" />;
  };

  const isImageFile = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension || '');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>
    );
  }
  if (!formData) return null;

  return (
    <AdminOrSuperAdmin
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <X className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">权限不足</h3>
            <p className="mt-1 text-sm text-gray-500">只有管理员或超级管理员可以编辑财务记录</p>
            <div className="mt-6">
              <Link href="/financial-list" className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">返回财务列表</Link>
            </div>
          </div>
        </div>
      }
    >
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
        <header className="sticky top-0 z-50 bg-white shadow-sm border-b dark:bg-slate-800 dark:border-slate-700">
          <div className="w-full px-3 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center h-auto sm:h-16 py-3 sm:py-0">
              <div className="flex items-center mb-3 sm:mb-0">
                <Link href="/financial-list" className="mr-3 sm:mr-4">
                  <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-gray-600 dark:text-slate-400" />
                </Link>
                <h1 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-slate-100">
                  <span className="hidden sm:inline">Edit Record</span>
                  <span className="sm:hidden">Edit</span>
                </h1>
              </div>
              
              {/* Desktop buttons */}
              <div className="hidden sm:flex items-center gap-3 sm:gap-4">
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <Link
                  href="/financial-list"
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:text-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Link>
              </div>

              {/* Mobile buttons - simplified */}
              <div className="flex items-center gap-2 w-full sm:hidden">
                <Link
                  href="/financial-list"
                  className="flex items-center justify-center w-10 h-10 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:text-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"
                  title="Back to Records"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </Link>
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="flex items-center justify-center w-10 h-10 text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={saving ? 'Saving...' : 'Save Changes'}
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <Save className="h-5 w-5" />
                  )}
                </button>
                <Link
                  href="/financial-list"
                  className="flex items-center justify-center w-10 h-10 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:text-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"
                  title="Cancel"
                >
                  <X className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
        </header>

        <div className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          {loading ? (
            <div className="flex items-center justify-center min-h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-sm text-gray-600 dark:text-slate-400">Loading record...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          ) : formData ? (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6 dark:bg-slate-800 dark:border-slate-700">
                <h2 className="text-base sm:text-lg font-medium text-gray-900 mb-4 sm:mb-6 dark:text-slate-100">Edit Financial Record</h2>
                
                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                  {/* Date */}
                  <div>
                    <label htmlFor="date" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2 dark:text-slate-300">
                      Date *
                    </label>
                    <input
                      type="date"
                      id="date"
                      value={formData.date}
                      onChange={(e) => handleChange('date', e.target.value)}
                      required
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-600 dark:border-slate-500 dark:text-slate-100"
                    />
                  </div>

                  {/* Type */}
                  <div>
                    <label htmlFor="type" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2 dark:text-slate-300">
                      Type *
                    </label>
                    <select
                      id="type"
                      value={formData.type}
                      onChange={(e) => handleChange('type', e.target.value as 'Income' | 'Expense')}
                      required
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-600 dark:border-slate-500 dark:text-slate-100"
                    >
                      <option value="">Select Type</option>
                      <option value="Income">Income</option>
                      <option value="Expense">Expense</option>
                    </select>
                  </div>

                  {/* Amount */}
                  <div>
                    <label htmlFor="amount" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2 dark:text-slate-300">
                      Amount (RM) *
                    </label>
                    <input
                      type="number"
                      id="amount"
                      value={formData.amount}
                      onChange={(e) => handleChange('amount', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      min="0"
                      required
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-600 dark:border-slate-500 dark:text-slate-100"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label htmlFor="description" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2 dark:text-slate-300">
                      Description *
                    </label>
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleChange('description', e.target.value)}
                      required
                      rows={3}
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-600 dark:border-slate-500 dark:text-slate-100"
                      placeholder="Enter description..."
                    />
                  </div>

                  {/* Account */}
                  <div>
                    <label htmlFor="account" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2 dark:text-slate-300">
                      Account *
                    </label>
                    <select
                      id="account"
                      value={formData.account}
                      onChange={(e) => handleChange('account', e.target.value)}
                      required
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-600 dark:border-slate-500 dark:text-slate-100"
                    >
                      <option value="">Select Account</option>
                      <option value="MIYF">MIYF</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Who */}
                  <div>
                    <label htmlFor="who" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2 dark:text-slate-300">
                      Who *
                    </label>
                    <input
                      type="text"
                      id="who"
                      value={formData.who}
                      onChange={(e) => handleChange('who', e.target.value)}
                      required
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-600 dark:border-slate-500 dark:text-slate-100"
                      placeholder="Enter who..."
                    />
                  </div>

                  {/* Remark */}
                  <div>
                    <label htmlFor="remark" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2 dark:text-slate-300">
                      Remark
                    </label>
                    <textarea
                      id="remark"
                      value={formData.remark}
                      onChange={(e) => handleChange('remark', e.target.value)}
                      rows={2}
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-600 dark:border-slate-500 dark:text-slate-100"
                      placeholder="Enter remark (optional)..."
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label htmlFor="status" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2 dark:text-slate-300">
                      Status
                    </label>
                    <select
                      id="status"
                      value={formData.status}
                      onChange={(e) => handleChange('status', e.target.value as 'Pending' | 'Approved')}
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-600 dark:border-slate-500 dark:text-slate-100"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Approved">Approved</option>
                    </select>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 sm:pt-6">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <Link
                      href="/financial-list"
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:text-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </Link>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-slate-400">Record not found</p>
            </div>
          )}
        </div>
      </div>
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded shadow flex items-center space-x-2 ${toast.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {toast.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
          <span>{toast.message}</span>
        </div>
      )}
    </AdminOrSuperAdmin>
  );
} 