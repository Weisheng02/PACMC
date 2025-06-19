'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { UserProfile, onAuthStateChange, getUserProfile } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isFinance: boolean;
  isCore: boolean;
  isLeadership: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  isFinance: false,
  isCore: false,
  isLeadership: false,
  error: null,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      try {
        setError(null);
        setUser(user);
        
        if (user) {
          console.log('User authenticated:', user.email);
          // Get user profile from Firestore
          const profile = await getUserProfile(user.uid);
          console.log('User profile loaded:', profile);
          setUserProfile(profile);
        } else {
          console.log('User signed out');
          setUserProfile(null);
        }
      } catch (err) {
        console.error('Auth state change error:', err);
        setError(err instanceof Error ? err.message : 'Authentication error');
        // Don't clear user on error, just set profile to null
        setUserProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const isFinance = userProfile?.role === 'finance';
  const isCore = userProfile?.role === 'core';
  const isLeadership = userProfile?.role === 'leadership';

  const value = {
    user,
    userProfile,
    loading,
    isFinance,
    isCore,
    isLeadership,
    error,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 