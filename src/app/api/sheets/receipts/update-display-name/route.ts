import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { receiptKey, displayName } = body;
    if (!receiptKey) {
      return NextResponse.json({ error: 'Missing receiptKey' }, { status: 400 });
    }

    const sheets = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const auth = await sheets.getClient();
    const sheetsApi = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const sheetName = 'Receipt';

    // 先查找所有行，找到receiptKey所在行号
    const res = await sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:I`,
    });
    const rows = res.data.values || [];
    if (rows.length < 2) {
      return NextResponse.json({ error: 'No receipts found' }, { status: 404 });
    }
    const headers = rows[0];
    const keyIdx = headers.indexOf('receiptKey');
    const displayNameIdx = headers.indexOf('displayName');
    if (keyIdx === -1 || displayNameIdx === -1) {
      return NextResponse.json({ error: 'Sheet missing receiptKey or displayName column' }, { status: 500 });
    }
    let foundRow = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][keyIdx] === receiptKey) {
        foundRow = i + 1; // 1-based index, plus header
        break;
      }
    }
    if (foundRow === -1) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }
    // 更新displayName
    const cell = String.fromCharCode(65 + displayNameIdx) + foundRow;
    await sheetsApi.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!${cell}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[displayName || '']] },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 