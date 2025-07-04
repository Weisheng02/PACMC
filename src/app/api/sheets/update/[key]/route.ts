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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
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
    
    console.log('Using sheet for update:', targetSheet);

    const body = await request.json();

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
    // 处理日期格式，确保保存为正确的格式
    let formattedDate = body.date;
    if (body.date) {
      try {
        const date = new Date(body.date);
        if (!isNaN(date.getTime())) {
          // 格式化为 YYYY-MM-DD
          formattedDate = date.toISOString().split('T')[0];
        }
      } catch (error) {
        console.warn('Date formatting failed:', body.date);
      }
    }
    // 构造新的行数据（按你表的16列顺序）
    const updatedRow = [
      key,
      body.account,
      formattedDate,
      body.type,
      body.who,
      body.amount,
      body.description,
      body.status || rows[rowIndex-1][7] || 'Pending',
      body.takePut === undefined ? (rows[rowIndex-1][8] === 'TRUE') : !!body.takePut,
      body.remark || '',
      rows[rowIndex-1][10] || '', // createdDate
      rows[rowIndex-1][11] || '', // createdBy
      rows[rowIndex-1][12] || '', // approvedDate
      rows[rowIndex-1][13] || '', // approvedBy
      body.lastUserUpdate || '', // lastUserUpdate
      new Date().toISOString(), // lastDateUpdate
    ];
    // 更新该行
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${targetSheet}!A${rowIndex}:P${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [updatedRow],
      },
    });

    // 写入详细操作日志
    try {
      const oldRow = rows[rowIndex-1];
      const oldValues: Record<string, any> = {
        Account: oldRow[1],
        Date: oldRow[2],
        Type: oldRow[3],
        Who: oldRow[4],
        Amount: oldRow[5],
        Description: oldRow[6],
        Status: oldRow[7],
        Remark: oldRow[9],
      };
      const newValues: Record<string, any> = {
        Account: body.account,
        Date: formattedDate,
        Type: body.type,
        Who: body.who,
        Amount: body.amount,
        Description: body.description,
        Status: body.status || oldRow[7] || 'Pending',
        Remark: body.remark || '',
      };
      const detail = `Account: ${newValues.Account}, Date: ${newValues.Date}, Type: ${newValues.Type}, Who: ${newValues.Who}, Amount: ${newValues.Amount}, Description: ${newValues.Description}, Status: ${newValues.Status}, Remark: ${newValues.Remark}`;
      const changedFields = Object.keys(newValues).filter(f => String(newValues[f]) !== String(oldValues[f]));
      
      if (changedFields.length > 0) {
        const oldSummary = changedFields.map(f => `${f}: ${oldValues[f]}`).join(', ');
        const newSummary = changedFields.map(f => `${f}: ${newValues[f]}`).join(', ');
        
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `audit_log!A:I`,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: [[
              new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              body.lastUserUpdate || '',
              'Edit Record',
              key,
              changedFields.join(', '),
              oldSummary,
              newSummary,
              detail,
              '1' // status字段设为1（活跃状态）
            ]],
          },
        });
      }
    } catch (logErr) {
      console.error('Failed to write audit log', logErr);
    }

    return NextResponse.json({ success: true, message: 'Record updated successfully', record: updatedRow });
  } catch (error) {
    console.error('Error updating record:', error);
    return NextResponse.json({ error: 'Failed to update record', details: error }, { status: 500 });
  }
} 