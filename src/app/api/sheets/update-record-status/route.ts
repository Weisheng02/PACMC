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

  return google.sheets({ version: 'v4', auth: auth as any });
};

// 获取工作表名称
const getSheetNames = async (sheets: any, spreadsheetId: string) => {
  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
    });
    
    const sheetsList = spreadsheet.data.sheets;
    const sheetNames = sheetsList?.map((s: any) => s.properties?.title) || [];
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
  
  return sheetNames[0] || null;
};

export async function POST(request: NextRequest) {
  return handleStatusUpdate(request);
}

export async function PUT(request: NextRequest) {
  return handleStatusUpdate(request);
}

async function handleStatusUpdate(request: NextRequest) {
  try {
    const { key, status, approvedBy } = await request.json();
    
    if (!key || !status) {
      return NextResponse.json({ error: 'Missing key or status' }, { status: 400 });
    }

    if (!['Approved', 'Pending'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    const sheets = getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Google Sheet ID not configured' }, { status: 500 });
    }

    const sheetNames = await getSheetNames(sheets, spreadsheetId);
    const targetSheet = findTransactionSheet(sheetNames);

    if (!targetSheet) {
      return NextResponse.json({ error: 'No suitable worksheet found' }, { status: 500 });
    }
    
    console.log('Using sheet for status update:', targetSheet);

    // 读取所有数据来找到要更新的行
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${targetSheet}!A:P`,
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'No data found' }, { status: 404 });
    }

    // 找到要更新的行的索引（跳过标题行）
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === key) {
        rowIndex = i + 1; // Google Sheets 行号从 1 开始
        break;
      }
    }
    
    if (rowIndex === -1) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // 更新状态列（第8列，H列）
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${targetSheet}!H${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[status]],
      },
    });

    // 如果状态改为已审核，更新审核信息
    if (status === 'Approved') {
      const now = new Date().toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      // 分别更新审核日期和审核人
      // 审核日期（第13列，M列）
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${targetSheet}!M${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[now]],
        },
      });

      // 审核人（第14列，N列）
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${targetSheet}!N${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[approvedBy || 'System']],
        },
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: `记录状态已更新为: ${status === 'Approved' ? '已审核' : '待审核'}`,
      status 
    });
  } catch (error) {
    console.error('Error updating record status:', error);
    return NextResponse.json({ 
      error: 'Failed to update record status', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 