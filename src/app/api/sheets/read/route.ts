import { NextResponse } from 'next/server';
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

export async function GET() {
  try {
    // 打印所有关键环境变量
    console.log('GOOGLE_SHEET_ID:', process.env.GOOGLE_SHEET_ID);
    console.log('GOOGLE_SHEET_NAME:', process.env.GOOGLE_SHEET_NAME);
    console.log('GOOGLE_SERVICE_ACCOUNT_EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
    console.log('GOOGLE_PRIVATE_KEY exists:', !!process.env.GOOGLE_PRIVATE_KEY);

    const sheets = getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const sheetName = process.env.GOOGLE_SHEET_NAME || 'Transaction';

  
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Google Sheet ID not configured' },
        { status: 500 }
      );
    }

    // 只读取 Transaction 工作表
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:P`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ records: [] });
    }

    // 跳过标题行，转换数据
    const records: FinancialRecord[] = rows.slice(1).map((row) => ({
      key: row[0] || '',
      account: row[1] || '',
      date: row[2] || '',
      type: (row[3] as 'Income' | 'Expense') || 'Expense',
      who: row[4] || '',
      amount: parseFloat(row[5]) || 0,
      description: row[6] || '',
      status: (row[7] as 'Approved' | 'Pending') || 'Pending',
      takePut: row[8] === 'TRUE',
      remark: row[9] || '',
      createdDate: row[10] || '',
      createdBy: row[11] || '',
      approvedDate: row[12] || '',
      approvedBy: row[13] || '',
      lastUserUpdate: row[14] || '',
      lastDateUpdate: row[15] || '',
    }));

    return NextResponse.json({ records });
  } catch (error) {
    console.error('Error reading Google Sheets:', error, JSON.stringify(error));
    return NextResponse.json(
      { error: 'Failed to read financial records', details: error },
      { status: 500 }
    );
  }
} 