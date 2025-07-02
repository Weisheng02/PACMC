'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LoggedInUser } from '@/components/PermissionGate';
import { Wallet, ArrowLeft, Check, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SetCashPage() {
  const { user, userProfile } = useAuth();
  const [cashInHand, setCashInHand] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cashForm, setCashForm] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    description: '',
  });
  const router = useRouter();

  useEffect(() => {
    fetchCashInHand();
  }, []);

  const fetchCashInHand = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sheets/cash-in-hand');
      if (response.ok) {
        const data = await response.json();
        const currentCash = data.cashInHand || 0;
        setCashInHand(currentCash);
        setCashForm(prev => ({
          ...prev,
          amount: currentCash,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch cash in hand:', error);
      setError('Failed to load current cash amount');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // 计算需要调整的金额（新金额 - 当前金额）
      const adjustmentAmount = cashForm.amount - cashInHand;
      
      const response = await fetch('/api/sheets/cash-in-hand', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: cashForm.date,
          type: 'Adjustment',
          amount: adjustmentAmount,
          description: cashForm.description || '现金调整',
          createdBy: userProfile?.name || userProfile?.email || '未知用户',
        }),
      });

      if (!response.ok) {
        throw new Error('更新失败');
      }

      const result = await response.json();
      setCashInHand(cashForm.amount);
      setSuccess('Cash amount updated successfully!');
      
      // 3秒后返回首页
      setTimeout(() => {
        router.push('/');
      }, 3000);
    } catch (error) {
      console.error('Error updating cash in hand:', error);
      setError('Failed to update cash amount. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!user || !userProfile) {
    return null;
  }

  if (userProfile.role !== 'Super Admin') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-8 flex flex-col items-center">
          <AlertCircle className="h-10 w-10 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-slate-400 mb-4">You do not have permission to access this page.</p>
          <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Return to Home</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <LoggedInUser>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white shadow-sm border-b dark:bg-slate-800 dark:border-slate-700">
          <div className="w-full px-3 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-12 sm:h-16">
              <div className="flex items-center">
                <Link href="/" className="flex items-center text-gray-600 hover:text-gray-900 dark:text-slate-300 dark:hover:text-slate-100">
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  <span className="text-sm sm:text-base">Back to Home</span>
                </Link>
              </div>
              <div className="flex items-center">
                <img
                  src="/pacmc.jpg"
                  alt="PACMC Logo"
                  className="h-7 w-7 sm:h-9 sm:w-9 rounded-full object-cover"
                />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="max-w-md mx-auto">
            {/* Page Title */}
            <div className="text-center mb-6 sm:mb-8">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center dark:bg-yellow-900">
                  <Wallet className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100">Set Cash in Hand</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-2 dark:text-slate-300">
                Update the current cash amount
              </p>
            </div>

            {/* Current Cash Display */}
            <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6 mb-6 dark:bg-slate-800 dark:border-slate-700">
              <h3 className="text-sm sm:text-base font-medium text-gray-900 mb-3 dark:text-slate-100">Current Cash in Hand</h3>
              <div className="text-2xl sm:text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                RM {cashInHand.toFixed(2)}
              </div>
            </div>

            {/* Form */}
            <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6 dark:bg-slate-800 dark:border-slate-700">
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                {/* Date */}
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">
                    Date
                  </label>
                  <input
                    type="date"
                    id="date"
                    value={cashForm.date}
                    onChange={(e) => setCashForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                    required
                  />
                </div>

                {/* Amount */}
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">
                    New Cash Amount (RM)
                  </label>
                  <input
                    type="number"
                    id="amount"
                    step="0.01"
                    min="0"
                    value={cashForm.amount.toFixed(2)}
                    onChange={(e) => {
                      // 只保留两位小数
                      let val = e.target.value;
                      if (val.includes('.')) {
                        const [int, dec] = val.split('.');
                        val = int + '.' + (dec.slice(0,2));
                      }
                      setCashForm(prev => ({ ...prev, amount: parseFloat(val) || 0 }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                    placeholder="0.00"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">
                    Description (Optional)
                  </label>
                  <textarea
                    id="description"
                    value={cashForm.description}
                    onChange={(e) => setCashForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                    placeholder="Reason for cash adjustment..."
                  />
                </div>

                {/* Adjustment Preview */}
                {cashForm.amount !== cashInHand && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3 dark:bg-blue-900/20 dark:border-blue-700">
                    <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">Adjustment Preview</h4>
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                      <div>Current: RM {cashInHand.toFixed(2)}</div>
                      <div>New: RM {cashForm.amount.toFixed(2)}</div>
                      <div className="font-medium mt-1">
                        Adjustment: RM {(cashForm.amount - cashInHand).toFixed(2)}
                        <span className={`ml-2 ${cashForm.amount > cashInHand ? 'text-green-600' : 'text-red-600'}`}>
                          ({cashForm.amount > cashInHand ? '+' : ''}{((cashForm.amount - cashInHand) / cashInHand * 100).toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3 dark:bg-red-900/20 dark:border-red-700">
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                  </div>
                )}

                {/* Success Message */}
                {success && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-3 dark:bg-green-900/20 dark:border-green-700">
                    <div className="flex items-center">
                      <Check className="h-4 w-4 text-green-600 mr-2" />
                      <p className="text-sm text-green-700 dark:text-green-300">{success}</p>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={saving || cashForm.amount === cashInHand}
                  className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-yellow-600 dark:hover:bg-yellow-700"
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    'Update Cash Amount'
                  )}
                </button>
              </form>
            </div>
          </div>
        </main>
      </div>
    </LoggedInUser>
  );
} 