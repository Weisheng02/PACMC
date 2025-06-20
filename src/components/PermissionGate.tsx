'use client';

import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/lib/firebase';
import Link from 'next/link';

interface PermissionGateProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  fallback?: React.ReactNode;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  children,
  allowedRoles,
  fallback = null,
}) => {
  const { userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!userProfile || !allowedRoles.includes(userProfile.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

// Convenience components for new permission checks

/**
 * Renders children only for Super Admins.
 */
export const SuperAdminOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback,
}) => (
  <PermissionGate allowedRoles={['Super Admin']} fallback={fallback}>
    {children}
  </PermissionGate>
);

/**
 * Renders children for Admins and Super Admins.
 * This is useful for forms and actions related to financial records.
 */
export const AdminOrSuperAdmin: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback,
}) => (
  <PermissionGate allowedRoles={['Super Admin', 'Admin']} fallback={fallback}>
    {children}
  </PermissionGate>
);

/**
 * Renders children for any logged-in user.
 */
export const LoggedInUser: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback,
}) => (
  <PermissionGate allowedRoles={['Super Admin', 'Admin', 'Basic User']} fallback={fallback}>
    {children}
  </PermissionGate>
); 