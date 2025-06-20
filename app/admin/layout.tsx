import React from 'react';

// This layout will wrap pages inside the /admin route segment
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 