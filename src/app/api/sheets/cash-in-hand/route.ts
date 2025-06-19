import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// 初始化 Google Sheets API
const getAuthClient = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth;
};

// 获取现金在手余额
export async function GET() {
  try {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const sheetName = process.env.GOOGLE_SHEET_NAME || 'Sheet1';
    
    // 读取所有记录来计算现金在手
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Q`,
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      return NextResponse.json({ cashInHand: 0 });
    }

    // 跳过标题行，计算现金在手
    let cashInHand = 0;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length >= 16) { // 确保有足够的列
        const type = row[3]; // 类型列
        const amount = parseFloat(row[5]) || 0; // 金额列
        const cashInHandValue = parseFloat(row[9]) || 0; // 现金在手列（J列）
        
        if (type === 'Income') {
          cashInHand += cashInHandValue;
        } else if (type === 'Expense') {
          cashInHand -= cashInHandValue;
        }
      }
    }

    return NextResponse.json({ cashInHand });
  } catch (error) {
    console.error('Error getting cash in hand:', error);
    return NextResponse.json(
      { error: 'Failed to get cash in hand' },
      { status: 500 }
    );
  }
}

// 更新现金在手余额
export async function PUT(request: NextRequest) {
  try {
    const { key, cashInHand, type } = await request.json();
    
    if (typeof cashInHand !== 'number' || cashInHand < 0) {
      return NextResponse.json(
        { error: 'Invalid cash in hand amount' },
        { status: 400 }
      );
    }

    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const sheetName = process.env.GOOGLE_SHEET_NAME || 'Sheet1';
    
    // 找到对应的行并更新现金在手字段
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:A`,
    });

    const rows = response.data.values;
    if (!rows) {
      return NextResponse.json(
        { error: 'No data found' },
        { status: 404 }
      );
    }

    // 找到对应的行
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === key) {
        rowIndex = i + 1; // Google Sheets 行号从 1 开始
        break;
      }
    }

    if (rowIndex === -1) {
      return NextResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      );
    }

    // 更新现金在手字段（第10列，J列）
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!J${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[cashInHand]],
      },
    });

    // 更新最后修改信息
    const now = new Date().toISOString();
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!O${rowIndex}:P${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          'System', // 最后修改用户
          now, // 最后修改时间
        ]],
      },
    });

    return NextResponse.json({ 
      success: true, 
      cashInHand,
      message: `现金在手已更新为 ${cashInHand}` 
    });
  } catch (error) {
    console.error('Error updating cash in hand:', error);
    return NextResponse.json(
      { error: 'Failed to update cash in hand' },
      { status: 500 }
    );
  }
} 