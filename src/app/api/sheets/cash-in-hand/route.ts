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

// 获取工作表名称
const getSheetNames = async (sheets: any, spreadsheetId: string) => {
  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
    });
    
    const sheetsList = spreadsheet.data.sheets;
    const sheetNames = sheetsList?.map((s: any) => s.properties?.title) || [];
    console.log('Available sheets:', sheetNames);
    
    return sheetNames;
  } catch (error) {
    console.error('Error getting sheet names:', error);
    return [];
  }
};

// 查找财务数据工作表
const findTransactionSheet = (sheetNames: string[]) => {
  const possibleNames = ['Transaction', 'Transactions', 'Financial', 'Finance', 'Sheet1'];
  
  for (const name of possibleNames) {
    if (sheetNames.includes(name)) {
      return name;
    }
  }
  
  // 如果没找到，返回第一个工作表
  return sheetNames[0] || null;
};

// 获取现金在手余额
export async function GET() {
  try {
    const auth = getAuthClient();
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient as any });
    
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const cashSheetName = 'CashInHand';
    
    let cashInHand = 0;
    const records: CashInHandRecord[] = [];

    // 1. 首先计算基于财务记录的现金在手
    try {
      const sheetNames = await getSheetNames(sheets, spreadsheetId!);
      const transactionSheetName = findTransactionSheet(sheetNames);
      
      if (transactionSheetName) {
        console.log('Using transaction sheet:', transactionSheetName);
        
        const transactionResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: spreadsheetId!,
          range: `${transactionSheetName}!A:P`,
        });

        const transactionRows = transactionResponse.data.values;
        if (transactionRows && transactionRows.length > 1) {
          // 按日期排序，确保按时间顺序计算
          const sortedRows = transactionRows.slice(1).sort((a, b) => {
            const dateA = new Date(a[2] || '').getTime();
            const dateB = new Date(b[2] || '').getTime();
            return dateA - dateB;
          });

          sortedRows.forEach(row => {
            if (row.length >= 6) {
              const type = row[3]; // 类型列
              const amount = parseFloat(row[5]) || 0; // 金额列
              
              if (type === 'Income') {
                cashInHand += amount;
              } else if (type === 'Expense') {
                cashInHand -= amount;
              }
            }
          });
        }
      }
    } catch (error) {
      console.log('No transaction sheet found or error reading transactions');
    }

    // 2. 然后加上手动调整的现金变动
    try {
      const cashResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId!,
        range: `${cashSheetName}!A:G`,
      });

      const cashRows = cashResponse.data.values;
      if (cashRows && cashRows.length > 1) {
        for (let i = 1; i < cashRows.length; i++) {
          const row = cashRows[i];
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
      }
    } catch (error) {
      console.log('No cash in hand sheet found or error reading cash records');
    }

    return NextResponse.json({ cashInHand, records });
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
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient as any });
    
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
        spreadsheetId: spreadsheetId!,
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
        spreadsheetId: spreadsheetId!,
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
        spreadsheetId: spreadsheetId!,
        range: `${cashSheetName}!A1:G1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['Key', 'Date', 'Type', 'Amount', 'Description', 'Created By', 'Created Date']],
        },
      });

      // 添加数据行
      await sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheetId!,
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