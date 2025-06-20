'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SuperAdminOnly } from '@/components/PermissionGate';
import { getAllUsers, updateUserRole, UserProfile, UserRole } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function UserManagementPage() {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const allUsers = await getAllUsers();
        setUsers(allUsers);
      } catch (err) {
        setError('Failed to load users.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

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

  return (
    <SuperAdminOnly fallback={<p className="text-center text-red-500 mt-10">Access Denied. You must be a Super Admin to view this page.</p>}>
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md border">
          <header className="px-6 py-4 border-b flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">User Role Management</h1>
              <p className="text-sm text-gray-600">Assign roles to users. Changes are saved automatically.</p>
            </div>
            <Link href="/financial-list" className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
              Back to List
            </Link>
          </header>
          
          <main className="p-6">
            {loading && <p>Loading users...</p>}
            {error && <p className="text-red-500">{error}</p>}
            
            {!loading && !error && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map(user => (
                      <tr key={user.uid}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.uid, e.target.value as UserRole)}
                            disabled={saving === user.uid || userProfile?.uid === user.uid}
                            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md disabled:bg-gray-100"
                          >
                            <option>Super Admin</option>
                            <option>Admin</option>
                            <option>Basic User</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </main>
        </div>
      </div>
    </SuperAdminOnly>
  );
} 