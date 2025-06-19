import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { FinancialRecord } from '@/lib/googleSheets';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { account, date, type, who, amount, description, remark, createdBy } = body;

    // 验证必填字段
    if (!account || !date || !type || !who || !amount || !description || !createdBy) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const sheets = getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const sheetName = process.env.GOOGLE_SHEET_NAME || 'Transaction';

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Google Sheet ID not configured' },
        { status: 500 }
      );
    }

    // 生成唯一 Key
    const key = Math.random().toString(36).substr(2, 8);
    const now = new Date().toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    // 准备新行数据 - 匹配实际的列结构
    const newRow = [
      key,                    // A: Key
      account,                // B: Account
      date,                   // C: Date
      type,                   // D: Type
      who,                    // E: Who
      amount.toString(),      // F: Amount
      description,            // G: Description
      'Pending',              // H: Status (默认 Pending)
      'FALSE',                // I: Take/Put ?
      remark || '',           // J: Remark
      now,                    // K: Created Date
      createdBy,              // L: Created By
      '',                     // M: Approved Date
      '',                     // N: Approved By
      createdBy,              // O: Last User Update
      now,                    // P: Last Date Update
    ];

    // 添加到 Google Sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:P`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [newRow],
      },
    });

    const newRecord: FinancialRecord = {
      key,
      account,
      date,
      type,
      who,
      amount: parseFloat(amount),
      description,
      status: 'Pending',
      takePut: false,
      remark: remark || '',
      createdDate: now,
      createdBy,
      approvedDate: '',
      approvedBy: '',
      lastUserUpdate: createdBy,
      lastDateUpdate: now,
    };

    return NextResponse.json({ record: newRecord });
  } catch (error) {
    console.error('Error creating financial record:', error);
    return NextResponse.json(
      { error: 'Failed to create financial record' },
      { status: 500 }
    );
  }
} 