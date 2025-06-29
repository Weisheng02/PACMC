'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LoggedInUser } from '@/components/PermissionGate';
import { ArrowLeft, Bell, CheckCircle, AlertCircle, Info, X, Trash2, Filter } from 'lucide-react';
import Link from 'next/link';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Mock notifications data
  useEffect(() => {
    const mockNotifications: Notification[] = [
      {
        id: '1',
        type: 'success',
        title: 'Receipt Uploaded Successfully',
        message: 'Your receipt "Grocery Store - $45.67" has been uploaded and processed.',
        timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        read: false,
        actionUrl: '/financial-list'
      },
      {
        id: '2',
        type: 'info',
        title: 'System Maintenance',
        message: 'Scheduled maintenance will occur on Sunday at 2:00 AM. Service may be temporarily unavailable.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        read: true
      },
      {
        id: '3',
        type: 'warning',
        title: 'Low Cash Balance',
        message: 'Your cash-in-hand balance is below the recommended threshold. Consider updating your records.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
        read: false,
        actionUrl: '/set-cash'
      },
      {
        id: '4',
        type: 'error',
        title: 'Upload Failed',
        message: 'Failed to upload receipt "Restaurant Receipt.jpg". Please try again or contact support.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
        read: true
      },
      {
        id: '5',
        type: 'success',
        title: 'Profile Updated',
        message: 'Your profile information has been successfully updated.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
        read: true
      },
      {
        id: '6',
        type: 'info',
        title: 'New Feature Available',
        message: 'Dark mode is now available! You can enable it in your settings.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
        read: false,
        actionUrl: '/settings'
      }
    ];

    // Simulate loading
    setTimeout(() => {
      setNotifications(mockNotifications);
      setLoading(false);
    }, 1000);
  }, []);

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const getFilteredNotifications = () => {
    switch (filter) {
      case 'unread':
        return notifications.filter(n => !n.read);
      case 'read':
        return notifications.filter(n => n.read);
      default:
        return notifications;
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return 'border-l-green-500 bg-green-50 dark:bg-green-900/10';
      case 'error':
        return 'border-l-red-500 bg-red-50 dark:bg-red-900/10';
      case 'warning':
        return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/10';
      case 'info':
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/10';
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const filteredNotifications = getFilteredNotifications();

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
                {unreadCount > 0 && (
                  <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300">
                    {unreadCount}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  <Filter className="h-5 w-5" />
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Mark all read
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="max-w-2xl mx-auto">
            {/* Filters */}
            {showFilters && (
              <div className="mb-6 bg-white rounded-lg shadow-sm border dark:bg-slate-800 dark:border-slate-700 p-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Filter Notifications</h3>
                <div className="flex gap-2">
                  {(['all', 'unread', 'read'] as const).map((filterType) => (
                    <button
                      key={filterType}
                      onClick={() => setFilter(filterType)}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        filter === filterType
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                      }`}
                    >
                      {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Notifications List */}
            <div className="space-y-3">
              {loading ? (
                <div className="bg-white rounded-lg shadow-sm border dark:bg-slate-800 dark:border-slate-700 p-6">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-gray-600 dark:text-slate-400">Loading notifications...</span>
                  </div>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border dark:bg-slate-800 dark:border-slate-700 p-8 text-center">
                  <Bell className="mx-auto h-12 w-12 text-gray-400 dark:text-slate-500" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No notifications</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                    {filter === 'all' ? 'You\'re all caught up!' : `No ${filter} notifications`}
                  </p>
                </div>
              ) : (
                <>
                  {filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`bg-white rounded-lg shadow-sm border-l-4 border dark:border-slate-700 ${getNotificationColor(notification.type)} ${
                        !notification.read ? 'ring-2 ring-blue-200 dark:ring-blue-800' : ''
                      }`}
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            {getNotificationIcon(notification.type)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                                  {notification.title}
                                </h3>
                                {!notification.read && (
                                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
                                {notification.message}
                              </p>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-500 dark:text-slate-500">
                                  {formatTimeAgo(notification.timestamp)}
                                </span>
                                {notification.actionUrl && (
                                  <Link
                                    href={notification.actionUrl}
                                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                    onClick={() => markAsRead(notification.id)}
                                  >
                                    View Details
                                  </Link>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 ml-2">
                            {!notification.read && (
                              <button
                                onClick={() => markAsRead(notification.id)}
                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                title="Mark as read"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => deleteNotification(notification.id)}
                              className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                              title="Delete notification"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Clear All Button */}
                  {filteredNotifications.length > 0 && (
                    <div className="flex justify-center pt-4">
                      <button
                        onClick={clearAll}
                        className="text-sm text-gray-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                      >
                        Clear all notifications
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