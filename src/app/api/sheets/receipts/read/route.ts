import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET() {
  try {
    const sheets = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const auth = await sheets.getClient();
    const sheetsApi = google.sheets({ version: 'v4', auth: auth as any });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const sheetName = 'Receipt';

    const res = await sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:I`,
    });
    const rows = res.data.values || [];
    if (rows.length < 2) {
      return NextResponse.json({ receipts: [] });
    }
    const headers = rows[0];
    const receipts = rows.slice(1).map(row => {
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => { obj[h] = row[i] || ''; });
      return obj;
    });
    return NextResponse.json({ receipts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 