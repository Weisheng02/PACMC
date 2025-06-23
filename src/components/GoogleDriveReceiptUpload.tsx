'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { formatGoogleSheetsDate } from '@/lib/googleSheets';
import { 
  Upload, 
  X, 
  Eye, 
  Download, 
  Trash2, 
  FileText,
  Image,
  File,
  Camera
} from 'lucide-react';
import ImagePreview from './ImagePreview';

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

interface GoogleDriveReceiptUploadProps {
  transactionKey: string | null;
  onReceiptUploaded?: (receipt: Receipt) => void;
  onReceiptDeleted?: (receiptKey: string) => void;
}

export default function GoogleDriveReceiptUpload({ 
  transactionKey, 
  onReceiptUploaded, 
  onReceiptDeleted 
}: GoogleDriveReceiptUploadProps) {
  const { userProfile } = useAuth();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    description: '',
  });
  const [previewImage, setPreviewImage] = useState<Receipt | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 检查是否可以使用上传功能
  const canUpload = transactionKey !== null;

  // 加载收据 - 从Google Drive获取
  const loadReceipts = async () => {
    if (!transactionKey) return;
    
    try {
      const receiptsResponse = await fetch(`/api/drive/list?transactionKey=${transactionKey}`);
      if (receiptsResponse.ok) {
        const receiptsData = await receiptsResponse.json();
        setReceipts(receiptsData.receipts || []);
      } else {
        console.error('Failed to load receipts from Google Drive');
        setReceipts([]);
      }
    } catch (error) {
      console.error('Error loading receipts:', error);
      setReceipts([]);
    }
  };

  // 保存receipts - 不再使用localStorage
  const saveReceipts = (receipts: Receipt[]) => {
    // 收据数据直接存储在Google Drive中，不需要本地存储
    console.log('Receipts saved to Google Drive:', receipts.length);
  };

  // 组件挂载时加载收据
  useEffect(() => {
    loadReceipts();
  }, [transactionKey]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setShowUploadForm(true);
    }
  };

  const handleUpload = async () => {
    if (!fileInputRef.current?.files?.[0] || !userProfile || !transactionKey) {
      console.log('Upload validation failed:', {
        hasFile: !!fileInputRef.current?.files?.[0],
        hasUserProfile: !!userProfile,
        hasTransactionKey: !!transactionKey
      });
      return;
    }

    const file = fileInputRef.current.files[0];
    console.log('Starting upload for file:', file.name, 'size:', file.size);
    
    // 检查文件大小
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      alert(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the maximum limit of 10MB. Please choose a smaller file.`);
      return;
    }
    
    setUploading(true);

    try {
      console.log('Uploading file to Google Drive...');
      
      // 创建FormData用于文件上传
      const formData = new FormData();
      formData.append('file', file);
      formData.append('description', uploadForm.description || '');
      formData.append('transactionKey', transactionKey);

      // 上传到Google Drive
      const driveResponse = await fetch('/api/drive/upload', {
        method: 'POST',
        body: formData,
      });

      console.log('Google Drive upload response status:', driveResponse.status);
      
      if (!driveResponse.ok) {
        const errorText = await driveResponse.text();
        console.error('Google Drive upload error:', errorText);
        throw new Error(`Failed to upload file to Google Drive: ${driveResponse.status} ${errorText}`);
      }

      const driveResult = await driveResponse.json();
      console.log('Google Drive upload result:', driveResult);
      
      // 创建收据记录 - 直接存储在本地
      const newReceipt: Receipt = {
        receiptKey: Math.random().toString(36).substr(2, 8),
        transactionKey,
        fileName: driveResult.originalName,
        fileUrl: driveResult.fileUrl, // Google Drive view link
        fileId: driveResult.fileId,   // Google Drive file ID
        downloadUrl: driveResult.downloadUrl, // Google Drive download link
        uploadBy: userProfile?.name || userProfile?.email || 'Unknown User',
        description: uploadForm.description || '',
        uploadDate: new Date().toISOString(),
      };

      // 添加到本地存储
      const updatedReceipts = [newReceipt, ...receipts];
      setReceipts(updatedReceipts);
      saveReceipts(updatedReceipts);

      setShowUploadForm(false);
      setUploadForm({ description: '' });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      onReceiptUploaded?.(newReceipt);
      console.log('Upload completed successfully');
      
      alert('Receipt uploaded successfully to Google Drive!');
    } catch (error) {
      console.error('Error uploading receipt:', error);
      alert(`Failed to upload receipt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteReceipt = async (receiptKey: string) => {
    if (!confirm('Are you sure you want to delete this receipt?')) return;

    setDeleting(receiptKey);
    try {
      // 找到要删除的receipt
      const receiptToDelete = receipts.find(r => r.receiptKey === receiptKey);
      
      if (receiptToDelete?.fileId) {
        console.log('Attempting to delete file from Google Drive:', receiptToDelete.fileId);
        
        // 从Google Drive删除文件
        const response = await fetch(`/api/drive/delete/${receiptToDelete.fileId}`, {
          method: 'DELETE',
        });

        console.log('Delete response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.warn('Failed to delete file from Google Drive:', errorText);
          // 继续删除本地记录，但显示警告
          alert('Warning: File could not be deleted from Google Drive, but local record will be removed.');
        } else {
          console.log('File deleted successfully from Google Drive');
        }
      } else {
        console.log('No fileId found, skipping Google Drive deletion');
      }

      // 从本地存储删除
      const updatedReceipts = receipts.filter(r => r.receiptKey !== receiptKey);
      setReceipts(updatedReceipts);
      saveReceipts(updatedReceipts);
      
      onReceiptDeleted?.(receiptKey);
      alert('Receipt deleted successfully!');
    } catch (error) {
      console.error('Error deleting receipt:', error);
      alert(`Failed to delete receipt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeleting(null);
    }
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension || '')) {
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

  const formatDate = (dateString: string) => {
    return formatGoogleSheetsDate(dateString, 'zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const isImageFile = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension || '');
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
                {canUpload ? 'Upload Receipt to Google Drive' : 'Upload Receipt (will be available after record creation)'}
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
              disabled={!canUpload}
            />
          </div>
        </div>
      </div>

      {/* Upload Form */}
      {showUploadForm && canUpload && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Upload Receipt to Google Drive</h3>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                placeholder="Enter description..."
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
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : 'Upload to Drive'}
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
            {receipts.map((receipt) => {
              const isImage = isImageFile(receipt.fileName);
              
              return (
                <div
                  key={receipt.receiptKey}
                  className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-3 flex-1">
                    {/* 图片预览 */}
                    {isImage ? (
                      <div className="w-16 h-16 flex-shrink-0">
                        <img
                          src={receipt.fileUrl}
                          alt={receipt.fileName}
                          className="w-full h-full object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setPreviewImage(receipt)}
                          title="Click to view full size"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 flex-shrink-0 bg-gray-100 rounded border flex items-center justify-center">
                        {getFileIcon(receipt.fileName)}
                      </div>
                    )}
                    
                    {/* 文件信息 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {receipt.fileName}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>{formatDate(receipt.uploadDate)}</span>
                        <span>by {receipt.uploadBy}</span>
                        {receipt.description && (
                          <span className="truncate">{receipt.description}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center space-x-2 ml-4">
                    {isImage ? (
                      <button
                        onClick={() => setPreviewImage(receipt)}
                        className="text-gray-400 hover:text-blue-600"
                        title="View full size"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    ) : (
                      <a
                        href={receipt.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-blue-600"
                        title="View file"
                      >
                        <Eye className="h-4 w-4" />
                      </a>
                    )}
                    
                    <a
                      href={receipt.downloadUrl || receipt.fileUrl}
                      download={receipt.fileName}
                      className="text-gray-400 hover:text-green-600"
                      title="Download file"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                    
                    <button
                      onClick={() => handleDeleteReceipt(receipt.receiptKey)}
                      disabled={deleting === receipt.receiptKey}
                      className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                      title="Delete receipt"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {previewImage && (
        <ImagePreview
          src={previewImage.fileUrl}
          alt={previewImage.fileName}
          fileName={previewImage.fileName}
          downloadUrl={previewImage.downloadUrl}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
} 