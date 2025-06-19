'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { FinanceOnly } from '@/components/PermissionGate';
import { addFinancialRecord } from '@/lib/googleSheets';
import { ArrowLeft, Save, X } from 'lucide-react';
import Link from 'next/link';

const ACCOUNTS = ['MIYF'];
const TYPES = ['Income', 'Expense'];

export default function AddRecordPage() {
  const router = useRouter();
  const { userProfile, authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    account: 'MIYF',
    date: new Date().toISOString().split('T')[0],
    type: 'Expense' as 'Income' | 'Expense',
    who: '',
    amount: '',
    description: '',
    remark: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 检查用户状态
    if (authLoading) {
      alert('请等待用户信息加载完成');
      return;
    }
    
    if (!userProfile) {
      alert('请先登录系统');
      return;
    }
    
    if (!formData.account || !formData.date || !formData.type || !formData.who || !formData.description || !formData.amount) {
      alert('请填写所有必填字段');
      return;
    }
    if (isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      alert('请输入有效的金额');
      return;
    }
    setLoading(true);
    try {
      const recordData = {
        account: formData.account,
        date: formData.date,
        type: formData.type,
        who: formData.who,
        amount: Number(formData.amount),
        description: formData.description,
        remark: formData.remark,
        createdBy: userProfile?.name || userProfile?.email || '未知用户',
      };
      
      console.log('准备提交的记录数据:', recordData);
      console.log('当前用户信息:', userProfile);
      
      const response = await fetch('/api/sheets/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(recordData),
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('服务器返回错误:', {
          status: response.status,
          statusText: response.statusText,
          data: responseData
        });
        throw new Error(responseData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('记录添加成功:', responseData);
      alert('记录添加成功！');
      router.push('/financial-list');
    } catch (error) {
      console.error('添加记录时出错:', error);
      let errorMessage = '添加记录失败，请重试\n';
      
      if (error instanceof Error) {
        errorMessage += `错误详情: ${error.message}\n`;
      }
      
      errorMessage += `\n当前用户: ${userProfile?.name || userProfile?.email || '未知用户'}\n`;
      errorMessage += `用户角色: ${userProfile?.role || '未知'}\n`;
      errorMessage += `请检查控制台(F12)以获取更多信息`;
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FinanceOnly
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <X className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">权限不足</h3>
            <p className="mt-1 text-sm text-gray-500">只有财政成员可以添加财务记录</p>
            <div className="mt-6">
              <Link href="/" className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">返回首页</Link>
            </div>
          </div>
        </div>
      }
    >
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Link href="/financial-list" className="mr-4">
                  <ArrowLeft className="h-8 w-8 text-gray-600" />
                </Link>
                <h1 className="text-xl font-semibold text-gray-900">新增财务记录</h1>
              </div>
            </div>
          </div>
        </header>
        {/* Main Content */}
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white shadow-sm border rounded-lg p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 账户 */}
              <div>
                <label htmlFor="account" className="block text-sm font-medium text-gray-700 mb-2">账户 *</label>
                <select
                  id="account"
                  value={formData.account}
                  onChange={(e) => setFormData(prev => ({ ...prev, account: e.target.value }))}
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
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
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
                        onChange={() => setFormData(prev => ({ ...prev, type: type as 'Income' | 'Expense' }))}
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
                  onChange={(e) => setFormData(prev => ({ ...prev, who: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                  placeholder="请输入记录人姓名"
                  required
                />
              </div>
              {/* 描述 */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">描述 *</label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                  placeholder="请输入详细描述..."
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
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                  placeholder="请输入金额"
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
                  value={formData.remark}
                  onChange={(e) => setFormData(prev => ({ ...prev, remark: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                  placeholder="请输入备注（可选）"
                />
              </div>
              {/* 提交按钮 */}
              <div className="flex justify-end gap-4 pt-6 border-t">
                <Link href="/financial-list" className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">取消</Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {loading ? '保存中...' : '保存记录'}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </FinanceOnly>
  );
} 