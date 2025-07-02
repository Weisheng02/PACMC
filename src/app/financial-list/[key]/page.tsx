'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { LoggedInUser } from '@/components/PermissionGate';
import { ArrowLeft, Edit, Trash2, Receipt, Eye, Download, X, CheckCircle, Clock, Plus, XCircle, Loader2, Pencil, Save as SaveIcon } from 'lucide-react';
import Link from 'next/link';
import GoogleDriveReceiptUpload from '@/components/GoogleDriveReceiptUpload';
import { FinancialRecord, formatGoogleSheetsDate } from '@/lib/googleSheets';

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
  displayName?: string;
}

export default function RecordDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { userProfile, isAdmin, isSuperAdmin } = useAuth();
  const [record, setRecord] = useState<FinancialRecord | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showReceiptUpload, setShowReceiptUpload] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingReceiptKey, setEditingReceiptKey] = useState<string | null>(null);
  const [editingDisplayName, setEditingDisplayName] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);

  const recordKey = params.key as string;

  useEffect(() => {
    loadRecordDetails();
  }, [recordKey]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadRecordDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // 加载记录详情
      const recordResponse = await fetch('/api/sheets/read');
      if (!recordResponse.ok) {
        throw new Error('Failed to load records');
      }
      const recordData = await recordResponse.json();
      const foundRecord = recordData.records?.find((r: FinancialRecord) => r.key === recordKey);
      
      if (!foundRecord) {
        setError('Record not found');
        return;
      }
      
      setRecord(foundRecord);

      // receipts 直接从 Google Sheet 读取
      try {
        const receiptsResponse = await fetch('/api/sheets/receipts/read');
        if (receiptsResponse.ok) {
          const receiptsData = await receiptsResponse.json();
          setReceipts((receiptsData.receipts || []).filter((r: any) => r.transactionKey === recordKey));
        } else {
          setReceipts([]);
        }
      } catch (error) {
        console.error('Error loading receipts from Google Sheet:', error);
        setReceipts([]);
      }
    } catch (error) {
      console.error('Error loading record details:', error);
      setError('Failed to load record details');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async (newStatus: 'Pending' | 'Approved') => {
    if (!record || !userProfile) return;

    // 如果是审批操作，需要确认
    if (newStatus === 'Approved') {
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

    try {
      const response = await fetch('/api/sheets/update-record-status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          key: record.key, 
          status: newStatus,
          approvedBy: userProfile?.name || userProfile?.email || 'Unknown User'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      // 更新本地状态
      setRecord(prev => prev ? { ...prev, status: newStatus } : null);
      
      if (newStatus === 'Approved') {
        setToast({ type: 'success', message: 'Record approved successfully!' });
      }
    } catch (error) {
      console.error('Error updating status:', error);
      setToast({ type: 'error', message: 'Failed to update record status. Please try again.' });
    }
  };

  const handleDelete = async () => {
    if (!record) return;

    if (!confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
      return;
    }

    setDeleting('record');
    try {
      const response = await fetch(`/api/sheets/delete/${record.key}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete record');
      }

      setToast({ type: 'success', message: 'Record deleted successfully!' });
      router.push('/financial-list');
    } catch (error) {
      console.error('Error deleting record:', error);
      setToast({ type: 'error', message: 'Failed to delete record. Please try again.' });
    } finally {
      setDeleting(null);
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
      // 收据数据直接存储在Google Drive中，不需要本地存储
      setToast({ type: 'success', message: 'Receipt deleted successfully!' });
    } catch (error) {
      console.error('Error deleting receipt:', error);
      setToast({ type: 'error', message: 'Failed to delete receipt. Please try again.' });
    } finally {
      setDeleting(null);
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

  const handleRenameDisplayName = async (receiptKey: string, newDisplayName: string) => {
    try {
      const res = await fetch('/api/sheets/receipts/update-display-name', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptKey, displayName: newDisplayName }),
      });
      if (!res.ok) {
        let msg = '重命名失败：';
        if (res.status === 404) {
          msg += '接口未找到或收据不存在，请刷新页面重试。';
        } else if (res.status === 400) {
          msg += '缺少必要参数。';
        } else if (res.status === 500) {
          msg += '服务器内部错误，请稍后再试。';
        } else {
          msg += '发生未知错误。';
        }
        // 读取后端返回的详细error
        try {
          const data = await res.json();
          if (data.error) msg += ` [${data.error}]`;
        } catch {}
        setToast({ type: 'error', message: msg });
        return;
      }
      setToast({ type: 'success', message: 'Display name updated' });
      setEditingReceiptKey(null);
      setEditingDisplayName('');
      loadRecordDetails();
    } catch (e) {
      setToast({ type: 'error', message: '重命名失败：网络异常或服务器无响应。' });
    }
  };

  const startEdit = () => {
    if (record) {
      setEditForm({
        date: record.date?.split(' ')[0] || '',
        type: record.type,
        amount: record.amount,
        account: record.account,
        description: record.description,
        who: record.who,
        remark: record.remark || '',
      });
      setIsEditing(true);
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditForm(null);
  };

  const saveEdit = async () => {
    if (!editForm) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/sheets/update/${record.key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          amount: Number(editForm.amount),
          lastUserUpdate: userProfile?.name || userProfile?.email || '',
        }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setToast({ type: 'success', message: 'Record updated!' });
      setIsEditing(false);
      setEditForm(null);
      loadRecordDetails();
    } catch (e) {
      setToast({ type: 'error', message: 'Update failed' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <X className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Record Not Found</h3>
          <p className="mt-1 text-sm text-gray-500">{error || 'The requested record could not be found'}</p>
          <div className="mt-6">
            <Link href="/financial-list" className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
              Back to Records
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <LoggedInUser>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
        <header className="sticky top-0 z-50 bg-white shadow-sm border-b dark:bg-slate-800 dark:border-slate-700">
          <div className="w-full px-3 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center h-auto sm:h-16 py-3 sm:py-0">
              <div className="flex items-center mb-3 sm:mb-0">
                <Link href="/financial-list" className="mr-3 sm:mr-4">
                  <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-gray-600 dark:text-slate-400" />
                </Link>
                <h1 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-slate-100">
                  <span className="hidden sm:inline">Record Details</span>
                  <span className="sm:hidden">Details</span>
                </h1>
              </div>
              
              {/* Desktop buttons */}
              <div className="hidden sm:flex items-center gap-3 sm:gap-4">
                <button
                  onClick={startEdit}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:text-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"
                >
                  <Edit className="h-4 w-4" />
                  Edit Record
                </button>
                <button
                  onClick={handleDelete}
                  disabled={!!deleting}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
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
                  onClick={startEdit}
                  className="flex items-center justify-center w-10 h-10 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:text-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"
                  title="Edit Record"
                >
                  <Edit className="h-5 w-5" />
                </button>
                <button
                  onClick={handleDelete}
                  disabled={!!deleting}
                  className="flex items-center justify-center w-10 h-10 text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={deleting ? 'Deleting...' : 'Delete'}
                >
                  {deleting ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <Trash2 className="h-5 w-5" />
                  )}
                </button>
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
          ) : record ? (
            <div className="max-w-4xl mx-auto">
              {/* Record Details */}
              <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6 mb-6 sm:mb-8 dark:bg-slate-800 dark:border-slate-700">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-base sm:text-lg font-medium text-gray-900 dark:text-slate-100">Record Information</h2>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    record.status === 'Approved' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  }`}>
                    {record.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-slate-400">Date</label>
                      {isEditing ? (
                        <input type="date" className="input input-bordered w-full" value={editForm?.date || ''} onChange={e => setEditForm((f: any) => ({ ...f, date: e.target.value }))} />
                      ) : (
                        <p className="text-sm sm:text-base text-gray-900 dark:text-slate-100">{formatDate(record.date)}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-slate-400">Type</label>
                      {isEditing ? (
                        <select className="input input-bordered w-full" value={editForm?.type} onChange={e => setEditForm((f: any) => ({ ...f, type: e.target.value }))}>
                          <option value="Income">Income</option>
                          <option value="Expense">Expense</option>
                        </select>
                      ) : (
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${record.type === 'Income' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>{record.type}</span>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-slate-400">Amount</label>
                      {isEditing ? (
                        <input type="number" className="input input-bordered w-full" value={editForm?.amount} onChange={e => setEditForm((f: any) => ({ ...f, amount: e.target.value }))} />
                      ) : (
                        <p className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-slate-100">{formatCurrency(Number(record.amount))}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-slate-400">Account</label>
                      {isEditing ? (
                        <input className="input input-bordered w-full" value={editForm?.account} onChange={e => setEditForm((f: any) => ({ ...f, account: e.target.value }))} />
                      ) : (
                        <p className="text-sm sm:text-base text-gray-900 dark:text-slate-100">{record.account}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-slate-400">Description</label>
                      {isEditing ? (
                        <input className="input input-bordered w-full" value={editForm?.description} onChange={e => setEditForm((f: any) => ({ ...f, description: e.target.value }))} />
                      ) : (
                        <p className="text-sm sm:text-base text-gray-900 dark:text-slate-100">{record.description}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-slate-400">Who</label>
                      {isEditing ? (
                        <input className="input input-bordered w-full" value={editForm?.who} onChange={e => setEditForm((f: any) => ({ ...f, who: e.target.value }))} />
                      ) : (
                        <p className="text-sm sm:text-base text-gray-900 dark:text-slate-100">{record.who}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-slate-400">Remark</label>
                      {isEditing ? (
                        <input className="input input-bordered w-full" value={editForm?.remark} onChange={e => setEditForm((f: any) => ({ ...f, remark: e.target.value }))} />
                      ) : (
                        <p className="text-sm sm:text-base text-gray-900 dark:text-slate-100">{record.remark}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-slate-400">Created</label>
                      <p className="text-sm sm:text-base text-gray-900 dark:text-slate-100">{formatDateTime(record.createdDate)}</p>
                    </div>
                  </div>
                </div>
                {isEditing && (
                  <div className="flex gap-3 mt-6 justify-end">
                    <button onClick={cancelEdit} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">取消</button>
                    <button onClick={saveEdit} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center gap-2"><SaveIcon className="h-4 w-4" />保存</button>
                  </div>
                )}
              </div>

              {/* Receipts Section */}
              <div className="bg-white rounded-lg shadow-sm border dark:bg-slate-800 dark:border-slate-700">
                <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-slate-600">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-slate-100">Receipts ({receipts.length})</h3>
                    <input
                      id="receipt-file-input"
                      type="file"
                      className="sr-only"
                      accept="image/*,.pdf"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (file && record) {
                          setUploading(true);
                          try {
                            // 检查文件大小
                            const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
                            if (file.size > MAX_FILE_SIZE) {
                              alert(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the maximum limit of 10MB. Please choose a smaller file.`);
                              return;
                            }

                            // 创建FormData用于文件上传
                            const formData = new FormData();
                            formData.append('file', file);
                            formData.append('description', '');
                            formData.append('transactionKey', record.key);

                            // 上传到Google Drive
                            const driveResponse = await fetch('/api/drive/upload', {
                              method: 'POST',
                              body: formData,
                            });

                            if (!driveResponse.ok) {
                              const errorText = await driveResponse.text();
                              throw new Error(`Failed to upload file to Google Drive: ${driveResponse.status} ${errorText}`);
                            }

                            const driveResult = await driveResponse.json();

                            // 写入 Google Sheet
                            const sheetRes = await fetch('/api/sheets/receipts/create', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                transactionKey: record.key,
                                fileName: driveResult.originalName,
                                fileUrl: driveResult.fileUrl,
                                fileId: driveResult.fileId,
                                uploadBy: userProfile?.name || userProfile?.email || 'Unknown User',
                                description: '',
                                displayName: '',
                              }),
                            });

                            if (!sheetRes.ok) {
                              const err = await sheetRes.text();
                              setToast({ type: 'error', message: '上传到 Google Drive 成功，但写入 Google Sheet 失败！' });
                              return;
                            }

                            setToast({ type: 'success', message: 'Receipt uploaded successfully to Google Drive and Google Sheet!' });
                            loadRecordDetails(); // 刷新 receipts
                          } catch (error) {
                            console.error('Error uploading receipt:', error);
                            setToast({ type: 'error', message: 'Failed to upload receipt' });
                          } finally {
                            setUploading(false);
                          }
                        }
                        // Clear input value to allow selecting the same file again
                        event.target.value = '';
                      }}
                    />
                    <label
                      htmlFor="receipt-file-input"
                      className="inline-flex items-center gap-2 px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer dark:text-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"
                    >
                      {uploading ? <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : <Plus className="h-3 w-3 sm:h-4 sm:w-4" />}
                      Add Receipt
                    </label>
                  </div>
                </div>

                {receipts.length === 0 ? (
                  <div className="p-6 text-center">
                    <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-slate-400">No receipts uploaded for this record</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-slate-600">
                    {receipts.map((receipt) => {
                      const isImage = isImageFile(receipt.fileName);
                      
                      return (
                        <div
                          key={receipt.receiptKey}
                          className="p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {/* Image Preview */}
                            {isImage ? (
                              <div className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0">
                                <img
                                  src={receipt.fileUrl}
                                  alt={receipt.fileName}
                                  className="w-full h-full object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => window.open(receipt.fileUrl, '_blank')}
                                  title="Click to view full size"
                                />
                              </div>
                            ) : (
                              <div className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0 bg-gray-100 dark:bg-slate-600 rounded border flex items-center justify-center">
                                <Receipt className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 dark:text-slate-400" />
                              </div>
                            )}
                            
                            {/* File Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                                {receipt.fileName}
                              </p>
                              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 text-xs text-gray-500 dark:text-slate-400 mt-1">
                                <span>{formatDateTime(receipt.uploadDate)}</span>
                                <span>by {receipt.uploadBy}</span>
                                {receipt.description && (
                                  <span className="truncate">{receipt.description}</span>
                                )}
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2">
                              <a
                                href={receipt.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                                title="View receipt"
                              >
                                {getFileIcon(receipt.fileName)}
                              </a>
                              <a
                                href={receipt.fileUrl}
                                download={receipt.fileName}
                                className="text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                                title="Download receipt"
                              >
                                <Download className="h-4 w-4" />
                              </a>
                              <button
                                onClick={() => handleDeleteReceipt(receipt.receiptKey)}
                                disabled={!!deleting}
                                className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                                title="Delete receipt"
                              >
                                {deleting === receipt.receiptKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-slate-400">Record not found</p>
            </div>
          )}
        </div>
      </div>
    </LoggedInUser>
  );
} 