import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// 初始化 Google Sheets API
const getSheetsClient = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
};

// 获取工作表信息
const getSheetInfo = async (sheets: any, spreadsheetId: string, sheetName: string) => {
  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
    });
    
    const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === sheetName);
    return sheet?.properties;
  } catch (error) {
    console.error('Error getting sheet info:', error);
    return null;
  }
};

// 查找财务数据工作表
const findTransactionSheet = async (sheets: any, spreadsheetId: string) => {
  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
    });
    
    const sheetsList = spreadsheet.data.sheets;
    if (!sheetsList) return null;

    const possibleNames = ['Transaction', 'Transactions', 'Financial', 'Finance', 'Sheet1'];
    
    for (const name of possibleNames) {
      const foundSheet = sheetsList.find(s => s.properties?.title === name);
      if (foundSheet) {
        return foundSheet.properties;
      }
    }
    
    // 如果没找到，返回第一个工作表
    return sheetsList[0]?.properties || null;
  } catch (error) {
    console.error('Error finding transaction sheet:', error);
    return null;
  }
};

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const sheets = getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Google Sheet ID not configured' },
        { status: 500 }
      );
    }

    const targetSheetInfo = await findTransactionSheet(sheets, spreadsheetId);

    if (!targetSheetInfo || !targetSheetInfo.title || targetSheetInfo.sheetId === undefined) {
      return NextResponse.json({ error: 'No suitable worksheet found' }, { status: 500 });
    }

    console.log(`Using sheet for deletion: ${targetSheetInfo.title} (ID: ${targetSheetInfo.sheetId})`);
    
    // 读取所有数据来找到要删除的行
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${targetSheetInfo.title}!A:P`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: 'No data found' },
        { status: 404 }
      );
    }

    // 找到要删除的行的索引（跳过标题行）
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === key) {
        rowIndex = i + 1; // Google Sheets 行号从 1 开始
        break;
      }
    }

    if (rowIndex === -1) {
      return NextResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      );
    }

    // 使用正确的 sheetId 删除找到的行
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: targetSheetInfo.sheetId, // 使用动态获取的 sheetId
                dimension: 'ROWS',
                startIndex: rowIndex - 1, // 从 0 开始
                endIndex: rowIndex, // 删除一行
              },
            },
          },
        ],
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Record deleted successfully',
      deletedKey: key 
    });
  } catch (error) {
    console.error('Error deleting record:', error);
    return NextResponse.json(
      { error: 'Failed to delete record', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 