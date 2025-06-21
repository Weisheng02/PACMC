'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AdminOrSuperAdmin } from '@/components/PermissionGate';
import { addFinancialRecord } from '@/lib/googleSheets';
import { ArrowLeft, Save, X } from 'lucide-react';
import Link from 'next/link';

const ACCOUNTS = ['MIYF'];
const TYPES = ['Income', 'Expense'];

export default function AddRecordPage() {
  const router = useRouter();
  const { userProfile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: 'Income' as 'Income' | 'Expense',
    date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }),
    account: 'MIYF',
    who: '',
    amount: 0,
    description: '',
    remark: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check user status
    if (authLoading) {
      alert('Please wait for user information to load');
      return;
    }
    
    if (!userProfile) {
      alert('Please log in to the system');
      return;
    }
    
    if (!formData.account || !formData.date || !formData.type || !formData.who || !formData.description || !formData.amount) {
      alert('Please fill in all required fields');
      return;
    }
    if (isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      alert('Please enter a valid amount');
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
        createdBy: userProfile?.name || userProfile?.email || 'Unknown User',
      };
      
      console.log('Preparing to submit record data:', recordData);
      console.log('Current user information:', userProfile);
      
      const response = await fetch('/api/sheets/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(recordData),
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('Server returned error:', {
          status: response.status,
          statusText: response.statusText,
          data: responseData
        });
        throw new Error(responseData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('Record added successfully:', responseData);
      alert('Record added successfully!');
      router.push('/financial-list');
    } catch (error) {
      console.error('Error adding record:', error);
      let errorMessage = 'Record addition failed, please try again\n';
      
      if (error instanceof Error) {
        errorMessage += `Error details: ${error.message}\n`;
      }
      
      errorMessage += `\nCurrent user: ${userProfile?.name || userProfile?.email || 'Unknown User'}\n`;
      errorMessage += `User role: ${userProfile?.role || 'Unknown'}\n`;
      errorMessage += `Please check the console (F12) for more information`;
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminOrSuperAdmin
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <X className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Permission Denied</h3>
            <p className="mt-1 text-sm text-gray-500">Only administrators or super administrators can add financial records</p>
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
          <div className="max-w-2xl mx-auto bg-white shadow-sm border rounded-lg p-4 sm:p-6">
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

              {/* Date and Account in a row on larger screens */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {/* Date */}
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

                {/* Account */}
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

              {/* Who and Amount in a row on larger screens */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {/* Who */}
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

                {/* Amount */}
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
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Adding...' : 'Add Record'}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </AdminOrSuperAdmin>
  );
} 