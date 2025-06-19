import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { CashInHandRecord } from '@/lib/googleSheets';

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
    const cashSheetName = 'CashInHand'; // 现金在手工作表
    
    // 尝试读取现金在手工作表
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${cashSheetName}!A:F`,
      });

      const rows = response.data.values;
      if (!rows || rows.length <= 1) {
        return NextResponse.json({ cashInHand: 0, records: [] });
      }

      // 计算现金在手余额
      let cashInHand = 0;
      const records: CashInHandRecord[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length >= 6) {
          const amount = parseFloat(row[3]) || 0;
          cashInHand += amount;
          
          records.push({
            key: row[0] || '',
            date: row[1] || '',
            type: (row[2] as 'Adjustment' | 'Transfer' | 'Other') || 'Other',
            amount: amount,
            description: row[4] || '',
            createdBy: row[5] || '',
            createdDate: row[6] || '',
          });
        }
      }

      return NextResponse.json({ cashInHand, records });
    } catch (error) {
      // 如果现金在手工作表不存在，返回默认值
      return NextResponse.json({ cashInHand: 0, records: [] });
    }
  } catch (error) {
    console.error('Error getting cash in hand:', error);
    return NextResponse.json(
      { error: 'Failed to get cash in hand' },
      { status: 500 }
    );
  }
}

// 添加现金在手记录
export async function POST(request: NextRequest) {
  try {
    const { date, type, amount, description, createdBy } = await request.json();
    
    if (!date || !type || typeof amount !== 'number' || !description || !createdBy) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const cashSheetName = 'CashInHand';
    
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

    // 准备新行数据
    const newRow = [
      key,                    // A: Key
      date,                   // B: Date
      type,                   // C: Type
      amount.toString(),      // D: Amount
      description,            // E: Description
      createdBy,              // F: Created By
      now,                    // G: Created Date
    ];

    // 尝试添加到现金在手工作表
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${cashSheetName}!A:G`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [newRow],
        },
      });
    } catch (error) {
      // 如果工作表不存在，先创建工作表
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: cashSheetName,
                },
              },
            },
          ],
        },
      });

      // 添加标题行
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${cashSheetName}!A1:G1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['Key', 'Date', 'Type', 'Amount', 'Description', 'Created By', 'Created Date']],
        },
      });

      // 添加数据行
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${cashSheetName}!A:G`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [newRow],
        },
      });
    }

    const newRecord: CashInHandRecord = {
      key,
      date,
      type,
      amount,
      description,
      createdBy,
      createdDate: now,
    };

    return NextResponse.json({ 
      success: true, 
      record: newRecord,
      message: `现金在手已${amount >= 0 ? '增加' : '减少'} ${Math.abs(amount)}` 
    });
  } catch (error) {
    console.error('Error adding cash in hand record:', error);
    return NextResponse.json(
      { error: 'Failed to add cash in hand record' },
      { status: 500 }
    );
  }
} 