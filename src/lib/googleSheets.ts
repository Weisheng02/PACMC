import { google } from 'googleapis';

// 财务记录接口 - 匹配实际的 Google Sheet 结构
export interface FinancialRecord {
  key: string;
  account: string;
  date: string;
  type: 'Income' | 'Expense';
  who: string;
  amount: number;
  description: string;
  status: 'Approved' | 'Pending';
  takePut: boolean;
  remark: string;
  createdDate: string;
  createdBy: string;
  approvedDate: string;
  approvedBy: string;
  lastUserUpdate: string;
  lastDateUpdate: string;
}

// Google Sheets API 配置
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// 初始化 Google Sheets API
const getAuthClient = () => {
  // 注意：在生产环境中，应该使用服务账号或 OAuth2
  // 这里为了演示，我们将在 API 路由中处理认证
  return null;
};

// 从环境变量获取 Google Sheets ID
const getSpreadsheetId = () => {
  return process.env.GOOGLE_SHEET_ID || '';
};

// 获取工作表名称
const getSheetName = () => {
  return process.env.GOOGLE_SHEET_NAME || 'Sheet1';
};

// 读取所有财务记录
export const readFinancialRecords = async (): Promise<FinancialRecord[]> => {
  try {
    const response = await fetch('/api/sheets/read');
    if (!response.ok) {
      throw new Error('Failed to read financial records');
    }
    const data = await response.json();
    return data.records;
  } catch (error) {
    console.error('Error reading financial records:', error);
    throw error;
  }
};

// 添加新的财务记录
export const addFinancialRecord = async (record: Omit<FinancialRecord, 'key' | 'createdDate' | 'createdBy' | 'approvedDate' | 'approvedBy' | 'lastUserUpdate' | 'lastDateUpdate'>): Promise<FinancialRecord> => {
  try {
    const response = await fetch('/api/sheets/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(record),
    });
    
    if (!response.ok) {
      throw new Error('Failed to add financial record');
    }
    
    const data = await response.json();
    return data.record;
  } catch (error) {
    console.error('Error adding financial record:', error);
    throw error;
  }
};

// 更新财务记录
export const updateFinancialRecord = async (key: string, record: Partial<FinancialRecord>): Promise<FinancialRecord> => {
  try {
    const response = await fetch(`/api/sheets/update/${key}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(record),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update financial record');
    }
    
    const data = await response.json();
    return data.record;
  } catch (error) {
    console.error('Error updating financial record:', error);
    throw error;
  }
};

// 删除财务记录
export const deleteFinancialRecord = async (key: string): Promise<void> => {
  try {
    const response = await fetch(`/api/sheets/delete/${key}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete financial record');
    }
  } catch (error) {
    console.error('Error deleting financial record:', error);
    throw error;
  }
};

// 获取统计数据
export const getFinancialStats = async () => {
  try {
    const response = await fetch('/api/sheets/stats');
    if (!response.ok) {
      throw new Error('Failed to get financial stats');
    }
    const data = await response.json();
    return data.stats;
  } catch (error) {
    console.error('Error getting financial stats:', error);
    throw error;
  }
};

// 导出数据
export const exportFinancialData = async (format: 'excel' | 'pdf') => {
  try {
    const response = await fetch(`/api/sheets/export?format=${format}`);
    if (!response.ok) {
      throw new Error('Failed to export financial data');
    }
    
    if (format === 'excel') {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `financial-report-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `financial-report-${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('Error exporting financial data:', error);
    throw error;
  }
}; 