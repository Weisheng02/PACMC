'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LoggedInUser } from '@/components/PermissionGate';
import { ArrowLeft, Bell, CheckCircle, AlertCircle, Info, X, Trash2, Filter } from 'lucide-react';
import Link from 'next/link';

interface NotificationLog {
  time: string;
  user: string;
  action: string;
  object: string;
  field: string;
  old: string;
  new: string;
  detail: string;
}

const PAGE_SIZE = 20;

// localStorage已读工具
function getNotiKey(log: NotificationLog) {
  return `noti:${log.time}|${log.action}|${log.user}`;
}
function getReadSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem('notiReadSet') || '[]'));
  } catch {
    return new Set();
  }
}
function setReadSet(set) {
  localStorage.setItem('notiReadSet', JSON.stringify(Array.from(set)));
}

export default function NotificationsPage() {
  const { userProfile, isSuperAdmin, isAdmin } = useAuth();
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState<'All' | 'Add Record' | 'Edit Record' | 'Delete Record' | 'Update Status'>('All');
  const [readSet, setReadSetState] = useState<Set<string>>(getReadSet());

  // 获取notification log
  const fetchLogs = async () => {
    setLoading(true);
    try {
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
      const data = await res.json();
      let logs = data.logs || [];
      // basic user: 只显示自己更改的和被approved的
      if (userProfile?.role === 'Basic User') {
        logs = logs.filter(log =>
          log.user === userProfile.name ||
          (log.action === 'Update Status' && log.detail && log.detail.includes(`Who: ${userProfile.name}`))
        );
      }
      setLogs(logs);
    } catch (err) {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // 全部标记为已读
  const markAllAsRead = () => {
    const newSet = new Set(readSet);
    logs.forEach(log => newSet.add(getNotiKey(log)));
    setReadSetState(newSet);
    setReadSet(newSet);
  };

  // 清空按钮逻辑
  const handleClear = async () => {
    if (isAdmin || isSuperAdmin) {
      if (!confirm('Are you sure you want to clear all notifications?')) return;
      setClearing(true);
      try {
        await fetch('/api/sheets/audit-log', { method: 'DELETE' });
        setLogs([]);
        setReadSetState(new Set());
        setReadSet(new Set());
      } catch (err) {
        // ignore
      } finally {
        setClearing(false);
      }
    } else {
      markAllAsRead();
    }
  };

  // 格式化时间
  const formatTimeAgo = (time: string | Date) => {
    let logTime: Date;
    if (typeof time === 'string') {
      // 先尝试直接new Date
      logTime = new Date(time);
      if (isNaN(logTime.getTime())) {
        // 尝试用正则拆分格式：YYYY-MM-DD HH:mm:ss
        const m = time.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{1,2}):(\d{1,2})/);
        if (m) {
          logTime = new Date(
            Number(m[1]),
            Number(m[2]) - 1,
            Number(m[3]),
            Number(m[4]),
            Number(m[5]),
            Number(m[6])
          );
        }
      }
    } else {
      logTime = time;
    }
    if (isNaN(logTime.getTime())) return 'Invalid date';
    const now = new Date();
    const diff = (now.getTime() - logTime.getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return logTime.toLocaleString('en-MY', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // 获取操作摘要
  const getLogSummary = (log: NotificationLog) => {
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

  // 类型筛选
  const filteredLogs = logs.filter(log => filterType === 'All' ? true : log.action === filterType);
  // 按时间排序：Just now（1分钟内）最前，其余按时间倒序
  const now = new Date();
  const sortedLogs = filteredLogs.slice().sort((a, b) => {
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
  const totalPages = Math.ceil(sortedLogs.length / PAGE_SIZE);
  const pagedLogs = sortedLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <LoggedInUser
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center dark:bg-slate-900">
          <div className="text-center">
            <Bell className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-slate-100">Please Log In</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">You need to be logged in to view notifications</p>
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
                  Notifications
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchLogs}
                  className="p-2 text-gray-500 hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-200"
                  title="Refresh"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M5.582 9A7.978 7.978 0 0 1 12 4c2.21 0 4.21.896 5.657 2.343M18.418 15A7.978 7.978 0 0 1 12 20a7.978 7.978 0 0 1-5.657-2.343" /></svg>
                </button>
                <div className="flex justify-center pt-4 gap-2">
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-gray-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300"
                  >
                    Mark all as read
                  </button>
                  <button
                    onClick={handleClear}
                    disabled={clearing}
                    className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50 flex items-center gap-1 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="max-w-2xl mx-auto">
            {/* 类型筛选 */}
            <div className="mb-4 flex gap-2 flex-wrap">
              {(['All', 'Add Record', 'Edit Record', 'Delete Record', 'Update Status'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => { setFilterType(type); setPage(1); }}
                  className={`px-3 py-1 text-sm rounded-md transition-colors border ${filterType === type ? 'bg-blue-100 text-blue-700 border-blue-400 dark:bg-blue-900/20 dark:text-blue-300' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'}`}
                >
                  {type === 'All' ? 'All Types' : type.replace(' Record', '')}
                </button>
              ))}
            </div>
            {/* Notifications List */}
            <div className="space-y-3">
              {loading ? (
                <div className="bg-white rounded-lg shadow-sm border dark:bg-slate-800 dark:border-slate-700 p-6">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-gray-600 dark:text-slate-400">Loading notifications...</span>
                  </div>
                </div>
              ) : pagedLogs.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border dark:bg-slate-800 dark:border-slate-700 p-8 text-center">
                  <Bell className="mx-auto h-12 w-12 text-gray-400 dark:text-slate-500" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No notifications</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">You're all caught up!</p>
                </div>
              ) : (
                <>
                  {pagedLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-lg shadow-sm border-l-4 border dark:border-slate-700 border-l-blue-500 bg-blue-50 dark:bg-blue-900/10"
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <AlertCircle className="h-5 w-5 text-blue-500" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                                  {log.action}
                                </h3>
                                <span className="inline-block text-xs text-gray-500 dark:text-slate-400">by {log.user}</span>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
                                {getLogSummary(log)}
                              </p>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-500 dark:text-slate-500">{log.time}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* 分页控件 */}
                  {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 pt-4">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 text-sm rounded-md border bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                      >
                        Prev
                      </button>
                      <span className="text-xs text-gray-500 dark:text-slate-400">Page {page} of {totalPages}</span>
                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1 text-sm rounded-md border bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </LoggedInUser>
  );
} 