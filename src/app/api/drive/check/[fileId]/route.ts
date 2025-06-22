import { NextRequest, NextResponse } from 'next/server';
import { checkFileExists } from '@/lib/googleDrive';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;
    
    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      );
    }

    console.log('Checking file existence in Google Drive:', fileId);

    // 检查文件是否存在于Google Drive
    const exists = await checkFileExists(fileId);

    if (exists) {
      return NextResponse.json({
        exists: true,
        message: 'File exists in Google Drive'
      });
    } else {
      return NextResponse.json(
        { 
          exists: false,
          message: 'File not found in Google Drive'
        },
        { status: 404 }
      );
    }

  } catch (error) {
    console.error('Error checking file existence:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check file existence',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 