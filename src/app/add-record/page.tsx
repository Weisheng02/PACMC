'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoggedInUser } from '@/components/PermissionGate';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, X, Receipt, Trash2, Loader2 } from 'lucide-react';
import Link from 'next/link';

const ACCOUNTS = ['MIYF'];
const TYPES = ['Income', 'Expense'];

interface PendingReceipt {
  id: string;
  file: File;
  preview?: string;
  customName?: string;
  displayName?: string;
}

export default function AddRecordPage() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [pendingReceipts, setPendingReceipts] = useState<PendingReceipt[]>([]);
  const [uploadingReceipts, setUploadingReceipts] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  const [formData, setFormData] = useState({
    type: 'Expense' as 'Income' | 'Expense',
    date: new Date().toISOString().split('T')[0],
    account: 'MIYF',
    who: '',
    amount: 0,
    description: '',
    remark: '',
  });

  // Toast notification effect
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. 创建记录
      const recordData = {
        account: formData.account,
        date: formData.date,
        type: formData.type,
        who: formData.who,
        amount: Number(formData.amount),
        description: formData.description,
        remark: formData.remark,
        createdBy: userProfile?.name || userProfile?.email || 'Unknown User',
      };
      
      const response = await fetch('/api/sheets/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(recordData),
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(responseData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (!responseData.record || !responseData.record.key) {
        throw new Error('Failed to create record');
      }

      const recordKey = responseData.record.key;
      showToast('success', 'Record created successfully!');

      // 2. 如果有待上传的收据，上传它们
      if (pendingReceipts.length > 0) {
        setUploadingReceipts(true);
        let uploadedCount = 0;
        
        for (const pendingReceipt of pendingReceipts) {
          try {
            const formDataForUpload = new FormData();
            formDataForUpload.append('file', pendingReceipt.file, pendingReceipt.customName || pendingReceipt.file.name);
            formDataForUpload.append('description', '');
            formDataForUpload.append('transactionKey', recordKey);

            const driveResponse = await fetch('/api/drive/upload', {
              method: 'POST',
              body: formDataForUpload,
            });

            if (driveResponse.ok) {
              uploadedCount++;
              const driveResult = await driveResponse.json();
              await fetch('/api/sheets/receipts/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  transactionKey: recordKey,
                  fileName: driveResult.originalName,
                  fileUrl: driveResult.fileUrl,
                  fileId: driveResult.fileId,
                  uploadBy: userProfile?.name || userProfile?.email || 'Unknown User',
                  description: '',
                  displayName: pendingReceipt.displayName || '',
                }),
              });
            } else {
              console.error(`Failed to upload receipt: ${pendingReceipt.file.name}`);
            }
          } catch (error) {
            console.error(`Error uploading receipt: ${pendingReceipt.file.name}`, error);
          }
        }

        setUploadingReceipts(false);
        
        if (uploadedCount > 0) {
          showToast('success', `Record created and ${uploadedCount} receipt(s) uploaded successfully!`);
        } else {
          showToast('error', 'Record created but failed to upload receipts');
        }
      }

      // 3. 跳转到记录列表
      router.push('/financial-list');
    } catch (error) {
      console.error('Error adding record:', error);
      showToast('error', 'Failed to create record');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newReceipts: PendingReceipt[] = Array.from(files).map(file => ({
        id: Math.random().toString(36).substr(2, 8),
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      }));
      
      setPendingReceipts(prev => [...prev, ...newReceipts]);
    }
    // 清空input值，允许重复选择同一文件
    event.target.value = '';
  };

  const handleRemoveReceipt = (id: string) => {
    setPendingReceipts(prev => {
      const receipt = prev.find(r => r.id === id);
      if (receipt?.preview) {
        URL.revokeObjectURL(receipt.preview);
      }
      return prev.filter(r => r.id !== id);
    });
  };

  const isImageFile = (fileName: string) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    return imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
  };

  return (
    <div>
      <LoggedInUser
        fallback={
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
              <X className="mx-auto h-12 w-12 text-red-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Permission Denied</h3>
              <p className="mt-1 text-sm text-gray-500">Please log in to add financial records</p>
              <div className="mt-6">
                <Link href="/" className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">Return to Homepage</Link>
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
                  <Link href="/" className="mr-4">
                    <ArrowLeft className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600" />
                  </Link>
                  <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
                    <span className="hidden sm:inline">Add Financial Record</span>
                    <span className="sm:hidden">Add Record</span>
                  </h1>
                </div>
              </div>
            </div>
          </header>
          {/* Main Content */}
          <main className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
            <div className="max-w-4xl mx-auto">
              {/* Toast Notification */}
              {toast && (
                <div className={`fixed top-4 right-4 z-50 p-4 rounded-md shadow-lg ${
                  toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                }`}>
                  {toast.message}
                </div>
              )}

              {/* Add Record Form */}
              <div className="bg-white shadow-sm border rounded-lg p-4 sm:p-6 mb-6">
                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                  {/* Record Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Record Type *
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="type"
                          value="Income"
                          checked={formData.type === 'Income'}
                          onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'Income' | 'Expense' }))}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-700">Income</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="type"
                          value="Expense"
                          checked={formData.type === 'Expense'}
                          onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'Income' | 'Expense' }))}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-700">Expense</span>
                      </label>
                    </div>
                  </div>

                  {/* Date and Account */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date *
                      </label>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Account *
                      </label>
                      <select
                        value={formData.account}
                        onChange={(e) => setFormData(prev => ({ ...prev, account: e.target.value }))}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      >
                        <option value="MIYF">MIYF</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  {/* Who and Amount */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Name *
                      </label>
                      <input
                        type="text"
                        value={formData.who}
                        onChange={(e) => setFormData(prev => ({ ...prev, who: e.target.value }))}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        placeholder="Enter the name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Amount *
                      </label>
                      <input
                        type="number"
                        value={formData.amount}
                        onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
                        required
                        min="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description *
                    </label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="Enter description"
                    />
                  </div>

                  {/* Receipts Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Receipts (Optional)
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors">
                      <div className="text-center">
                        <Receipt className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="mt-4">
                          <label htmlFor="receipt-file-input" className="cursor-pointer">
                            <span className="mt-2 block text-sm font-medium text-gray-900">
                              Upload Receipts
                            </span>
                            <span className="mt-1 block text-xs text-gray-500">
                              PNG, JPG, PDF up to 10MB
                            </span>
                          </label>
                          <input
                            id="receipt-file-input"
                            type="file"
                            className="sr-only"
                            accept="image/*,.pdf"
                            onChange={handleFileSelect}
                            multiple
                          />
                        </div>
                      </div>
                    </div>

                    {/* Pending Receipts List */}
                    {pendingReceipts.length > 0 && (
                      <div className="mt-4 space-y-3">
                        <h4 className="text-sm font-medium text-gray-700">
                          Selected Receipts ({pendingReceipts.length})
                        </h4>
                        {pendingReceipts.map((receipt, idx) => (
                          <div
                            key={receipt.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                          >
                            <div className="flex items-center space-x-3 flex-1">
                              {/* Preview */}
                              {receipt.preview ? (
                                <div className="w-12 h-12 flex-shrink-0">
                                  <img
                                    src={receipt.preview}
                                    alt={receipt.file.name}
                                    className="w-full h-full object-cover rounded border"
                                  />
                                </div>
                              ) : (
                                <div className="w-12 h-12 flex-shrink-0 bg-gray-100 rounded border flex items-center justify-center">
                                  <Receipt className="h-5 w-5 text-gray-500" />
                                </div>
                              )}
                              
                              {/* File Info + Editable Name + Display Name */}
                              <div className="flex-1 min-w-0">
                                <input
                                  type="text"
                                  value={receipt.customName ?? receipt.file.name}
                                  onChange={e => {
                                    const newName = e.target.value;
                                    setPendingReceipts(prev => prev.map((r, i) => i === idx ? { ...r, customName: newName } : r));
                                  }}
                                  className="text-sm font-medium text-gray-900 truncate border-b border-gray-300 focus:border-blue-500 outline-none bg-transparent mb-1"
                                />
                                <input
                                  type="text"
                                  value={receipt.displayName ?? ''}
                                  onChange={e => {
                                    const newDisplayName = e.target.value;
                                    setPendingReceipts(prev => prev.map((r, i) => i === idx ? { ...r, displayName: newDisplayName } : r));
                                  }}
                                  className="text-xs text-blue-700 border-b border-blue-200 focus:border-blue-500 outline-none bg-transparent"
                                  placeholder="Web显示名（可选）"
                                />
                                <p className="text-xs text-gray-500">{(receipt.file.size / 1024 / 1024).toFixed(2)} MB</p>
                              </div>
                            </div>
                            
                            {/* Remove Button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveReceipt(receipt.id)}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Remark */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Remark (Optional)
                    </label>
                    <textarea
                      value={formData.remark}
                      onChange={(e) => setFormData(prev => ({ ...prev, remark: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="Additional notes (optional)"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="flex flex-col sm:flex-row justify-end gap-3 sm:space-x-4 pt-4">
                    <Link
                      href="/"
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 text-center"
                    >
                      Cancel
                    </Link>
                    <button
                      type="submit"
                      disabled={loading || uploadingReceipts}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating Record...
                        </>
                      ) : uploadingReceipts ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading Receipts...
                        </>
                      ) : (
                        'Add Record'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </main>
        </div>
      </LoggedInUser>
    </div>
  );
} 