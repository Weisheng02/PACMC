'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LoggedInUser } from '@/components/PermissionGate';
import { ArrowLeft, Lock, Eye, EyeOff, CheckCircle, AlertCircle, Save } from 'lucide-react';
import Link from 'next/link';
import { updateUserPassword, reauthenticateUser } from '@/lib/firebase';

export default function ChangePasswordPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }

    if (!formData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (formData.newPassword.length < 6) {
      newErrors.newPassword = 'Password must be at least 6 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.newPassword)) {
      newErrors.newPassword = 'Password must contain uppercase, lowercase, and number';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (formData.currentPassword === formData.newPassword) {
      newErrors.newPassword = 'New password must be different from current password';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    setMessage(null);
    
    try {
      // Re-authenticate user first
      await reauthenticateUser(user?.email || '', formData.currentPassword);
      
      // Update password
      await updateUserPassword(formData.newPassword);
      
      setMessage({ type: 'success', text: 'Password updated successfully!' });
      
      // Clear form
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      
      // Clear message after 3 seconds
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch (error: any) {
      console.error('Error updating password:', error);
      
      let errorMessage = 'Failed to update password. Please try again.';
      
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Current password is incorrect.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password.';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Please log in again to change your password.';
      }
      
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const getPasswordStrength = (password: string) => {
    if (!password) return { strength: 0, color: 'bg-gray-200', text: '' };
    
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500', 'bg-green-600'];
    const texts = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
    
    return {
      strength: Math.min(strength, 6),
      color: colors[Math.min(strength - 1, 5)],
      text: texts[Math.min(strength - 1, 5)]
    };
  };

  const passwordStrength = getPasswordStrength(formData.newPassword);

  return (
    <LoggedInUser
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center dark:bg-slate-900">
          <div className="text-center">
            <Lock className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-slate-100">Please Log In</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">You need to be logged in to change your password</p>
            <div className="mt-6">
              <Link href="/" className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                Return to Homepage
              </Link>
            </div>
          </div>
        </div>
      }
    >
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white shadow-sm border-b dark:bg-slate-800 dark:border-slate-700">
          <div className="w-full px-3 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-12 sm:h-16">
              <div className="flex items-center">
                <Link href="/profile" className="mr-3 sm:mr-4">
                  <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-gray-600 dark:text-slate-400" />
                </Link>
                <h1 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-slate-100">
                  Change Password
                </h1>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="max-w-md mx-auto">
            {/* Message */}
            {message && (
              <div className={`mb-6 p-4 rounded-md flex items-center gap-2 ${
                message.type === 'success' 
                  ? 'bg-green-50 border border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'
                  : 'bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
              }`}>
                {message.type === 'success' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                {message.text}
              </div>
            )}

            {/* Password Change Form */}
            <div className="bg-white rounded-lg shadow-sm border dark:bg-slate-800 dark:border-slate-700">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Lock className="h-5 w-5 text-gray-500 dark:text-slate-400" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Update Your Password</h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Current Password */}
                  <div>
                    <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.current ? 'text' : 'password'}
                        id="currentPassword"
                        value={formData.currentPassword}
                        onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                        className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-white ${
                          errors.currentPassword ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-slate-600'
                        }`}
                        placeholder="Enter your current password"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('current')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.currentPassword && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.currentPassword}</p>
                    )}
                  </div>

                  {/* New Password */}
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.new ? 'text' : 'password'}
                        id="newPassword"
                        value={formData.newPassword}
                        onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                        className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-white ${
                          errors.newPassword ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-slate-600'
                        }`}
                        placeholder="Enter your new password"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('new')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.newPassword && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.newPassword}</p>
                    )}
                    
                    {/* Password Strength Indicator */}
                    {formData.newPassword && (
                      <div className="mt-2">
                        <div className="flex gap-1 mb-1">
                          {[1, 2, 3, 4, 5, 6].map((level) => (
                            <div
                              key={level}
                              className={`h-1 flex-1 rounded-full transition-colors ${
                                level <= passwordStrength.strength ? passwordStrength.color : 'bg-gray-200 dark:bg-slate-600'
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          Password strength: {passwordStrength.text}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.confirm ? 'text' : 'password'}
                        id="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-white ${
                          errors.confirmPassword ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-slate-600'
                        }`}
                        placeholder="Confirm your new password"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('confirm')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.confirmPassword}</p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Updating Password...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Update Password
                      </>
                    )}
                  </button>
                </form>

                {/* Password Requirements */}
                <div className="mt-6 p-4 bg-gray-50 rounded-md dark:bg-slate-700">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Password Requirements:</h3>
                  <ul className="text-xs text-gray-600 dark:text-slate-400 space-y-1">
                    <li>• At least 6 characters long</li>
                    <li>• Contains uppercase and lowercase letters</li>
                    <li>• Contains at least one number</li>
                    <li>• Different from your current password</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </LoggedInUser>
  );
} 