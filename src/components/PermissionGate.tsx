'use client';

import { useAuth } from '@/contexts/AuthContext';

interface PermissionGateProps {
  children: React.ReactNode;
  allowedRoles: ('finance' | 'core' | 'leadership')[];
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

// Convenience components for common permission checks
export const FinanceOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback,
}) => (
  <PermissionGate allowedRoles={['finance']} fallback={fallback}>
    {children}
  </PermissionGate>
);

export const CoreAndAbove: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback,
}) => (
  <PermissionGate allowedRoles={['finance', 'core']} fallback={fallback}>
    {children}
  </PermissionGate>
);

export const AllUsers: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback,
}) => (
  <PermissionGate allowedRoles={['finance', 'core', 'leadership']} fallback={fallback}>
    {children}
  </PermissionGate>
); 