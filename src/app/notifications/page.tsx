'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SuperAdminOnly } from '@/components/PermissionGate';
import { Bell, Trash2, Filter, Calendar, User, FileText, Eye, AlertCircle, ChevronDown, ChevronRight, ArrowLeft, RefreshCw, Check, Clock, CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

// 假设有 getAuditLogs, clearAuditLogs 两个API
async function getAuditLogs() {
  const res = await fetch('/api/sheets/audit-log');
  if (!res.ok) throw new Error('Failed to fetch audit logs');
  return res.json();
}
async function clearAuditLogs() {
  const res = await fetch('/api/sheets/audit-log', { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to clear audit logs');
}

interface AuditLog {
  time: string;
  user: string;
  action: string;
  object: string;
  field: string;
  old: string;
  new: string;
  detail: string;
  status: string;
}

type GroupBy = 'action' | 'user' | 'date' | 'none';

export default function AuditLogPage() {
  const { userProfile, isSuperAdmin } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>('action');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterUser, setFilterUser] = useState<string>('all');

  useEffect(() => {
    getAuditLogs().then(data => {
      setLogs(data.logs || []);
      setLoading(false);
    });
  }, []);

  const handleClear = async () => {
    if (!confirm('Are you sure you want clear all notifications?')) return;
    setClearing(true);
    await clearAuditLogs();
    setLogs([]);
    setClearing(false);
  };

  const toggleGroup = (groupKey: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
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

  const getActionColor = (action: string) => {
    switch (action) {
      case 'Add Record':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Edit Record':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Delete Record':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Update Status':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
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

  const formatDate = (timeStr: string) => {
    const date = new Date(timeStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // 过滤日志
  const filteredLogs = logs.filter(log => {
    if (filterAction !== 'all' && log.action !== filterAction) return false;
    if (filterUser !== 'all' && log.user !== filterUser) return false;
    return true;
  });

  // 分组日志
  const groupedLogs = filteredLogs.reduce((groups, log) => {
    let groupKey = '';
    let groupName = '';
    
    switch (groupBy) {
      case 'action':
        groupKey = log.action;
        groupName = log.action;
        break;
      case 'user':
        groupKey = log.user;
        groupName = log.user;
        break;
      case 'date':
        groupKey = formatDate(log.time);
        groupName = formatDate(log.time);
        break;
      default:
        groupKey = 'all';
        groupName = 'All Logs';
    }
    
    if (!groups[groupKey]) {
      groups[groupKey] = {
        name: groupName,
        logs: [],
        count: 0
      };
    }
    
    groups[groupKey].logs.push(log);
    groups[groupKey].count++;
    
    return groups;
  }, {} as Record<string, { name: string; logs: AuditLog[]; count: number }>);

  // 获取唯一值用于过滤器
  const uniqueActions = Array.from(new Set(logs.map(log => log.action)));
  const uniqueUsers = Array.from(new Set(logs.map(log => log.user)));

  const getLogSummary = (log: AuditLog) => {
    let amount = '', type = '', description = '';
    if (log.detail) {
      const match = (field: string): string => {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Loading audit logs...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b dark:bg-slate-800 dark:border-slate-700">
        <div className="w-full px-3 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center h-auto sm:h-16 py-3 sm:py-0">
            <div className="flex items-center mb-3 sm:mb-0">
              <Link href="/" className="mr-3 sm:mr-4">
                <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-gray-600 dark:text-slate-400" />
              </Link>
              <h1 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-slate-100">
                <span className="hidden sm:inline">Notifications</span>
                <span className="sm:hidden">Notifications</span>
              </h1>
            </div>
            
            {/* Desktop buttons */}
            <div className="hidden sm:flex items-center gap-3 sm:gap-4">
              <button
                onClick={handleClear}
                disabled={clearing}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:text-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"
              >
                <Trash2 className="h-4 w-4" />
                Clear Logs
              </button>
              <button
                onClick={handleClear}
                disabled={clearing}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="h-4 w-4" />
                Mark All Read
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
                onClick={handleClear}
                disabled={clearing}
                className="flex items-center justify-center w-10 h-10 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:text-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"
                title="Clear Logs"
              >
                <Trash2 className="h-5 w-5" />
              </button>
              <button
                onClick={handleClear}
                disabled={clearing}
                className="flex items-center justify-center w-10 h-10 text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Mark All Read"
              >
                <Check className="h-5 w-5" />
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
                <Bell className="h-4 w-4 sm:h-5 sm:w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate dark:text-slate-400">Total</p>
                <p className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-semibold text-gray-900 truncate dark:text-slate-100">{logs.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-6 dark:bg-slate-800 dark:border-slate-700">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-2 bg-yellow-100 rounded-lg dark:bg-yellow-900">
                <Clock className="h-4 w-4 sm:h-5 sm:w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate dark:text-slate-400">Unread</p>
                <p className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-semibold text-gray-900 truncate dark:text-slate-100">{logs.filter(log => !log.status.includes('read')).length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-6 dark:bg-slate-800 dark:border-slate-700">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-2 bg-green-100 rounded-lg dark:bg-green-900">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate dark:text-slate-400">Read</p>
                <p className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-semibold text-gray-900 truncate dark:text-slate-100">{logs.filter(log => log.status.includes('read')).length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-6 dark:bg-slate-800 dark:border-slate-700">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-2 bg-purple-100 rounded-lg dark:bg-purple-900">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate dark:text-slate-400">Today</p>
                <p className="text-sm sm:text-lg lg:text-xl xl:text-2xl font-semibold text-gray-900 truncate dark:text-slate-100">{logs.filter(log => new Date(log.time).toDateString() === new Date().toDateString()).length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="bg-white rounded-lg shadow-sm border dark:bg-slate-800 dark:border-slate-700">
          <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-slate-600">
            <h2 className="text-base sm:text-lg font-medium text-gray-900 dark:text-slate-100">All Notifications</h2>
          </div>
          
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">Loading notifications...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-6 text-center">
              <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-slate-400">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-slate-600">
              {logs.map((log) => (
                <div
                  key={log.time}
                  className={`p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${
                    !log.status.includes('read') ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {log.status.includes('read') ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <div className="h-4 w-4 rounded-full bg-blue-500"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm sm:text-base font-medium ${
                          log.status.includes('read') 
                            ? 'text-gray-900 dark:text-slate-100' 
                            : 'text-blue-900 dark:text-blue-100'
                        }`}>
                          {log.action}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 dark:text-slate-400">
                            {formatTimeAgo(log.time)}
                          </span>
                          {!log.status.includes('read') && (
                            <button
                              onClick={() => {
                                // Implement markAsRead function
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              Mark as read
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-gray-600 dark:text-slate-400 line-clamp-2">
                        {getLogSummary(log)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 