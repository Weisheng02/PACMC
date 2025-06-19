import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// 初始化 Google Sheets API
const getSheetsClient = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
};

export async function GET() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const sheetName = process.env.GOOGLE_SHEET_NAME;
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    
    return NextResponse.json({
      success: true,
      config: {
        spreadsheetId,
        sheetName,
        serviceAccountEmail: serviceAccountEmail ? 'Configured' : 'Not configured',
        privateKey: process.env.GOOGLE_PRIVATE_KEY ? 'Configured' : 'Not configured'
      },
      message: 'Environment variables loaded successfully'
    });
  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json(
      { error: 'Test failed', details: error },
      { status: 500 }
    );
  }
} 