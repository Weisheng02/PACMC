'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Bell, 
  X, 
  Trash2, 
  Eye,
  Clock,
  User,
  FileText,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';

interface AuditLog {
  time: string;
  user: string;
  action: string;
  object: string;
  field: string;
  old: string;
  new: string;
  detail: string;
}

// Get audit logs
async function getAuditLogs() {
  const res = await fetch('/api/sheets/audit-log');
  if (!res.ok) throw new Error('Failed to fetch audit logs');
  return res.json();
}

// Clear audit logs
async function clearAuditLogs() {
  const res = await fetch('/api/sheets/audit-log', { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to clear audit logs');
}

export default function NotificationBell() {
  const { userProfile, isSuperAdmin } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!userProfile) return;

    const loadLogs = async () => {
      try {
        const data = await getAuditLogs();
        setLogs(data.logs || []);
      } catch (error) {
        console.error('Error loading audit logs:', error);
      }
    };

    loadLogs();
    // 每30秒刷新一次
    const interval = setInterval(loadLogs, 30000);
    return () => clearInterval(interval);
  }, [userProfile]);

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to hide all audit logs? Logs will not be displayed on the web page, but data will remain in the spreadsheet.')) return;
    
    setClearing(true);
    try {
      await clearAuditLogs();
      setLogs([]);
    } catch (error) {
      console.error('Error clearing audit logs:', error);
    } finally {
      setClearing(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'Add Record':
        return <FileText className="h-4 w-4 text-green-500" />;
      case 'Edit Record':
        return <Eye className="h-4 w-4 text-blue-500" />;
      case 'Delete Record':
        return <Trash2 className="h-4 w-4 text-red-500" />;
      case 'Update Status':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatTimeAgo = (timeStr: string) => {
    const now = new Date();
    const logTime = new Date(timeStr);
    const diffInMinutes = Math.floor((now.getTime() - logTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return logTime.toLocaleDateString('en-US');
  };

  if (!userProfile) return null;

  // 只显示最近50条日志
  const recentLogs = logs.slice(0, 50);
  const logCount = logs.length;

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors dark:text-slate-300 dark:hover:text-slate-100 dark:hover:bg-slate-700"
      >
        <Bell className="h-6 w-6" />
        {logCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {logCount > 99 ? '99+' : logCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden dark:bg-slate-800 dark:border-slate-600">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-600">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Audit Logs</h3>
            <div className="flex items-center space-x-2">
              {isSuperAdmin && logCount > 0 && (
                <button
                  onClick={handleClearLogs}
                  disabled={clearing}
                  className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50 flex items-center gap-1 dark:text-red-400 dark:hover:text-red-300"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Log List */}
          <div className="max-h-80 overflow-y-auto">
            {recentLogs.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-slate-400">
                <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300 dark:text-slate-500" />
                <p>No audit logs</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-300 dark:divide-slate-600">
                {recentLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className="p-3 hover:bg-gray-50 transition-colors dark:hover:bg-slate-700"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getActionIcon(log.action)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                              {log.action}
                            </span>
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full dark:bg-blue-900 dark:text-blue-200">
                              {log.user}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400 flex items-center gap-1 dark:text-slate-400">
                            <Clock className="h-3 w-3" />
                            {formatTimeAgo(log.time)}
                          </span>
                        </div>
                        
                        <div className="text-sm text-gray-600 mb-1 dark:text-slate-300">
                          <span className="font-medium">Object:</span> {log.object}
                          {log.field && (
                            <>
                              <span className="mx-1">•</span>
                              <span className="font-medium">Field:</span> {log.field}
                            </>
                          )}
                        </div>
                        
                        {log.old && log.new && (
                          <div className="text-xs text-gray-500 dark:text-slate-400">
                            <span className="line-through">{log.old}</span>
                            <span className="mx-1">→</span>
                            <span className="text-blue-600">{log.new}</span>
                          </div>
                        )}
                        
                        {log.detail && (
                          <div className="text-xs text-gray-500 dark:text-slate-400">
                            {log.detail}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {recentLogs.length > 0 && (
            <div className="p-3 border-t border-gray-200 dark:border-slate-600">
              <Link
                href="/notifications"
                className="block text-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                View all audit logs →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 