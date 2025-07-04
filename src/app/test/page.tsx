'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SuperAdminOnly } from '@/components/PermissionGate';
import Link from 'next/link';

export default function TestPage() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);

  const testConnection = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sheets/test');
      const data = await response.json();
      setTestResult(data);
    } catch (error) {
      setTestResult({ success: false, message: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SuperAdminOnly
      fallback={
        <div className="p-8 text-center text-red-500">
          <p>Access Denied. This is a test page for Super Admins only.</p>
        </div>
      }
    >
      <div className="container mx-auto p-8">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white shadow-sm border-b">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Link href="/" className="mr-4">
                  <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </Link>
                <h1 className="text-xl font-semibold text-gray-900">
                  Google Sheets API 测试
                </h1>
              </div>
              <Link
                href="/"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                返回首页
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-4xl mx-auto bg-white shadow-sm border rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              连接测试
            </h2>
            
            <button
              onClick={testConnection}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '测试中...' : '测试连接'}
            </button>

            {testResult && (
              <div className="mt-4">
                <div className={`p-4 rounded-md ${
                  testResult.success 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <h3 className={`font-medium ${
                    testResult.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {testResult.success ? '✅ 连接成功' : '❌ 连接失败'}
                  </h3>
                  <p className={`text-sm mt-1 ${
                    testResult.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {testResult.message}
                  </p>
                  
                  {testResult.details && (
                    <div className="mt-2">
                      <p className="text-xs text-red-600">
                        详细信息: {testResult.details}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white shadow-sm border rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              配置信息
            </h2>
            <div className="space-y-2 text-sm">
              <p><strong>Sheet ID:</strong> 1snronZm3JBqcfbmzX7IQR_gSDDj80aR5DtppMLYMwOM</p>
              <p><strong>Service Account:</strong> pacmc-money-sheets@pacmc-money-management.iam.gserviceaccount.com</p>
              <p><strong>Project ID:</strong> pacmc-money-management</p>
              <p><strong>当前用户:</strong> {userProfile?.email} ({userProfile?.role})</p>
            </div>
          </div>
        </div>
      </div>
    </SuperAdminOnly>
  );
} 