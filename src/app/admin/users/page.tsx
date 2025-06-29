'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SuperAdminOnly } from '@/components/PermissionGate';
import { getAllUsers, updateUserRole, UserProfile, UserRole } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Plus, Users, CheckCircle, Clock, Edit, Trash2, Shield } from 'lucide-react';

export default function UserManagementPage() {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const router = useRouter();

  const fetchUsers = async () => {
    setRefreshing(true);
    try {
      const allUsers = await getAllUsers();
      setUsers(allUsers);
      setLastRefreshTime(new Date());
    } catch (err) {
      setError('Failed to load users.');
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (uid: string, newRole: UserRole) => {
    if (userProfile?.uid === uid) {
      alert("You cannot change your own role.");
      return;
    }

    setSaving(uid);
    try {
      await updateUserRole(uid, newRole);
      setUsers(users.map(u => u.uid === uid ? { ...u, role: newRole } : u));
    } catch (err) {
      alert('Failed to update role.');
      console.error(err);
    } finally {
      setSaving(null);
    }
  };

  const handleEditUser = (user: UserProfile) => {
    // Implement edit user functionality
    console.log('Edit user:', user);
  };

  const handleDeleteUser = async (uid: string) => {
    if (userProfile?.uid === uid) {
      alert("You cannot delete your own account.");
      return;
    }

    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }

    // Implement delete user functionality
    console.log('Delete user:', uid);
  };

  const currentUser = userProfile;

  return (
    <SuperAdminOnly>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
        <header className="sticky top-0 z-50 bg-white shadow-sm border-b dark:bg-slate-800 dark:border-slate-700">
          <div className="w-full px-3 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center h-auto sm:h-16 py-3 sm:py-0">
              <div className="flex items-center mb-3 sm:mb-0">
                <Link href="/" className="mr-3 sm:mr-4">
                  <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-gray-600 dark:text-slate-400" />
                </Link>
                <h1 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-slate-100">
                  <span className="hidden sm:inline">User Management</span>
                  <span className="sm:hidden">Users</span>
                </h1>
              </div>
              
              {/* Desktop buttons */}
              <div className="hidden sm:flex items-center gap-3 sm:gap-4">
                <button
                  onClick={fetchUsers}
                  disabled={refreshing}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:text-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"
                >
                  {refreshing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 dark:border-slate-400"></div>
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
                {lastRefreshTime && (
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    Last: {lastRefreshTime.toLocaleTimeString()}
                  </span>
                )}
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Add User
                </button>
              </div>

              {/* Mobile buttons - simplified */}
              <div className="flex items-center gap-2 w-full sm:hidden">
                <Link
                  href="/"
                  className="flex items-center justify-center w-10 h-10 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:text-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"
                  title="Back to Home"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </Link>
                <button
                  onClick={fetchUsers}
                  disabled={refreshing}
                  className="flex items-center justify-center w-10 h-10 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:text-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"
                  title={refreshing ? 'Refreshing...' : 'Refresh'}
                >
                  {refreshing ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600 dark:border-slate-400"></div>
                  ) : (
                    <RefreshCw className="h-5 w-5" />
                  )}
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center justify-center w-10 h-10 text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                  title="Add User"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-6 dark:bg-slate-800 dark:border-slate-700">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-2 bg-blue-100 rounded-lg dark:bg-blue-900">
                  <Users className="h-4 w-4 sm:h-5 sm:w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate dark:text-slate-400">Total Users</p>
                  <p className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-semibold text-gray-900 truncate dark:text-slate-100">{users.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-6 dark:bg-slate-800 dark:border-slate-700">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-2 bg-green-100 rounded-lg dark:bg-green-900">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate dark:text-slate-400">Active</p>
                  <p className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-semibold text-gray-900 truncate dark:text-slate-100">{users.filter(u => u.status === 'active').length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-6 dark:bg-slate-800 dark:border-slate-700">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-2 bg-yellow-100 rounded-lg dark:bg-yellow-900">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate dark:text-slate-400">Pending</p>
                  <p className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-semibold text-gray-900 truncate dark:text-slate-100">{users.filter(u => u.status === 'pending').length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-6 dark:bg-slate-800 dark:border-slate-700">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-2 bg-purple-100 rounded-lg dark:bg-purple-900">
                  <Shield className="h-4 w-4 sm:h-5 sm:w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate dark:text-slate-400">Admins</p>
                  <p className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-semibold text-gray-900 truncate dark:text-slate-100">{users.filter(u => u.role === 'Admin').length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-lg shadow-sm border dark:bg-slate-800 dark:border-slate-700">
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-slate-600">
              <h2 className="text-base sm:text-lg font-medium text-gray-900 dark:text-slate-100">All Users</h2>
            </div>
            
            {loading ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">Loading users...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="p-6 text-center">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-slate-400">No users found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">User</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">Role</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">Status</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">Created</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-600">
                    {users.map((user) => (
                      <tr key={user.uid} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10">
                              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gray-300 dark:bg-slate-600 flex items-center justify-center">
                                <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-300">
                                  {user.name?.charAt(0) || user.email?.charAt(0) || '?'}
                                </span>
                              </div>
                            </div>
                            <div className="ml-3 sm:ml-4">
                              <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-slate-100">
                                {user.name || 'No Name'}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-slate-400">
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.role === 'Super Admin' 
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                              : user.role === 'Admin'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.status === 'active'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : user.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-slate-400">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditUser(user)}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            {user.uid !== currentUser?.uid && (
                              <button
                                onClick={() => handleDeleteUser(user.uid)}
                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </SuperAdminOnly>
  );
} 