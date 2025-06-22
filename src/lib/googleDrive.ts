import { google } from 'googleapis';
import { Readable } from 'stream';

// 初始化 Google Drive API (使用专门的服务账号)
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

// 上传文件到Google Drive
export const uploadFileToDrive = async (
  fileName: string,
  fileContent: Buffer,
  mimeType: string,
  folderId?: string
): Promise<{ fileId: string; webViewLink: string; webContentLink: string }> => {
  try {
    const drive = getDriveClient();
    
    // 准备文件元数据
    const fileMetadata: any = {
      name: fileName,
      mimeType: mimeType,
    };

    // 如果指定了文件夹，将文件放入该文件夹
    if (folderId) {
      fileMetadata.parents = [folderId];
    }

    // 用Readable.from包装Buffer
    const media = {
      mimeType: mimeType,
      body: Readable.from(fileContent),
    };

    console.log('Uploading file to Google Drive:', {
      fileName,
      mimeType,
      fileSize: fileContent.length,
      folderId: folderId || 'root'
    });

    // 上传文件
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id,webViewLink,webContentLink,name',
    });

    const fileId = response.data.id;
    const webViewLink = response.data.webViewLink;
    const webContentLink = response.data.webContentLink;

    if (!fileId) {
      throw new Error('Failed to get file ID from Google Drive');
    }

    console.log('File uploaded successfully:', {
      fileId,
      fileName: response.data.name,
      webViewLink,
      webContentLink
    });

    // 设置文件权限为任何人都可以查看（用于生成公开链接）
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    // 获取公开的下载链接
    const publicLink = `https://drive.google.com/uc?export=view&id=${fileId}`;
    const downloadLink = `https://drive.google.com/uc?export=download&id=${fileId}`;

    return {
      fileId,
      webViewLink: publicLink,
      webContentLink: downloadLink,
    };
  } catch (error) {
    console.error('Error uploading file to Google Drive:', error);
    throw new Error(`Failed to upload file to Google Drive: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// 删除Google Drive中的文件
export const deleteFileFromDrive = async (fileId: string): Promise<void> => {
  try {
    const drive = getDriveClient();
    
    console.log('Deleting file from Google Drive:', fileId);
    
    await drive.files.delete({
      fileId: fileId,
    });

    console.log('File deleted successfully:', fileId);
  } catch (error) {
    console.error('Error deleting file from Google Drive:', error);
    throw new Error(`Failed to delete file from Google Drive: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// 从文件URL中提取文件ID
export const extractFileIdFromUrl = (url: string): string | null => {
  try {
    // 处理Google Drive分享链接
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      return match[1];
    }
    
    // 处理其他格式的链接
    const ucMatch = url.match(/id=([a-zA-Z0-9-_]+)/);
    if (ucMatch) {
      return ucMatch[1];
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting file ID from URL:', error);
    return null;
  }
};

// 验证文件是否存在于Google Drive
export const checkFileExists = async (fileId: string): Promise<boolean> => {
  try {
    const drive = getDriveClient();
    
    const response = await drive.files.get({
      fileId: fileId,
      fields: 'id',
    });
    
    return !!response.data.id;
  } catch (error) {
    console.error('Error checking file existence:', error);
    return false;
  }
}; 