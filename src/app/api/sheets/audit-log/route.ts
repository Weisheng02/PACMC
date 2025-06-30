import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const AUDIT_SHEET_NAME = 'audit_log';

// 获取 Google Sheets 客户端（修正版，带 credentials）
async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  return sheets;
}

// 读取日志
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userParam = searchParams.get('user');
    const roleParam = searchParams.get('role');
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${AUDIT_SHEET_NAME}!A2:I`,
    });
    const rows = res.data.values || [];
    let logs = rows.map(row => ({
      time: row[0],
      user: row[1],
      action: row[2],
      object: row[3],
      field: row[4],
      old: row[5],
      new: row[6],
      detail: row[7],
      status: row[8] || '1',
    }));
    // admin/super admin看到所有status=1和0，普通用户只看到status=1且属于自己的
    if (roleParam === 'Admin' || roleParam === 'Super Admin') {
      // 返回全部
    } else if (userParam) {
      logs = logs.filter(log => log.status === '1' && log.user === userParam);
    } else {
      logs = logs.filter(log => log.status === '1');
    }
    return NextResponse.json({ logs });
  } catch (err) {
    console.error('Audit log error:', err);
    return NextResponse.json({ error: 'Failed to fetch audit logs', details: String(err) }, { status: 500 });
  }
}

// 软删除日志（将status设为0）
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userParam = searchParams.get('user');
    const roleParam = searchParams.get('role');
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${AUDIT_SHEET_NAME}!A2:I`,
    });
    const rows = res.data.values || [];
    let updateRequests: { range: string; values: string[][] }[] = [];
    if (roleParam === 'Basic User' && userParam) {
      // 只清空属于该user的
      rows.forEach((row, index) => {
        if ((row[8] === '1' || row[8] === undefined) && row[1] === userParam) {
          updateRequests.push({
            range: `${AUDIT_SHEET_NAME}!I${index + 2}`,
            values: [['0']]
          });
        }
      });
    } else {
      // admin/super admin清空全部
      updateRequests = rows.map((row, index) => ({
        range: `${AUDIT_SHEET_NAME}!I${index + 2}`,
        values: [['0']]
      }));
    }
    if (updateRequests.length === 0) {
      return NextResponse.json({ success: true, message: 'No logs to clear' });
    }
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        valueInputOption: 'RAW',
        data: updateRequests
      }
    });
    return NextResponse.json({ 
      success: true, 
      message: `Cleared ${updateRequests.length} audit logs (soft delete)`,
      clearedCount: updateRequests.length
    });
  } catch (err) {
    console.error('Audit log error:', err);
    return NextResponse.json({ error: 'Failed to clear audit logs', details: String(err) }, { status: 500 });
  }
} 