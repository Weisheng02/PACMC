import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, Timestamp, writeBatch } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

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
export const storage = getStorage(app);

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

// 收据管理接口
export interface Receipt {
  id: string;
  recordKey: string; // 关联的财务记录key
  fileName: string;
  originalName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: Date;
  description?: string;
  tags?: string[];
}

// 通知接口
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  category: 'budget' | 'bill' | 'receipt' | 'approval' | 'system';
  isRead: boolean;
  createdAt: Date;
  expiresAt?: Date;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

// 用户通知设置接口
export interface NotificationSettings {
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  budgetAlerts: boolean;
  billReminders: boolean;
  receiptUploads: boolean;
  approvalRequests: boolean;
  systemUpdates: boolean;
}

// 收据管理函数
export const uploadReceipt = async (
  file: File, 
  recordKey: string, 
  description?: string, 
  tags?: string[]
): Promise<Receipt> => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    // 生成唯一文件名
    const timestamp = Date.now();
    const fileName = `receipts/${recordKey}/${timestamp}_${file.name}`;
    const storageRef = ref(storage, fileName);

    // 创建文件元数据
    const metadata = {
      customMetadata: {
        uploadedBy: user.uid,
        recordKey: recordKey,
        originalName: file.name,
        description: description || '',
        tags: tags?.join(',') || '',
        uploadedAt: new Date().toISOString(),
      }
    };

    // 上传文件
    const snapshot = await uploadBytes(storageRef, file, metadata);
    const downloadURL = await getDownloadURL(snapshot.ref);

    // 创建收据记录
    const receiptData: Omit<Receipt, 'id'> = {
      recordKey,
      fileName,
      originalName: file.name,
      fileUrl: downloadURL,
      fileSize: file.size,
      mimeType: file.type,
      uploadedBy: user.uid,
      uploadedAt: new Date(),
      description,
      tags: tags || [],
    };

    const docRef = await addDoc(collection(db, 'receipts'), receiptData);
    
    return {
      id: docRef.id,
      ...receiptData,
    };
  } catch (error) {
    console.error('Error uploading receipt:', error);
    throw error;
  }
};

export const getReceiptsByRecord = async (recordKey: string): Promise<Receipt[]> => {
  try {
    const q = query(
      collection(db, 'receipts'),
      where('recordKey', '==', recordKey),
      orderBy('uploadedAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      uploadedAt: doc.data().uploadedAt.toDate(),
    })) as Receipt[];
  } catch (error) {
    console.error('Error getting receipts:', error);
    throw error;
  }
};

export const deleteReceipt = async (receiptId: string): Promise<void> => {
  try {
    const receiptDoc = await getDoc(doc(db, 'receipts', receiptId));
    if (!receiptDoc.exists()) {
      throw new Error('Receipt not found');
    }

    const receiptData = receiptDoc.data() as Receipt;
    
    // 删除存储中的文件
    const storageRef = ref(storage, receiptData.fileName);
    await deleteObject(storageRef);
    
    // 删除数据库记录
    await deleteDoc(doc(db, 'receipts', receiptId));
  } catch (error) {
    console.error('Error deleting receipt:', error);
    throw error;
  }
};

// 通知管理函数
export const createNotification = async (
  userId: string,
  title: string,
  message: string,
  type: Notification['type'] = 'info',
  category: Notification['category'] = 'system',
  actionUrl?: string,
  metadata?: Record<string, any>
): Promise<Notification> => {
  try {
    const notificationData: Omit<Notification, 'id'> = {
      userId,
      title,
      message,
      type,
      category,
      isRead: false,
      createdAt: new Date(),
      actionUrl,
      metadata,
    };

    const docRef = await addDoc(collection(db, 'notifications'), notificationData);
    
    return {
      id: docRef.id,
      ...notificationData,
    };
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

export const getUserNotifications = async (userId: string): Promise<Notification[]> => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate(),
      expiresAt: doc.data().expiresAt?.toDate(),
    })) as Notification[];
  } catch (error) {
    console.error('Error getting notifications:', error);
    throw error;
  }
};

export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      isRead: true,
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('isRead', '==', false)
    );
    
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { isRead: true });
    });
    
    await batch.commit();
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

export const deleteNotification = async (notificationId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

export const getNotificationSettings = async (userId: string): Promise<NotificationSettings | null> => {
  try {
    const docRef = await getDoc(doc(db, 'notificationSettings', userId));
    if (docRef.exists()) {
      return docRef.data() as NotificationSettings;
    }
    return null;
  } catch (error) {
    console.error('Error getting notification settings:', error);
    return null;
  }
};

export const updateNotificationSettings = async (
  userId: string, 
  settings: Partial<NotificationSettings>
): Promise<void> => {
  try {
    await setDoc(doc(db, 'notificationSettings', userId), settings, { merge: true });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    throw error;
  }
};

// 实时通知监听
export const subscribeToNotifications = (
  userId: string,
  callback: (notifications: Notification[]) => void
) => {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate(),
      expiresAt: doc.data().expiresAt?.toDate(),
    })) as Notification[];
    
    callback(notifications);
  });
};

// 系统通知函数
export const sendBudgetAlert = async (userId: string, budgetName: string, currentAmount: number, budgetLimit: number) => {
  const percentage = (currentAmount / budgetLimit) * 100;
  let type: Notification['type'] = 'info';
  let title = 'Budget Alert';
  
  if (percentage >= 90) {
    type = 'warning';
    title = 'Budget Warning';
  } else if (percentage >= 100) {
    type = 'error';
    title = 'Budget Exceeded';
  }
  
  await createNotification(
    userId,
    title,
    `${budgetName} is at ${percentage.toFixed(1)}% of limit (RM${currentAmount.toFixed(2)} / RM${budgetLimit.toFixed(2)})`,
    type,
    'budget'
  );
};

export const sendBillReminder = async (userId: string, billName: string, dueDate: Date, amount: number) => {
  const daysUntilDue = Math.ceil((dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  
  let type: Notification['type'] = 'info';
  let title = 'Bill Reminder';
  
  if (daysUntilDue <= 0) {
    type = 'error';
    title = 'Bill Overdue';
  } else if (daysUntilDue <= 3) {
    type = 'warning';
    title = 'Bill Due Soon';
  }
  
  await createNotification(
    userId,
    title,
    `${billName} (RM${amount.toFixed(2)}) is due in ${daysUntilDue} days`,
    type,
    'bill',
    '/financial-list'
  );
};

export const sendApprovalRequest = async (adminIds: string[], recordKey: string, amount: number, description: string) => {
  const promises = adminIds.map(adminId =>
    createNotification(
      adminId,
      'Approval Request',
      `New ${amount >= 0 ? 'income' : 'expense'} record (RM${Math.abs(amount).toFixed(2)}) requires approval: ${description}`,
      'info',
      'approval',
      `/edit-record/${recordKey}`
    )
  );
  
  await Promise.all(promises);
};

export const sendReceiptUploadNotification = async (userId: string, fileName: string, recordKey: string) => {
  await createNotification(
    userId,
    'Receipt Uploaded',
    `Receipt "${fileName}" has been successfully uploaded`,
    'success',
    'receipt',
    `/edit-record/${recordKey}`
  );
};

// 新记录通知功能
export const sendNewRecordNotification = async (
  recordKey: string,
  description: string,
  amount: number,
  type: 'Income' | 'Expense',
  createdBy: string
) => {
  try {
    // 获取所有Admin和Super Admin用户
    const usersCollection = collection(db, 'users');
    const userSnapshot = await getDocs(usersCollection);
    const adminUsers = userSnapshot.docs
      .map(doc => doc.data() as UserProfile)
      .filter(user => user.role === 'Admin' || user.role === 'Super Admin');

    // 为每个Admin用户创建通知
    const notificationPromises = adminUsers.map(adminUser =>
      createNotification(
        adminUser.uid,
        'New Financial Record',
        `New ${type.toLowerCase()} record (RM${amount.toFixed(2)}) created by ${createdBy}: ${description}`,
        'info',
        'approval',
        `/edit-record/${recordKey}`,
        {
          recordKey,
          amount,
          type,
          createdBy,
          description
        }
      )
    );

    await Promise.all(notificationPromises);

    // 发送Email通知（如果配置了email服务）
    await sendEmailNotificationToAdmins(adminUsers, recordKey, description, amount, type, createdBy);

    console.log(`Sent new record notifications to ${adminUsers.length} admin users`);
  } catch (error) {
    console.error('Error sending new record notifications:', error);
    throw error;
  }
};

// Email通知功能
const sendEmailNotificationToAdmins = async (
  adminUsers: UserProfile[],
  recordKey: string,
  description: string,
  amount: number,
  type: 'Income' | 'Expense',
  createdBy: string
) => {
  try {
    // 这里可以集成第三方email服务，如SendGrid, Mailgun等
    // 目前先记录到控制台，后续可以扩展
    console.log('Email notification would be sent to:', {
      recipients: adminUsers.map(user => user.email),
      subject: `New Financial Record - ${type} RM${amount.toFixed(2)}`,
      message: `
        A new financial record has been created and requires your approval.
        
        Record Details:
        - Type: ${type}
        - Amount: RM${amount.toFixed(2)}
        - Description: ${description}
        - Created By: ${createdBy}
        - Record Key: ${recordKey}
        
        Please review and approve this record at: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/edit-record/${recordKey}
        
        Best regards,
        PACMC Money System
      `
    });

    // TODO: 集成实际的email服务
    // 示例：使用SendGrid
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // 
    // const msg = {
    //   to: adminUsers.map(user => user.email),
    //   from: 'noreply@pacmc-money.com',
    //   subject: `New Financial Record - ${type} RM${amount.toFixed(2)}`,
    //   text: `A new financial record has been created and requires your approval...`,
    //   html: `<p>A new financial record has been created and requires your approval...</p>`,
    // };
    // 
    // await sgMail.send(msg);

  } catch (error) {
    console.error('Error sending email notifications:', error);
    // 不抛出错误，因为email通知失败不应该影响主要功能
  }
}; 