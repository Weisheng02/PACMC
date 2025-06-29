'use client';

import { LoginForm } from '@/components/LoginForm';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

export default function TestLoginPage() {
  const { user, userProfile, loading } = useAuth();
  const [showUserInfo, setShowUserInfo] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <div className="max-w-md mx-auto pt-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 dark:text-white">
            Login Test Page
          </h1>
          <p className="text-gray-600 dark:text-slate-300">
            Test the new login functionality
          </p>
        </div>

        {!user ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8 dark:bg-slate-800/80 dark:border-slate-600/20">
            <LoginForm />
          </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8 dark:bg-slate-800/80 dark:border-slate-600/20">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2 dark:text-white">
                Welcome, {userProfile?.name || user.email}!
              </h2>
              <p className="text-gray-600 dark:text-slate-300">
                You are successfully logged in.
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 dark:bg-green-900/20 dark:border-green-800">
                <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                  Login Successful
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  The login functionality is working correctly.
                </p>
              </div>

              <button
                onClick={() => setShowUserInfo(!showUserInfo)}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {showUserInfo ? 'Hide' : 'Show'} User Information
              </button>

              {showUserInfo && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 dark:bg-slate-700 dark:border-slate-600">
                  <h4 className="font-semibold text-gray-900 mb-2 dark:text-white">
                    User Details:
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Email:</strong> {user.email}</p>
                    <p><strong>Name:</strong> {userProfile?.name || 'Not set'}</p>
                    <p><strong>Role:</strong> {userProfile?.role || 'Not set'}</p>
                    <p><strong>UID:</strong> {user.uid}</p>
                    <p><strong>Email Verified:</strong> {user.emailVerified ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              )}

              <div className="text-center">
                <a
                  href="/"
                  className="inline-block bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Go to Main Page
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 