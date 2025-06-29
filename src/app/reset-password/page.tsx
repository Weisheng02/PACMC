'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Lock, Eye, EyeOff, CheckCircle, AlertCircle, Save } from 'lucide-react';
import Link from 'next/link';
import { confirmPasswordReset } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPasswords, setShowPasswords] = useState({
    password: false,
    confirmPassword: false,
  });

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // 从URL获取oobCode (Firebase密码重置代码)
  const oobCode = searchParams.get('oobCode');

  useEffect(() => {
    if (!oobCode) {
      setMessage({ 
        type: 'error', 
        text: 'Invalid or expired password reset link. Please request a new one.' 
      });
    }
  }, [oobCode]);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must contain uppercase, lowercase, and number';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!oobCode) {
      setMessage({ 
        type: 'error', 
        text: 'Invalid or expired password reset link. Please request a new one.' 
      });
      return;
    }
    
    if (!validateForm()) return;
    
    setLoading(true);
    setMessage(null);
    
    try {
      // 确认密码重置
      await confirmPasswordReset(auth, oobCode, formData.password);
      
      setMessage({ 
        type: 'success', 
        text: 'Password reset successfully! You can now sign in with your new password.' 
      });
      
      // 清空表单
      setFormData({
        password: '',
        confirmPassword: '',
      });
      
      // 5秒后跳转到登录页面
      setTimeout(() => {
        window.location.href = '/';
      }, 5000);
      
    } catch (error: any) {
      console.error('Error resetting password:', error);
      
      let errorMessage = 'Failed to reset password. Please try again.';
      
      if (error.code === 'auth/expired-action-code') {
        errorMessage = 'Password reset link has expired. Please request a new one.';
      } else if (error.code === 'auth/invalid-action-code') {
        errorMessage = 'Invalid password reset link. Please request a new one.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again later.';
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

  const passwordStrength = getPasswordStrength(formData.password);

  if (!oobCode) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center dark:bg-slate-900">
        <div className="max-w-md w-full mx-auto p-6">
          <div className="bg-white rounded-lg shadow-sm border dark:bg-slate-800 dark:border-slate-700 p-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Invalid Reset Link
            </h3>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">
              The password reset link is invalid or has expired. Please request a new one.
            </p>
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Return to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b dark:bg-slate-800 dark:border-slate-700">
        <div className="w-full px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-12 sm:h-16">
            <div className="flex items-center">
              <Link href="/" className="mr-3 sm:mr-4">
                <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-gray-600 dark:text-slate-400" />
              </Link>
              <h1 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-slate-100">
                Reset Password
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

          {/* Reset Password Form */}
          <div className="bg-white rounded-lg shadow-sm border dark:bg-slate-800 dark:border-slate-700">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <Lock className="h-5 w-5 text-gray-500 dark:text-slate-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Set New Password</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New Password */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.password ? 'text' : 'password'}
                      id="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-white ${
                        errors.password ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-slate-600'
                      }`}
                      placeholder="Enter your new password"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('password')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showPasswords.password ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.password}</p>
                  )}
                  
                  {/* Password Strength Indicator */}
                  {formData.password && (
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
                      type={showPasswords.confirmPassword ? 'text' : 'password'}
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
                      onClick={() => togglePasswordVisibility('confirmPassword')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showPasswords.confirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                      Resetting Password...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Reset Password
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
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 