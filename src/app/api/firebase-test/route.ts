import { NextResponse } from 'next/server';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC-RAupzAfGs4tjsu2a0xY0lvjoJ2sKX-0",
  authDomain: "pacmc-money-website.firebaseapp.com",
  projectId: "pacmc-money-website",
  storageBucket: "pacmc-money-website.firebasestorage.app",
  messagingSenderId: "500755763868",
  appId: "1:500755763868:web:ecb55f088631d225509359"
};

export async function GET() {
  try {
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // Test Firestore connection
    const testDoc = doc(db, 'test', 'connection');
    
    // Try to read
    try {
      const docSnap = await getDoc(testDoc);
      console.log('Read test successful:', docSnap.exists());
    } catch (readError) {
      console.error('Read test failed:', readError);
    }
    
    // Try to write
    try {
      await setDoc(testDoc, {
        timestamp: new Date().toISOString(),
        test: true
      });
      console.log('Write test successful');
    } catch (writeError) {
      console.error('Write test failed:', writeError);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Firebase connection test completed',
      config: {
        projectId: firebaseConfig.projectId,
        authDomain: firebaseConfig.authDomain
      }
    });
  } catch (error) {
    console.error('Firebase test error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error
      },
      { status: 500 }
    );
  }
} 