import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import * as admin from 'firebase-admin';
import nodemailer from 'nodemailer';

// Initialize Firebase Admin if not already
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

// 初始化 Google Sheets API
const getSheetsClient = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth: auth as any });
};

// 获取工作表名称
const getSheetNames = async (sheets: any, spreadsheetId: string) => {
  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
    });
    
    const sheetsList = spreadsheet.data.sheets;
    const sheetNames = sheetsList?.map((s: any) => s.properties?.title) || [];
    return sheetNames;
  } catch (error) {
    console.error('Error getting sheet names:', error);
    return [];
  }
};

// 查找财务数据工作表
const findTransactionSheet = (sheetNames: string[]) => {
  const possibleNames = ['Transaction', 'Transactions', 'Financial', 'Finance', 'Sheet1'];
  
  for (const name of possibleNames) {
    if (sheetNames.includes(name)) {
      return name;
    }
  }
  
  return sheetNames[0] || null;
};

export async function POST(request: NextRequest) {
  return handleStatusUpdate(request);
}

export async function PUT(request: NextRequest) {
  return handleStatusUpdate(request);
}

async function handleStatusUpdate(request: NextRequest) {
  try {
    const { key, status, approvedBy } = await request.json();
    
    if (!key || !status) {
      return NextResponse.json({ error: 'Missing key or status' }, { status: 400 });
    }

    if (!['Approved', 'Pending'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    const sheets = getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Google Sheet ID not configured' }, { status: 500 });
    }

    const sheetNames = await getSheetNames(sheets, spreadsheetId);
    const targetSheet = findTransactionSheet(sheetNames);

    if (!targetSheet) {
      return NextResponse.json({ error: 'No suitable worksheet found' }, { status: 500 });
    }
    
    console.log('Using sheet for status update:', targetSheet);

    // 读取所有数据来找到要更新的行
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${targetSheet}!A:P`,
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'No data found' }, { status: 404 });
    }

    // 找到要更新的行的索引（跳过标题行）
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === key) {
        rowIndex = i + 1; // Google Sheets 行号从 1 开始
        break;
      }
    }
    
    if (rowIndex === -1) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // 更新状态列（第8列，H列）
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${targetSheet}!H${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[status]],
      },
    });

    // 如果状态改为已审核，更新审核信息
    if (status === 'Approved') {
      const now = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });

      // 分别更新审核日期和审核人
      // 审核日期（第13列，M列）
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${targetSheet}!M${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[now]],
        },
      });

      // 审核人（第14列，N列）
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${targetSheet}!N${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[approvedBy || 'System']],
        },
      });

      // ====== 新增：查找created by用户并发邮件 ======
      try {
        const createdByName = rows[rowIndex-1][11]; // L列
        if (createdByName) {
          const usersRef = admin.firestore().collection('users');
          const userSnap = await usersRef.where('name', '==', createdByName).limit(1).get();
          if (!userSnap.empty) {
            const userData = userSnap.docs[0].data();
            const userEmail = userData.email;
            // 邮件内容
            const mailSubject = 'Your Financial Record Has Been Approved';
            const mailBody = `Dear ${createdByName},\n\nWe are pleased to inform you that your financial record has been approved.\n\nDetails:\n- Type: ${rows[rowIndex-1][3]}\n- Amount: RM${rows[rowIndex-1][5]}\n- Description: ${rows[rowIndex-1][6]}\n- Date: ${rows[rowIndex-1][2]}\n- Approved By: ${approvedBy || 'System'}\n- Approved At: ${now}\n\nIf you have any questions, please contact the finance team.\n\nBest regards,\nPACMC Finance System`;
            // 这里用nodemailer发送邮件（可先console.log）
            console.log('[EMAIL APPROVAL]', { to: userEmail, subject: mailSubject, text: mailBody });
            // // 示例：实际发邮件（需配置SMTP）
            // const transporter = nodemailer.createTransport({
            //   host: process.env.SMTP_HOST,
            //   port: Number(process.env.SMTP_PORT),
            //   secure: false,
            //   auth: {
            //     user: process.env.SMTP_USER,
            //     pass: process.env.SMTP_PASS,
            //   },
            // });
            // await transporter.sendMail({
            //   from: 'noreply@pacmc-money.com',
            //   to: userEmail,
            //   subject: mailSubject,
            //   text: mailBody,
            // });
          }
        }
      } catch (mailErr) {
        console.error('Failed to send approval email:', mailErr);
      }
      // ====== END ======
    }

    // 写入详细操作日志
    try {
      const oldStatus = rows[rowIndex-1][7];
      const newStatus = status;
      if (oldStatus !== newStatus) {
        const detail = `Account: ${rows[rowIndex-1][1]}, Date: ${rows[rowIndex-1][2]}, Type: ${rows[rowIndex-1][3]}, Who: ${rows[rowIndex-1][4]}, Amount: ${rows[rowIndex-1][5]}, Description: ${rows[rowIndex-1][6]}, Status: ${newStatus}, Remark: ${rows[rowIndex-1][9]}`;
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `audit_log!A:I`,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: [[
              new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              approvedBy || 'System',
              'Update Status',
              key,
              'Status',
              oldStatus,
              newStatus,
              detail,
              '1' // status字段设为1（活跃状态）
            ]],
          },
        });
      }
    } catch (logErr) {
      console.error('Failed to write audit log', logErr);
    }

    return NextResponse.json({ 
      success: true, 
      message: `记录状态已更新为: ${status === 'Approved' ? '已审核' : '待审核'}`,
      status 
    });
  } catch (error) {
    console.error('Error updating record status:', error);
    return NextResponse.json({ 
      error: 'Failed to update record status', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 