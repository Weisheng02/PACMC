import { NextRequest, NextResponse } from 'next/server';
import { deleteFileFromDrive } from '@/lib/googleDrive';

export async function DELETE(
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

    console.log('Deleting file from Google Drive:', fileId);

    // 从Google Drive删除文件
    await deleteFileFromDrive(fileId);

    console.log('File deleted successfully from Google Drive');
    
    return NextResponse.json({
      success: true,
      message: 'File deleted from Google Drive successfully'
    });

  } catch (error) {
    console.error('Error deleting file from Google Drive:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete file from Google Drive',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 