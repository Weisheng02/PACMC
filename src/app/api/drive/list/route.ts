import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// 初始化 Google Drive API
const getDriveClient = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_DRIVE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY)?.replace(/\\n/g, '\n'),
    },
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file'
    ],
  });

  return google.drive({ version: 'v3', auth });
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionKey = searchParams.get('transactionKey');
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!transactionKey) {
      return NextResponse.json(
        { error: 'Transaction key is required' },
        { status: 400 }
      );
    }

    console.log('Listing files for transaction:', transactionKey);

    const drive = getDriveClient();
    
    // 构建查询条件
    let query = `name contains '${transactionKey}_'`;
    
    // 如果指定了文件夹，限制在该文件夹内搜索
    if (folderId) {
      query += ` and '${folderId}' in parents`;
    }

    console.log('Search query:', query);

    // 搜索文件
    const response = await drive.files.list({
      q: query,
      fields: 'files(id,name,createdTime,size,mimeType,webViewLink,webContentLink)',
      orderBy: 'createdTime desc',
    });

    const files = response.data.files || [];
    
    console.log(`Found ${files.length} files for transaction ${transactionKey}`);

    // 转换文件格式为收据格式
    const receipts = files.map(file => ({
      receiptKey: file.id || '',
      transactionKey: transactionKey,
      fileName: file.name || '',
      fileUrl: file.webViewLink || `https://drive.google.com/uc?export=view&id=${file.id}`,
      fileId: file.id || '',
      downloadUrl: file.webContentLink || `https://drive.google.com/uc?export=download&id=${file.id}`,
      uploadBy: 'System', // 从文件名中提取或使用默认值
      description: '', // 可以从文件名中提取或使用默认值
      uploadDate: file.createdTime || new Date().toISOString(),
    }));

    return NextResponse.json({ receipts });

  } catch (error) {
    console.error('Error listing files from Google Drive:', error);
    return NextResponse.json(
      { 
        error: 'Failed to list files from Google Drive',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 