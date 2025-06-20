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

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Google Sheet ID not configured' },
        { status: 500 }
      );
    }

    // 首先获取所有工作表信息
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const sheetsList = spreadsheet.data.sheets;
    console.log('Available sheets:', sheetsList?.map((s: any) => s.properties?.title));

    // 查找包含财务数据的工作表
    let targetSheet = null;
    const possibleNames = ['Transaction', 'Transactions', 'Financial', 'Finance', 'Sheet1'];
    
    for (const sheet of sheetsList || []) {
      const title = sheet.properties?.title;
      if (title && possibleNames.includes(title)) {
        targetSheet = title;
        break;
      }
    }

    // 如果没找到，使用第一个工作表
    if (!targetSheet && sheetsList && sheetsList.length > 0) {
      targetSheet = sheetsList[0].properties?.title;
    }

    if (!targetSheet) {
      return NextResponse.json(
        { error: 'No suitable worksheet found' },
        { status: 500 }
      );
    }

    console.log('Using sheet:', targetSheet);

    // 读取数据
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${targetSheet}!A:P`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('No transaction sheet found or error reading transactions');
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

    console.log(`Found ${records.length} records`);
    return NextResponse.json({ records });
  } catch (error) {
    console.error('Error reading Google Sheets:', error);
    return NextResponse.json(
      { error: 'Failed to read financial records', details: error },
      { status: 500 }
    );
  }
} 