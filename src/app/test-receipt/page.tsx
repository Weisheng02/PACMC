'use client';

import { useState } from 'react';
import GoogleDriveReceiptUpload from '@/components/GoogleDriveReceiptUpload';

export default function TestReceiptPage() {
  const [transactionKey, setTransactionKey] = useState<string>('test-key-123');

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Receipt Upload Test</h1>
        
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transaction Key (for testing)
            </label>
            <input
              type="text"
              value={transactionKey}
              onChange={(e) => setTransactionKey(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
              placeholder="Enter transaction key"
            />
          </div>
          
          <GoogleDriveReceiptUpload
            transactionKey={transactionKey}
            onReceiptUploaded={(receipt) => {
              console.log('Receipt uploaded:', receipt);
              alert('Receipt uploaded successfully!');
            }}
            onReceiptDeleted={(receiptKey) => {
              console.log('Receipt deleted:', receiptKey);
              alert('Receipt deleted successfully!');
            }}
          />
        </div>
      </div>
    </div>
  );
} 