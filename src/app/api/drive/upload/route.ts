import { NextRequest, NextResponse } from 'next/server';
import { uploadFileToDrive } from '@/lib/googleDrive';

export async function POST(request: NextRequest) {
  try {
    console.log('Google Drive upload API called');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const description = formData.get('description') as string;
    const transactionKey = formData.get('transactionKey') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!transactionKey) {
      return NextResponse.json(
        { error: 'No transaction key provided' },
        { status: 400 }
      );
    }

    console.log('Processing file:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // 检查文件大小（10MB限制）
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the maximum limit of 10MB` },
        { status: 400 }
      );
    }

    // 检查文件类型
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // 将文件转换为Buffer - 修复流处理问题
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 生成唯一的文件名 - 支持多个receipt
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const randomSuffix = Math.random().toString(36).substr(2, 6);
    const fileName = `${transactionKey}_${timestamp}_${randomSuffix}_${file.name}`;

    // 获取Google Drive文件夹ID（如果配置了）
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    console.log('Uploading to Google Drive:', {
      fileName,
      mimeType: file.type,
      folderId: folderId || 'root',
      fileSize: buffer.length
    });

    // 上传到Google Drive
    const uploadResult = await uploadFileToDrive(
      fileName,
      buffer,
      file.type,
      folderId
    );

    console.log('Google Drive upload successful:', uploadResult);

    // 返回上传结果
    return NextResponse.json({
      success: true,
      fileId: uploadResult.fileId,
      fileName: fileName,
      originalName: file.name,
      fileUrl: uploadResult.webViewLink,
      downloadUrl: uploadResult.webContentLink,
      fileSize: file.size,
      mimeType: file.type,
      description: description || '',
      message: 'File uploaded to Google Drive successfully'
    });

  } catch (error) {
    console.error('Error in Google Drive upload API:', error);
    return NextResponse.json(
      { 
        error: 'Failed to upload file to Google Drive',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 