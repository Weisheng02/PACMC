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
    // Clear input value to allow selecting the same file again
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
          <div className="min-h-screen bg-gray-50 flex items-center justify-center dark:bg-slate-900">
            <div className="text-center">
              <X className="mx-auto h-12 w-12 text-red-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-slate-100">Permission Denied</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Please log in to add financial records</p>
              <div className="mt-6">
                <Link href="/" className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">Return to Homepage</Link>
              </div>
            </div>
          </div>
        }
      >
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
          {/* Header */}
          <header className="sticky top-0 z-50 bg-white shadow-sm border-b dark:bg-slate-800 dark:border-slate-700">
            <div className="w-full px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center">
                  <Link href="/" className="mr-4">
                    <ArrowLeft className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600 dark:text-slate-400" />
                  </Link>
                  <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-slate-100">
                    <span className="hidden sm:inline">Add Financial Record</span>
                    <span className="sm:hidden">Add Record</span>
                  </h1>
                </div>
              </div>
            </div>
          </header>
          {/* Main Content */}
          <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
            <div className="max-w-2xl mx-auto">
              {/* Toast Notification */}
              {toast && (
                <div className="fixed top-4 right-4 z-50">
                  <div className={`px-4 py-2 rounded-md shadow-lg ${
                    toast.type === 'success' 
                      ? 'bg-green-500 text-white' 
                      : 'bg-red-500 text-white'
                  }`}>
                    {toast.message}
                  </div>
                </div>
              )}

              {/* Add Record Form */}
              <div className="bg-white rounded-lg shadow-sm border p-6 dark:bg-slate-800 dark:border-slate-700">
                <h2 className="text-lg font-medium text-gray-900 mb-6 dark:text-slate-100">Record Details</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Record Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">
                      Record Type *
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as 'Income' | 'Expense' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                      required
                    >
                      {TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  {/* Date and Account */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">
                        Date *
                      </label>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">
                        Account *
                      </label>
                      <select
                        value={formData.account}
                        onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                        required
                      >
                        {ACCOUNTS.map(account => (
                          <option key={account} value={account}>{account}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Who and Amount */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">
                        Name *
                      </label>
                      <input
                        type="text"
                        value={formData.who}
                        onChange={(e) => setFormData({ ...formData, who: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                        placeholder="Enter the name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">
                        Amount (RM) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                        required
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">
                      Description *
                    </label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                      placeholder="Enter description"
                      required
                    />
                  </div>

                  {/* Remark */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">
                      Remark
                    </label>
                    <textarea
                      value={formData.remark}
                      onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                      placeholder="Enter additional remarks (optional)"
                    />
                  </div>
                </form>
              </div>

              {/* Receipts Upload Section */}
              <div className="bg-white rounded-lg shadow-sm border p-6 dark:bg-slate-800 dark:border-slate-700">
                <h2 className="text-lg font-medium text-gray-900 mb-6 dark:text-slate-100">Receipts (Optional)</h2>
                
                <div className="space-y-4">
                  {/* File Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">
                      Upload Receipts
                    </label>
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 dark:border-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Receipt className="w-8 h-8 mb-4 text-gray-500 dark:text-slate-400" />
                          <p className="mb-2 text-sm text-gray-500 dark:text-slate-400">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">PDF, JPG, PNG (MAX. 10MB each)</p>
                        </div>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Pending Receipts */}
                  {pendingReceipts.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-3 dark:text-slate-300">Pending Uploads ({pendingReceipts.length})</h3>
                      <div className="space-y-2">
                        {pendingReceipts.map((receipt) => (
                          <div key={receipt.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg dark:bg-slate-700">
                            <div className="flex items-center space-x-3">
                              {receipt.preview && isImageFile(receipt.file.name) ? (
                                <img
                                  src={receipt.preview}
                                  alt="Preview"
                                  className="w-10 h-10 object-cover rounded"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center dark:bg-slate-600">
                                  <Receipt className="w-5 h-5 text-gray-500 dark:text-slate-400" />
                                </div>
                              )}
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                  {receipt.customName || receipt.file.name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-slate-400">
                                  {(receipt.file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveReceipt(receipt.id)}
                              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end space-x-4">
                <Link
                  href="/financial-list"
                  className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:text-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={loading || uploadingReceipts}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </div>
                  ) : uploadingReceipts ? (
                    <div className="flex items-center">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading Receipts...
                    </div>
                  ) : (
                    'Create Record'
                  )}
                </button>
              </div>
            </div>
          </main>
        </div>
      </LoggedInUser>
    </div>
  );
} 