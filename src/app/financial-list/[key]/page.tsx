'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { LoggedInUser } from '@/components/PermissionGate';
import { ArrowLeft, Edit, Trash2, Receipt, Eye, Download, X, CheckCircle, Clock, Plus, XCircle, Loader2 } from 'lucide-react';
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
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Link href="/financial-list" className="mr-4">
                  <ArrowLeft className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600" />
                </Link>
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
                  Record Details
                </h1>
              </div>
              <div className="flex items-center space-x-3">
                <Link
                  href={`/edit-record/${record.key}`}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Link>
                {(isAdmin || isSuperAdmin) && (
                  <button
                    onClick={handleDelete}
                    disabled={deleting !== null}
                    className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Record Details Card */}
            <div className="bg-white shadow-sm border rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Financial Record</h2>
                <div className="flex items-center space-x-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      record.type === 'Income'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {record.type}
                  </span>
                  <div className="flex items-center">
                    {record.status === 'Approved' ? (
                      <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                    ) : (
                      <Clock className="h-4 w-4 text-yellow-500 mr-1" />
                    )}
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        record.status === 'Approved'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {record.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Amount</label>
                    <p className={`text-2xl font-bold ${
                      record.type === 'Income' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(record.amount)}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Date</label>
                    <p className="text-sm text-gray-900">{formatDate(record.date)}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Account</label>
                    <p className="text-sm text-gray-900">{record.account}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Name</label>
                    <p className="text-sm text-gray-900">{record.who}</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Description</label>
                    <p className="text-sm text-gray-900">{record.description}</p>
                  </div>
                  
                  {record.remark && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Remark</label>
                      <p className="text-sm text-gray-900">{record.remark}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Created By</label>
                    <p className="text-sm text-gray-900">{record.createdBy}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Created Date</label>
                    <p className="text-sm text-gray-900">{formatDateTime(record.createdDate)}</p>
                  </div>
                </div>
              </div>

              {/* Status Management */}
              {(isAdmin || isSuperAdmin) && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Status Management</h3>
                  <div className="flex items-center space-x-3">
                    <select
                      value={record.status}
                      onChange={(e) => handleStatusToggle(e.target.value as 'Pending' | 'Approved')}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Approved">Approved</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Receipts Card */}
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
                        
                        // 创建收据记录
                        const newReceipt: Receipt = {
                          receiptKey: Math.random().toString(36).substr(2, 8),
                          transactionKey: record.key,
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
                        // 收据数据直接存储在Google Drive中，不需要本地存储
                        setToast({ type: 'success', message: 'Receipt uploaded successfully to Google Drive!' });
                      } catch (error) {
                        console.error('Error uploading receipt:', error);
                        setToast({ type: 'error', message: 'Failed to upload receipt' });
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

        {/* Toast Notification */}
        {toast && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded shadow flex items-center space-x-2 ${toast.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {toast.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </LoggedInUser>
  );
} 