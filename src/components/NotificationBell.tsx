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
    if (!confirm('Are you sure you want to clear all notifications?')) return;
    
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

  const getLogSummary = (log: AuditLog) => {
    let amount = '', type = '', description = '';
    if (log.detail) {
      const match = (field: string) => {
        const m = log.detail.match(new RegExp(field + ': ([^,]+)'));
        return m ? m[1].trim() : '';
      };
      amount = match('Amount');
      type = match('Type');
      description = match('Description');
    }
    if (log.action === 'Add Record') {
      return `Added an ${type === 'Income' ? 'income' : 'expense'} of RM${amount}${description ? ` (${description})` : ''}`;
    }
    if (log.action === 'Edit Record') {
      return `Edited a record${description ? ` (${description})` : ''}`;
    }
    if (log.action === 'Delete Record') {
      return `Deleted an ${type === 'Income' ? 'income' : 'expense'} of RM${amount}${description ? ` (${description})` : ''}`;
    }
    if (log.action === 'Update Status') {
      return `Approved a record${description ? ` (${description})` : ''}`;
    }
    return `Performed an action`;
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
        <div
          className="absolute z-50 mt-2 left-1/2 -translate-x-1/2 w-[85vw] max-w-[380px] sm:w-96 sm:max-w-md sm:right-0 sm:left-auto sm:translate-x-0 bg-white rounded-lg shadow-lg border border-gray-200 dark:bg-slate-800 dark:border-slate-600 max-h-96 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-slate-600">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100 truncate">Notifications</h3>
            <div className="flex items-center space-x-2">
              {isSuperAdmin && logCount > 0 && (
                <button
                  onClick={handleClearLogs}
                  disabled={clearing}
                  className="text-xs sm:text-sm text-red-600 hover:text-red-800 disabled:opacity-50 flex items-center gap-1 dark:text-red-400 dark:hover:text-red-300"
                >
                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  Clear
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-300"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
          </div>

          {/* Log List */}
          <div className="max-h-80 overflow-y-auto">
            {recentLogs.length === 0 ? (
              <div className="p-3 sm:p-4 text-center text-gray-500 dark:text-slate-400">
                <Bell className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-1 sm:mb-2 text-gray-300 dark:text-slate-500" />
                <p className="text-xs sm:text-sm">No Notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-300 dark:divide-slate-600">
                {recentLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className="p-2 sm:p-3 hover:bg-gray-50 transition-colors dark:hover:bg-slate-700"
                  >
                    <div className="flex items-start space-x-2 sm:space-x-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getActionIcon(log.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 gap-1">
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-slate-100 truncate max-w-[60vw]">{log.action}</span>
                            {/* Created by user */}
                            <span className="text-xs text-gray-500 dark:text-slate-300 whitespace-nowrap ml-1 sm:ml-2">Created by {log.user}</span>
                          </div>
                          <span className="text-xs text-gray-400 flex items-center gap-1 dark:text-slate-400 whitespace-nowrap">
                            <Clock className="h-3 w-3" />
                            {log.time?.split(' ')[0]}
                          </span>
                        </div>
                        <div className="text-xs sm:text-sm text-gray-600 mb-1 dark:text-slate-300 truncate max-w-[80vw]">
                          {getLogSummary(log)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {recentLogs.length > 0 && (
            <div className="p-2 sm:p-3 border-t border-gray-200 dark:border-slate-600">
              <Link
                href="/notifications"
                className="block text-center text-xs sm:text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
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