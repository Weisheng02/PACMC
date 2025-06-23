'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SuperAdminOnly } from '@/components/PermissionGate';
import { Bell, Trash2, Filter, Calendar, User, FileText, Eye, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="mr-4">
                <span className="text-gray-600 hover:text-gray-900">← Back</span>
              </Link>
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
                Audit Logs
              </h1>
            </div>
            <SuperAdminOnly>
              <button
                onClick={handleClear}
                disabled={clearing}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-5 w-5" />
                Clear Logs
              </button>
            </SuperAdminOnly>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-white border-b border-gray-300 px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Group by:</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className="px-3 py-1 text-sm border border-gray-400 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="action">By Action Type</option>
              <option value="user">By User</option>
              <option value="date">By Date</option>
              <option value="none">No Grouping</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Action Type:</span>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="px-3 py-1 text-sm border border-gray-400 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              {uniqueActions.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">User:</span>
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="px-3 py-1 text-sm border border-gray-400 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              {uniqueUsers.map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
          </div>

          <div className="text-sm text-gray-600">
            Total: {filteredLogs.length} logs
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="max-w-6xl mx-auto">
          {filteredLogs.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <Bell className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              No audit logs
            </div>
          ) : groupBy === 'none' ? (
            // 不分组显示
            <div className="space-y-4">
              {filteredLogs.map((log, idx) => (
                <div key={idx} className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getActionIcon(log.action)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getActionColor(log.action)}`}>
                            {log.action}
                          </span>
                          <span className="text-sm text-gray-600">{log.user}</span>
                        </div>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatTimeAgo(log.time)}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-700 mb-1">
                        <span className="font-medium">Object:</span> {log.object}
                        {log.field && log.field !== 'All Fields' && (
                          <>
                            <span className="mx-1">•</span>
                            <span className="font-medium">Field:</span> {log.field}
                          </>
                        )}
                      </div>
                      
                      {log.old && log.new && (
                        <div className="text-xs text-gray-600 mb-1">
                          <span className="line-through">{log.old}</span>
                          <span className="mx-1">→</span>
                          <span className="text-blue-600">{log.new}</span>
                        </div>
                      )}
                      
                      {log.detail && (
                        <p className="text-xs text-gray-500 truncate" title={log.detail}>
                          {log.detail}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // 分组显示
            <div className="space-y-6">
              {Object.entries(groupedLogs).map(([groupKey, group]) => (
                <div key={groupKey} className="bg-white rounded-lg shadow-sm border overflow-hidden">
                  <button
                    onClick={() => toggleGroup(groupKey)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      {groupBy === 'action' && getActionIcon(group.name)}
                      {groupBy === 'user' && <User className="h-4 w-4 text-blue-500" />}
                      {groupBy === 'date' && <Calendar className="h-4 w-4 text-green-500" />}
                      <span className="font-medium text-gray-900">{group.name}</span>
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                        {group.count}
                      </span>
                    </div>
                    {expandedGroups.has(groupKey) ? (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-500" />
                    )}
                  </button>
                  
                  {expandedGroups.has(groupKey) && (
                    <div className="divide-y divide-gray-300">
                      {group.logs.map((log, idx) => (
                        <div key={idx} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 mt-0.5">
                              {getActionIcon(log.action)}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center space-x-2">
                                  <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getActionColor(log.action)}`}>
                                    {log.action}
                                  </span>
                                  {groupBy !== 'user' && (
                                    <span className="text-sm text-gray-600">{log.user}</span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatTimeAgo(log.time)}
                                </span>
                              </div>
                              
                              <div className="text-sm text-gray-700 mb-1">
                                <span className="font-medium">Object:</span> {log.object}
                                {log.field && log.field !== 'All Fields' && (
                                  <>
                                    <span className="mx-1">•</span>
                                    <span className="font-medium">Field:</span> {log.field}
                                  </>
                                )}
                              </div>
                              
                              {log.old && log.new && (
                                <div className="text-xs text-gray-600 mb-1">
                                  <span className="line-through">{log.old}</span>
                                  <span className="mx-1">→</span>
                                  <span className="text-blue-600">{log.new}</span>
                                </div>
                              )}
                              
                              {log.detail && (
                                <p className="text-xs text-gray-500 truncate" title={log.detail}>
                                  {log.detail}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 