import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC-RAupzAfGs4tjsu2a0xY0lvjoJ2sKX-0",
  authDomain: "pacmc-money-website.firebaseapp.com",
  projectId: "pacmc-money-website",
  storageBucket: "pacmc-money-website.firebasestorage.app",
  messagingSenderId: "500755763868",
  appId: "1:500755763868:web:ecb55f088631d225509359"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();

// User roles
export type UserRole = 'finance' | 'core' | 'leadership';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

// 管理员邮箱列表
const ADMIN_EMAILS = ['weisheng020925@gmail.com'];

// Sign in with Google
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Check if user exists in Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (!userDoc.exists()) {
      // New user - check if admin email
      let defaultRole: UserRole = 'core';
      if (ADMIN_EMAILS.includes(user.email || '')) {
        defaultRole = 'finance';
      }
      
      const newUser: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        name: user.displayName || '',
        role: defaultRole,
        createdAt: new Date()
      };
      
      await setDoc(doc(db, 'users', user.uid), newUser);
      return newUser;
    }
    
    return userDoc.data() as UserProfile;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

// Sign out
export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Get user profile from Firestore
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
};

// Update user role (admin function)
export const updateUserRole = async (uid: string, role: UserRole) => {
  try {
    await setDoc(doc(db, 'users', uid), { role }, { merge: true });
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
};

// Auth state listener
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
}; 