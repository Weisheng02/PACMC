'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Upload, 
  X, 
  Eye, 
  Download, 
  Trash2, 
  Tag, 
  FileText,
  Image,
  File,
  Camera
} from 'lucide-react';
import { 
  Receipt, 
  uploadReceipt, 
  getReceiptsByRecord, 
  deleteReceipt 
} from '@/lib/firebase';

interface ReceiptUploadProps {
  recordKey: string | null; // 改为可选的，支持记录创建前显示
  onReceiptUploaded?: (receipt: Receipt) => void;
  onReceiptDeleted?: (receiptId: string) => void;
  pendingFiles?: File[]; // 新增：待上传的文件列表
  onPendingFilesChange?: (files: File[]) => void; // 新增：更新待上传文件列表
}

export default function ReceiptUpload({ 
  recordKey, 
  onReceiptUploaded, 
  onReceiptDeleted,
  pendingFiles = [],
  onPendingFilesChange
}: ReceiptUploadProps) {
  const { userProfile } = useAuth();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    description: '',
    tags: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 检查是否可以使用上传功能
  const canUpload = recordKey !== null;

  // 加载收据
  const loadReceipts = async () => {
    if (!recordKey) return;
    
    try {
      const recordReceipts = await getReceiptsByRecord(recordKey);
      setReceipts(recordReceipts);
    } catch (error) {
      console.error('Error loading receipts:', error);
    }
  };

  // 组件挂载时加载收据
  useEffect(() => {
    loadReceipts();
  }, [recordKey]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      if (canUpload) {
        setShowUploadForm(true);
      } else {
        // 如果记录还没创建，将文件添加到待上传列表
        const newFiles = Array.from(files);
        onPendingFilesChange?.([...pendingFiles, ...newFiles]);
      }
    }
  };

  const handleUpload = async () => {
    if (!fileInputRef.current?.files?.[0] || !userProfile || !recordKey) return;

    const file = fileInputRef.current.files[0];
    setUploading(true);

    try {
      const tags = uploadForm.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      const receipt = await uploadReceipt(
        file,
        recordKey,
        uploadForm.description || undefined,
        tags.length > 0 ? tags : undefined
      );

      setReceipts(prev => [receipt, ...prev]);
      setShowUploadForm(false);
      setUploadForm({ description: '', tags: '' });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      onReceiptUploaded?.(receipt);
    } catch (error) {
      console.error('Error uploading receipt:', error);
      alert('Failed to upload receipt. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteReceipt = async (receiptId: string) => {
    if (!confirm('Are you sure you want to delete this receipt?')) return;

    setDeleting(receiptId);
    try {
      await deleteReceipt(receiptId);
      setReceipts(prev => prev.filter(r => r.id !== receiptId));
      onReceiptDeleted?.(receiptId);
    } catch (error) {
      console.error('Error deleting receipt:', error);
      alert('Failed to delete receipt. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const handleDeletePendingFile = (index: number) => {
    const newFiles = pendingFiles.filter((_, i) => i !== index);
    onPendingFilesChange?.(newFiles);
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <Image className="h-5 w-5 text-blue-500" />;
    }
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      <div className={`border-2 border-dashed rounded-lg p-6 ${
        canUpload ? 'border-gray-300 hover:border-blue-400' : 'border-gray-200 bg-gray-50'
      }`}>
        <div className="text-center">
          <Upload className={`mx-auto h-12 w-12 ${canUpload ? 'text-gray-400' : 'text-gray-300'}`} />
          <div className="mt-4">
            <label htmlFor="file-upload" className={`cursor-pointer ${!canUpload ? 'pointer-events-none' : ''}`}>
              <span className="mt-2 block text-sm font-medium text-gray-900">
                {canUpload ? 'Upload Receipt' : 'Select Receipts (will upload after record creation)'}
              </span>
              <span className="mt-1 block text-xs text-gray-500">
                PNG, JPG, PDF up to 10MB
              </span>
              {!canUpload && (
                <span className="mt-1 block text-xs text-blue-600">
                  You can select files now, they will be uploaded after creating the record
                </span>
              )}
            </label>
            <input
              id="file-upload"
              name="file-upload"
              type="file"
              className="sr-only"
              accept="image/*,.pdf"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple={!canUpload} // 记录创建前允许多选
            />
          </div>
        </div>
      </div>

      {/* Pending Files (before record creation) */}
      {!canUpload && pendingFiles.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-3">
            Selected Files ({pendingFiles.length}) - Will upload after record creation
          </h3>
          <div className="space-y-2">
            {pendingFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                <div className="flex items-center space-x-2">
                  <File className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-700">{file.name}</span>
                  <span className="text-xs text-gray-500">({formatFileSize(file.size)})</span>
                </div>
                <button
                  onClick={() => handleDeletePendingFile(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Form */}
      {showUploadForm && canUpload && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Upload Receipt</h3>
            <button
              onClick={() => setShowUploadForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={uploadForm.description}
                onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter description..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags (optional)
              </label>
              <input
                type="text"
                value={uploadForm.tags}
                onChange={(e) => setUploadForm(prev => ({ ...prev, tags: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter tags separated by commas..."
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowUploadForm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipts List */}
      {receipts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-gray-900">Uploaded Receipts ({receipts.length})</h3>
          <div className="space-y-2">
            {receipts.map((receipt) => (
              <div
                key={receipt.id}
                className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center space-x-3">
                  {getFileIcon(receipt.mimeType)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {receipt.originalName}
                    </p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>{formatFileSize(receipt.fileSize)}</span>
                      <span>{formatDate(receipt.uploadedAt)}</span>
                      {receipt.description && (
                        <span className="truncate">{receipt.description}</span>
                      )}
                    </div>
                    {receipt.tags && receipt.tags.length > 0 && (
                      <div className="flex items-center space-x-1 mt-1">
                        <Tag className="h-3 w-3 text-gray-400" />
                        <div className="flex flex-wrap gap-1">
                          {receipt.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <a
                    href={receipt.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-blue-600"
                    title="View receipt"
                  >
                    <Eye className="h-4 w-4" />
                  </a>
                  <a
                    href={receipt.fileUrl}
                    download={receipt.originalName}
                    className="text-gray-400 hover:text-green-600"
                    title="Download receipt"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => handleDeleteReceipt(receipt.id)}
                    disabled={deleting === receipt.id}
                    className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                    title="Delete receipt"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 