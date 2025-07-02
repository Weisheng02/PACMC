'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LoggedInUser } from '@/components/PermissionGate';
import { ArrowLeft, User, Mail, Shield, Calendar, Save, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { updateUserProfile, updateUserDisplayName, sendEmailVerification } from '@/lib/firebase';

export default function ProfilePage() {
  const { user, userProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

  const [formData, setFormData] = useState({
    name: userProfile?.name || '',
    email: user?.email || '',
  });

  // Update form data when userProfile changes
  useEffect(() => {
    if (userProfile) {
      setFormData({
        name: userProfile.name || '',
        email: user?.email || '',
      });
    }
  }, [userProfile, user]);

  const handleSave = async () => {
    if (!user || !userProfile) return;
    
    setLoading(true);
    setMessage(null);
    
    try {
      // Update display name in Firebase Auth
      if (formData.name !== userProfile.name) {
        await updateUserDisplayName(formData.name);
      }
      
      // Update profile in Firestore
      await updateUserProfile(user.uid, {
        name: formData.name,
      });
      
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setIsEditing(false);
      
      // Reload page to reflect changes
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailVerification = async () => {
    if (!user || user.emailVerified) return;
    
    setLoading(true);
    try {
      await sendEmailVerification();
      setVerificationSent(true);
      setMessage({ type: 'success', text: 'Verification email sent! Please check your inbox.' });
    } catch (error) {
      console.error('Error sending verification email:', error);
      setMessage({ type: 'error', text: 'Failed to send verification email. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Super Admin':
        return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20';
      case 'Admin':
        return 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/20';
      default:
        return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20';
    }
  };

  return (
    <LoggedInUser
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center dark:bg-slate-900">
          <div className="text-center">
            <User className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-slate-100">Please Log In</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">You need to be logged in to view your profile</p>
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
                <Link href="/" className="mr-3 sm:mr-4">
                  <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-gray-600 dark:text-slate-400" />
                </Link>
                <h1 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-slate-100">
                  User Profile
                </h1>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="max-w-2xl mx-auto">
            {/* Profile Card */}
            <div className="bg-white rounded-lg shadow-sm border dark:bg-slate-800 dark:border-slate-700">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Profile Information</h2>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                  >
                    {isEditing ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                {/* Message */}
                {message && (
                  <div className={`mb-4 p-3 rounded-md flex items-center gap-2 ${
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

                {/* Profile Form */}
                <div className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      <User className="h-4 w-4" />
                      Full Name
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        placeholder="Enter your full name"
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-white">{userProfile?.name || 'Not set'}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      <Mail className="h-4 w-4" />
                      Email Address
                    </label>
                    <div className="flex items-center gap-2">
                      <p className="text-gray-900 dark:text-white">{user?.email}</p>
                      {user?.emailVerified && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 bg-green-100 rounded-full dark:text-green-400 dark:bg-green-900/20">
                          <CheckCircle className="h-3 w-3" />
                          Verified
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Role */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      <Shield className="h-4 w-4" />
                      Role
                    </label>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(userProfile?.role || '')}`}>
                      {userProfile?.role || 'Unknown'}
                    </span>
                  </div>

                  {/* Account Created */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      <Calendar className="h-4 w-4" />
                      Account Created
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {user?.metadata?.creationTime
                        ? new Date(user.metadata.creationTime).toLocaleDateString()
                        : userProfile?.createdAt
                          ? new Date(userProfile.createdAt).toLocaleDateString()
                          : 'Unknown'}
                    </p>
                  </div>

                  {/* Save Button */}
                  {isEditing && (
                    <div className="pt-4">
                      <button
                        onClick={handleSave}
                        disabled={loading || !formData.name.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            Save Changes
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Security Section */}
            <div className="mt-6 bg-white rounded-lg shadow-sm border dark:bg-slate-800 dark:border-slate-700">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Security</h3>
                
                <div className="space-y-4">
                  {/* Change Password */}
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg dark:border-slate-600">
                    <div className="flex items-center gap-3">
                      <Lock className="h-5 w-5 text-gray-500 dark:text-slate-400" />
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">Change Password</h4>
                        <p className="text-sm text-gray-500 dark:text-slate-400">Update your account password</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        // Redirect to change password page
                        window.location.href = '/change-password';
                      }}
                      className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Change
                    </button>
                  </div>

                  {/* Email Verification */}
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg dark:border-slate-600">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-gray-500 dark:text-slate-400" />
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">Email Verification</h4>
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                          {user?.emailVerified ? 'Email is verified' : 'Email not verified'}
                        </p>
                      </div>
                    </div>
                    {!user?.emailVerified && (
                      <button 
                        onClick={handleEmailVerification}
                        disabled={loading || verificationSent}
                        className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                      >
                        {verificationSent ? 'Sent' : 'Verify'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </LoggedInUser>
  );
} 