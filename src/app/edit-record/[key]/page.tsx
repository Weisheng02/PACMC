'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AdminOrSuperAdmin } from '@/components/PermissionGate';
import { useAuth } from '@/contexts/AuthContext';
import { readFinancialRecords, updateFinancialRecord } from '@/lib/googleSheets';
import { ArrowLeft, Save, X } from 'lucide-react';
import Link from 'next/link';

const ACCOUNTS = ['MIYF'];
const TYPES = ['Income', 'Expense'];

export default function EditRecordPage() {
  const params = useParams();
  const router = useRouter();
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        }
      } catch (e) {
        setError('加载记录失败');
      } finally {
        setLoading(false);
      }
    }
    fetchRecord();
  }, [params.key]);

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
          <div className="max-w-2xl mx-auto bg-white shadow-sm border rounded-lg p-6">
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
        </main>
      </div>
    </AdminOrSuperAdmin>
  );
} 