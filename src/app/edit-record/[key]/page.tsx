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

          // 从localStorage加载关联的收据
          const storedReceipts = localStorage.getItem(`receipts_${recordKey}`);
          if (storedReceipts) {
            const receipts = JSON.parse(storedReceipts);
            
            // 检查Google Drive文件是否存在
            const validReceipts = [];
            for (const receipt of receipts) {
              if (receipt.fileId) {
                try {
                  const response = await fetch(`/api/drive/check/${receipt.fileId}`);
                  if (response.ok) {
                    validReceipts.push(receipt);
                  } else {
                    console.log(`File ${receipt.fileId} not found in Google Drive, removing from local storage`);
                  }
                } catch (error) {
                  console.error('Error checking file existence:', error);
                  // 如果检查失败，保留记录
                  validReceipts.push(receipt);
                }
              } else {
                validReceipts.push(receipt);
              }
            }
            
            // 更新localStorage和状态
            if (validReceipts.length !== receipts.length) {
              localStorage.setItem(`receipts_${recordKey}`, JSON.stringify(validReceipts));
            }
            setReceipts(validReceipts);
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
      localStorage.setItem(`receipts_${recordKey}`, JSON.stringify(updatedReceipts));
      
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
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Link href="/financial-list" className="mr-4">
                  <ArrowLeft className="h-8 w-8 text-gray-600" />
                </Link>
                <h1 className="text-xl font-semibold text-gray-900">编辑财务记录</h1>
              </div>
            </div>
          </div>
        </header>
        {/* Main Content */}
        <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-4xl mx-auto">
            {/* Edit Form */}
            <div className="bg-white shadow-sm border rounded-lg p-6 mb-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 账户 */}
                <div>
                  <label htmlFor="account" className="block text-sm font-medium text-gray-700 mb-2">账户 *</label>
                  <select
                    id="account"
                    value={formData.account}
                    onChange={(e) => handleChange('account', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                    required
                  >
                    {ACCOUNTS.map((account) => (
                      <option key={account} value={account}>{account}</option>
                    ))}
                  </select>
                </div>
                {/* 日期 */}
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">日期 *</label>
                  <input
                    type="date"
                    id="date"
                    value={formData.date}
                    onChange={(e) => handleChange('date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                    required
                  />
                </div>
                {/* 类型 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">类型 *</label>
                  <div className="flex gap-4">
                    {TYPES.map((type) => (
                      <label key={type} className="flex items-center">
                        <input
                          type="radio"
                          name="type"
                          value={type}
                          checked={formData.type === type}
                          onChange={() => handleChange('type', type)}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">{type === 'Income' ? '收入' : '支出'}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {/* 记录人 */}
                <div>
                  <label htmlFor="who" className="block text-sm font-medium text-gray-700 mb-2">记录人 *</label>
                  <input
                    type="text"
                    id="who"
                    value={formData.who}
                    onChange={(e) => handleChange('who', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                    required
                  />
                </div>
                {/* 描述 */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">描述 *</label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                    required
                  />
                </div>
                {/* 金额 */}
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">金额 *</label>
                  <input
                    type="number"
                    id="amount"
                    value={formData.amount}
                    onChange={(e) => handleChange('amount', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                    required
                    min={0.01}
                    step={0.01}
                  />
                </div>
                {/* 备注 */}
                <div>
                  <label htmlFor="remark" className="block text-sm font-medium text-gray-700 mb-2">备注</label>
                  <input
                    type="text"
                    id="remark"
                    value={formData.remark || ''}
                    onChange={(e) => handleChange('remark', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div className="flex justify-end gap-4">
                  <button
                    type="button"
                    onClick={() => router.push('/financial-list')}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    disabled={saving}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                    disabled={saving}
                  >
                    <Save className="h-4 w-4" />
                    {saving ? '保存中...' : '保存'}
                  </button>
                </div>
              </form>
            </div>

            {/* Receipt Management Section */}
            <div className="bg-white shadow-sm border rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Receipts ({receipts.length})</h2>
                <input
                  id="receipt-file-input"
                  type="file"
                  className="sr-only"
                  accept="image/*,.pdf"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (file && formData) {
                      setUploading(true);
                      try {
                        // 检查文件大小
                        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
                        if (file.size > MAX_FILE_SIZE) {
                          alert(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the maximum limit of 10MB. Please choose a smaller file.`);
                          return;
                        }

                        // 创建FormData用于文件上传
                        const formDataForUpload = new FormData();
                        formDataForUpload.append('file', file);
                        formDataForUpload.append('description', '');
                        formDataForUpload.append('transactionKey', formData.key);

                        // 上传到Google Drive
                        const driveResponse = await fetch('/api/drive/upload', {
                          method: 'POST',
                          body: formDataForUpload,
                        });

                        if (!driveResponse.ok) {
                          const errorText = await driveResponse.text();
                          throw new Error(`Failed to upload file to Google Drive: ${driveResponse.status} ${errorText}`);
                        }

                        const driveResult = await driveResponse.json();
                        
                        // 创建收据记录
                        const newReceipt: Receipt = {
                          receiptKey: Math.random().toString(36).substr(2, 8),
                          transactionKey: formData.key,
                          fileName: driveResult.originalName,
                          fileUrl: driveResult.fileUrl,
                          fileId: driveResult.fileId,
                          downloadUrl: driveResult.downloadUrl,
                          uploadBy: userProfile?.name || userProfile?.email || 'Unknown User',
                          description: '',
                          uploadDate: new Date().toISOString(),
                        };

                        // 添加到receipts列表
                        const updatedReceipts = [newReceipt, ...receipts];
                        setReceipts(updatedReceipts);
                        localStorage.setItem(`receipts_${formData.key}`, JSON.stringify(updatedReceipts));
                        setToast({ type: 'success', message: '上传成功' });
                      } catch (error) {
                        setToast({ type: 'error', message: '上传失败' });
                      } finally {
                        setUploading(false);
                      }
                    }
                    // 清空input值，允许重复选择同一文件
                    event.target.value = '';
                  }}
                />
                <label
                  htmlFor="receipt-file-input"
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                >
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Add Receipt
                </label>
              </div>

              {receipts.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="mx-auto h-12 w-12 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">No receipts uploaded for this record</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {receipts.map((receipt) => {
                    const isImage = isImageFile(receipt.fileName);
                    
                    return (
                      <div
                        key={receipt.receiptKey}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border"
                      >
                        <div className="flex items-center space-x-3 flex-1">
                          {/* 图片预览 */}
                          {isImage ? (
                            <div className="w-16 h-16 flex-shrink-0">
                              <img
                                src={receipt.fileUrl}
                                alt={receipt.fileName}
                                className="w-full h-full object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => {
                                  // 可以添加图片预览功能
                                  window.open(receipt.fileUrl, '_blank');
                                }}
                                title="Click to view full size"
                              />
                            </div>
                          ) : (
                            <div className="w-16 h-16 flex-shrink-0 bg-gray-100 rounded border flex items-center justify-center">
                              <Receipt className="h-5 w-5 text-gray-500" />
                            </div>
                          )}
                          
                          {/* 文件信息 */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {receipt.fileName}
                            </p>
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span>{formatDateTime(receipt.uploadDate)}</span>
                              <span>by {receipt.uploadBy}</span>
                              {receipt.description && (
                                <span className="truncate">{receipt.description}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex items-center space-x-2 ml-4">
                          <a
                            href={receipt.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-blue-600"
                            title="View receipt"
                          >
                            {getFileIcon(receipt.fileName)}
                          </a>
                          <a
                            href={receipt.fileUrl}
                            download={receipt.fileName}
                            className="text-gray-400 hover:text-green-600"
                            title="Download receipt"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                          <button
                            onClick={() => handleDeleteReceipt(receipt.receiptKey)}
                            disabled={deleting === receipt.receiptKey}
                            className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                            title="Delete receipt"
                          >
                            {deleting === receipt.receiptKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
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