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
async function getNotificationLogs(userProfile: { role: string; name: string }) {
  let url = '/api/sheets/audit-log';
  if (userProfile) {
    const params = new URLSearchParams();
    params.set('role', userProfile.role);
    if (userProfile.role === 'Basic User') {
      params.set('user', userProfile.name);
    }
    url += '?' + params.toString();
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch notifications');
  let data = await res.json();
  let logs = data.logs || [];
  // basic user: 只显示自己更改的和被approved的
  if (userProfile?.role === 'Basic User') {
    logs = logs.filter((log: AuditLog) =>
      log.user === userProfile.name ||
      (log.action === 'Update Status' && log.detail && log.detail.includes(`Who: ${userProfile.name}`))
    );
  }
  return logs;
}

// Clear audit logs
async function clearAuditLogs() {
  const res = await fetch('/api/sheets/audit-log', { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to clear audit logs');
}

function getNotiKey(log: AuditLog) {
  return `noti:${log.time}|${log.action}|${log.user}`;
}

function getReadSet(): Set<string> {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem('notiReadSet') || '[]'));
  } catch {
    return new Set<string>();
  }
}
function setReadSet(set: Set<string>) {
  localStorage.setItem('notiReadSet', JSON.stringify(Array.from(set)));
}

// 新增：Pending Record 类型
interface PendingRecord {
  key: string;
  account: string;
  date: string;
  type: string;
  who: string;
  amount: number;
  description: string;
  status: string;
  takePut: boolean;
  remark: string;
  createdDate: string;
  createdBy: string;
  approvedDate: string;
  approvedBy: string;
  lastUserUpdate: string;
  lastDateUpdate: string;
}

// 获取所有记录
async function getPendingRecords() {
  const res = await fetch('/api/sheets/read');
  if (!res.ok) throw new Error('Failed to fetch records');
  const data = await res.json();
  // 只要 Pending
  return (data.records || []).filter((r: PendingRecord) => r.status === 'Pending');
}

// 本地已读 Pending key
function getPendingReadSet(): Set<string> {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem('pendingReadSet') || '[]'));
  } catch {
    return new Set<string>();
  }
}
function setPendingReadSet(set: Set<string>) {
  localStorage.setItem('pendingReadSet', JSON.stringify(Array.from(set)));
}

export default function NotificationBell() {
  const { userProfile, isSuperAdmin } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pendingRecords, setPendingRecords] = useState<PendingRecord[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [readSet, setReadSetState] = useState<Set<string>>(getReadSet());
  const [pendingReadSet, setPendingReadSetState] = useState<Set<string>>(getPendingReadSet());

  // 未读数量
  const unreadLogs = logs.filter(log => !readSet.has(getNotiKey(log)));
  const notiCount = unreadLogs.length;

  // 标记单条为已读
  const markAsRead = (log: AuditLog) => {
    const key = getNotiKey(log);
    if (!readSet.has(key)) {
      const newSet = new Set(readSet);
      newSet.add(key);
      setReadSetState(newSet);
      setReadSet(newSet);
    }
  };

  // 全部标记为已读
  const markAllAsRead = () => {
    const newSet = new Set(readSet);
    logs.forEach(log => newSet.add(getNotiKey(log)));
    setReadSetState(newSet);
    setReadSet(newSet);
  };

  // 超级管理员清空（后端）
  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear all notifications?')) return;
    setClearing(true);
    try {
      await clearAuditLogs();
      setLogs([]);
      // 本地也清空
      setReadSetState(new Set());
      setReadSet(new Set());
    } catch (error) {
      // ignore
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    if (!userProfile) return;
    const loadLogs = async () => {
      setLoading(true);
      try {
        const logs = await getNotificationLogs(userProfile);
        setLogs(logs.slice(0, 50));
      } catch (error) {
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };
    loadLogs();
    return () => {};
  }, [userProfile]);

  useEffect(() => {
    if (!userProfile) return;
    const loadPending = async () => {
      setLoading(true);
      try {
        const records = await getPendingRecords();
        setPendingRecords(records);
      } catch (error) {
        setPendingRecords([]);
      } finally {
        setLoading(false);
      }
    };
    loadPending();
    return () => {};
  }, [userProfile]);

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

  // 排序：Just now（1分钟内）最前，其余按时间倒序
  const now = new Date();
  const sortedLogs = logs.slice().sort((a, b) => {
    const dateA = new Date(a.time);
    const dateB = new Date(b.time);
    const diffA = now.getTime() - dateA.getTime();
    const diffB = now.getTime() - dateB.getTime();
    const isJustNowA = !isNaN(dateA.getTime()) && diffA >= 0 && diffA < 60 * 1000;
    const isJustNowB = !isNaN(dateB.getTime()) && diffB >= 0 && diffB < 60 * 1000;
    if (isJustNowA && !isJustNowB) return -1;
    if (!isJustNowA && isJustNowB) return 1;
    if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
      return dateB.getTime() - dateA.getTime();
    }
    if (!isNaN(dateA.getTime())) return -1;
    if (!isNaN(dateB.getTime())) return 1;
    return 0;
  });
  // 只显示最近50条
  const recentLogs = sortedLogs.slice(0, 50);
  const logCount = logs.length;

  // 按时间倒序
  const sortedRecords = pendingRecords.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) markAllAsRead();
        }}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors dark:text-slate-300 dark:hover:text-slate-100 dark:hover:bg-slate-700"
      >
        <Bell className="h-6 w-6" />
        {notiCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {notiCount > 99 ? '99+' : notiCount}
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
            {logs.length === 0 ? (
              <div className="p-3 sm:p-4 text-center text-gray-500 dark:text-slate-400">
                <Bell className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-1 sm:mb-2 text-gray-300 dark:text-slate-500" />
                <p className="text-xs sm:text-sm">No Notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-300 dark:divide-slate-600">
                {recentLogs.map((log, idx) => {
                  const isUnread = !readSet.has(getNotiKey(log));
                  return (
                    <div
                      key={idx}
                      className={`p-2 sm:p-3 hover:bg-gray-50 transition-colors dark:hover:bg-slate-700 flex items-start gap-2 ${isUnread ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
                      onClick={() => markAsRead(log)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {getActionIcon(log.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 gap-1">
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-slate-100 truncate max-w-[60vw]">{log.action}</span>
                            <span className="text-xs text-gray-500 dark:text-slate-300 whitespace-nowrap ml-1 sm:ml-2">Created by {log.user}</span>
                          </div>
                          <span className="text-xs text-gray-400 flex items-center gap-1 dark:text-slate-400 whitespace-nowrap">
                            <Clock className="h-3 w-3" />
                            {formatTimeAgo(log.time)}
                          </span>
                        </div>
                        <div className="text-xs sm:text-sm text-gray-600 mb-1 dark:text-slate-300 truncate max-w-[80vw]">
                          {getLogSummary(log)}
                        </div>
                      </div>
                      {isUnread && <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mt-2 ml-2"></span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-2 sm:p-3 border-t border-gray-200 dark:border-slate-600 flex items-center justify-between">
            <Link
              href="/notifications"
              className="block text-xs sm:text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              onClick={() => setIsOpen(false)}
            >
              View all notifications →
            </Link>
            {logs.length > 0 && (
              <>
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-gray-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300 ml-2"
                >
                  Mark all as read
                </button>
                {isSuperAdmin && (
                  <button
                    onClick={handleClearLogs}
                    disabled={clearing}
                    className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50 flex items-center gap-1 dark:text-red-400 dark:hover:text-red-300 ml-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear All
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 