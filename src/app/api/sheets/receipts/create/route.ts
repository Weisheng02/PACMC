import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionKey, fileName, fileUrl, fileId, uploadBy, description, displayName } = body;

    if (!transactionKey || !fileName || !fileUrl || !fileId || !uploadBy) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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

    // 生成唯一 receiptKey
    const receiptKey = Math.random().toString(36).substr(2, 8);
    const uploadDate = new Date().toISOString();

    const newRow = [
      receiptKey,
      transactionKey,
      fileName,
      fileUrl,
      fileId,
      uploadDate,
      uploadBy,
      description || '',
      displayName || '',
    ];

    await sheetsApi.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:I`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [newRow] },
    });

    return NextResponse.json({ receiptKey });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 