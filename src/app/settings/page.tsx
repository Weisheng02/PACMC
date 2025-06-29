'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LoggedInUser } from '@/components/PermissionGate';
import { ArrowLeft, Settings, Moon, Sun, Bell, Globe, Shield, Palette, Save, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const { user, userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [settings, setSettings] = useState({
    theme: 'system',
    notifications: {
      email: true,
      push: true,
      receipts: true,
      updates: false,
    },
    language: 'en',
    privacy: {
      profileVisibility: 'public',
      dataSharing: false,
    },
    display: {
      compactMode: false,
      showAvatars: true,
      animations: true,
    }
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('userSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Error parsing saved settings:', error);
      }
    }
  }, []);

  // Apply theme when settings change
  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  const applyTheme = (theme: string) => {
    const root = document.documentElement;
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  const handleSettingChange = (category: string, key: string, value: any) => {
    setSettings(prev => {
      const newSettings = {
        ...prev,
        [category]: {
          ...prev[category as keyof typeof prev],
          [key]: value
        }
      };
      
      // Save to localStorage
      localStorage.setItem('userSettings', JSON.stringify(newSettings));
      
      return newSettings;
    });
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    setMessage(null);
    
    try {
      // Simulate API call to save settings
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      
      // Clear message after 3 seconds
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const getThemeIcon = (theme: string) => {
    switch (theme) {
      case 'light':
        return <Sun className="h-4 w-4" />;
      case 'dark':
        return <Moon className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  const getLanguageName = (code: string) => {
    const languages: { [key: string]: string } = {
      en: 'English',
      zh: '中文',
      es: 'Español',
      fr: 'Français',
      de: 'Deutsch',
      ja: '日本語',
    };
    return languages[code] || code;
  };

  return (
    <LoggedInUser
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center dark:bg-slate-900">
          <div className="text-center">
            <Settings className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-slate-100">Please Log In</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">You need to be logged in to access settings</p>
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
                  Settings
                </h1>
              </div>
              <button
                onClick={handleSaveSettings}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Message */}
            {message && (
              <div className={`p-4 rounded-md flex items-center gap-2 ${
                message.type === 'success' 
                  ? 'bg-green-50 border border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'
                  : 'bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
              }`}>
                {message.type === 'success' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                {message.text}
              </div>
            )}

            {/* Appearance */}
            <div className="bg-white rounded-lg shadow-sm border dark:bg-slate-800 dark:border-slate-700">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Appearance
                </h3>
                
                <div className="space-y-4">
                  {/* Theme */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Theme
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {['light', 'dark', 'system'].map((theme) => (
                        <button
                          key={theme}
                          onClick={() => handleSettingChange('theme', 'theme', theme)}
                          className={`flex items-center justify-center gap-2 p-3 rounded-md border transition-colors ${
                            settings.theme === theme
                              ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                              : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
                          }`}
                        >
                          {getThemeIcon(theme)}
                          <span className="capitalize">{theme}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Display Options */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">Compact Mode</h4>
                        <p className="text-xs text-gray-500 dark:text-slate-400">Reduce spacing for more content</p>
                      </div>
                      <button
                        onClick={() => handleSettingChange('display', 'compactMode', !settings.display.compactMode)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.display.compactMode ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.display.compactMode ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">Show Avatars</h4>
                        <p className="text-xs text-gray-500 dark:text-slate-400">Display user profile pictures</p>
                      </div>
                      <button
                        onClick={() => handleSettingChange('display', 'showAvatars', !settings.display.showAvatars)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.display.showAvatars ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.display.showAvatars ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">Animations</h4>
                        <p className="text-xs text-gray-500 dark:text-slate-400">Enable smooth transitions</p>
                      </div>
                      <button
                        onClick={() => handleSettingChange('display', 'animations', !settings.display.animations)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.display.animations ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.display.animations ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-white rounded-lg shadow-sm border dark:bg-slate-800 dark:border-slate-700">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications
                </h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">Email Notifications</h4>
                      <p className="text-xs text-gray-500 dark:text-slate-400">Receive updates via email</p>
                    </div>
                    <button
                      onClick={() => handleSettingChange('notifications', 'email', !settings.notifications.email)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings.notifications.email ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.notifications.email ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">Push Notifications</h4>
                      <p className="text-xs text-gray-500 dark:text-slate-400">Browser push notifications</p>
                    </div>
                    <button
                      onClick={() => handleSettingChange('notifications', 'push', !settings.notifications.push)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings.notifications.push ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.notifications.push ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">Receipt Alerts</h4>
                      <p className="text-xs text-gray-500 dark:text-slate-400">New receipt notifications</p>
                    </div>
                    <button
                      onClick={() => handleSettingChange('notifications', 'receipts', !settings.notifications.receipts)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings.notifications.receipts ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.notifications.receipts ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">System Updates</h4>
                      <p className="text-xs text-gray-500 dark:text-slate-400">App updates and maintenance</p>
                    </div>
                    <button
                      onClick={() => handleSettingChange('notifications', 'updates', !settings.notifications.updates)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings.notifications.updates ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.notifications.updates ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Language & Region */}
            <div className="bg-white rounded-lg shadow-sm border dark:bg-slate-800 dark:border-slate-700">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Language & Region
                </h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    Language
                  </label>
                  <select
                    value={settings.language}
                    onChange={(e) => handleSettingChange('language', 'language', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  >
                    <option value="en">English</option>
                    <option value="zh">中文</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                    <option value="ja">日本語</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Privacy & Security */}
            <div className="bg-white rounded-lg shadow-sm border dark:bg-slate-800 dark:border-slate-700">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Privacy & Security
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Profile Visibility
                    </label>
                    <select
                      value={settings.privacy.profileVisibility}
                      onChange={(e) => handleSettingChange('privacy', 'profileVisibility', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                      <option value="friends">Friends Only</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">Data Sharing</h4>
                      <p className="text-xs text-gray-500 dark:text-slate-400">Allow data for analytics</p>
                    </div>
                    <button
                      onClick={() => handleSettingChange('privacy', 'dataSharing', !settings.privacy.dataSharing)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings.privacy.dataSharing ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.privacy.dataSharing ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </LoggedInUser>
  );
} 