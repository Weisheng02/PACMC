import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function PATCH(request: NextRequest, { params }: { params: { fileId: string } }) {
  try {
    const { fileId } = params;
    const { newName } = await request.json();

    if (!fileId || !newName) {
      return NextResponse.json({ error: 'Missing fileId or newName' }, { status: 400 });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const drive = google.drive({ version: 'v3', auth });

    await drive.files.update({
      fileId,
      requestBody: { name: newName },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 