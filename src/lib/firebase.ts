import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";

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
export type UserRole = 'Super Admin' | 'Admin' | 'Basic User';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

// 超级管理员邮箱列表
const SUPER_ADMIN_EMAILS = ['weisheng020925@gmail.com'];

// Sign in with Google
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      // New user - check if super admin email
      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        name: user.displayName || '',
        role: SUPER_ADMIN_EMAILS.includes(user.email || '') ? 'Super Admin' : 'Basic User',
        createdAt: new Date()
      };
      
      await setDoc(userRef, newProfile);
      return newProfile;

    } else {
      // Existing user - check and update role if necessary
      const userProfile = userDoc.data() as UserProfile;
      const validRoles: UserRole[] = ['Super Admin', 'Admin', 'Basic User'];
      
      let needsUpdate = false;
      let updatedRole = userProfile.role;

      // Ensure super admin has the correct role
      if (SUPER_ADMIN_EMAILS.includes(userProfile.email) && userProfile.role !== 'Super Admin') {
        updatedRole = 'Super Admin';
        needsUpdate = true;
      }
      // If role is invalid or missing, set to Basic User
      else if (!validRoles.includes(userProfile.role)) {
        updatedRole = 'Basic User';
        needsUpdate = true;
      }

      if (needsUpdate) {
        await setDoc(userRef, { role: updatedRole }, { merge: true });
        userProfile.role = updatedRole; // Update the profile object to return
      }
      
      return userProfile;
    }
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

// Get all users from Firestore (for admin panel)
export const getAllUsers = async (): Promise<UserProfile[]> => {
  try {
    const usersCollection = collection(db, 'users');
    const userSnapshot = await getDocs(usersCollection);
    const userList = userSnapshot.docs.map(doc => doc.data() as UserProfile);
    return userList;
  } catch (error) {
    console.error('Error getting all users:', error);
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