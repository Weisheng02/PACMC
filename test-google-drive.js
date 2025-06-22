// 测试Google Drive配置
const fs = require('fs');
const path = require('path');

// 读取.env.local文件
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        if (value && !key.startsWith('#')) {
          envVars[key.trim()] = value.replace(/^["']|["']$/g, '');
        }
      }
    });
    
    return envVars;
  }
  return {};
}

const envVars = loadEnvFile();

console.log('=== Google Drive Configuration Test ===');

// 检查环境变量
const requiredEnvVars = [
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_PRIVATE_KEY',
  'GOOGLE_SHEET_ID'
];

console.log('\n1. Google Sheets Environment Variables Check:');
requiredEnvVars.forEach(varName => {
  const value = envVars[varName];
  if (value) {
    console.log(`✅ ${varName}: ${varName.includes('KEY') ? '***SET***' : value}`);
  } else {
    console.log(`❌ ${varName}: NOT SET`);
  }
});

// 检查Google Drive环境变量
const driveEnvVars = [
  'GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_DRIVE_PRIVATE_KEY',
  'GOOGLE_DRIVE_FOLDER_ID'
];

console.log('\n2. Google Drive Environment Variables Check:');
driveEnvVars.forEach(varName => {
  const value = envVars[varName];
  if (value) {
    console.log(`✅ ${varName}: ${varName.includes('KEY') ? '***SET***' : value}`);
  } else {
    console.log(`⚠️  ${varName}: NOT SET (will fallback to Sheets account)`);
  }
});

// 测试Google Auth
console.log('\n3. Testing Google Drive Auth...');
try {
  const { google } = require('googleapis');
  
  // 使用Drive专用账号，如果没有则回退到Sheets账号
  const driveEmail = envVars.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL || envVars.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const driveKey = envVars.GOOGLE_DRIVE_PRIVATE_KEY || envVars.GOOGLE_PRIVATE_KEY;
  
  console.log(`Using Drive account: ${driveEmail}`);
  
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: driveEmail,
      private_key: driveKey?.replace(/\\n/g, '\n'),
    },
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/spreadsheets'
    ],
  });

  console.log('✅ Google Drive Auth configured successfully');
  
  // 测试Drive API
  const drive = google.drive({ version: 'v3', auth });
  console.log('✅ Google Drive API client created');
  
  // 测试Sheets API (使用原账号)
  const sheetsAuth = new google.auth.GoogleAuth({
    credentials: {
      client_email: envVars.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: envVars.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  
  const sheets = google.sheets({ version: 'v4', auth: sheetsAuth });
  console.log('✅ Google Sheets API client created');
  
} catch (error) {
  console.error('❌ Google Auth test failed:', error.message);
}

console.log('\n=== Test Complete ==='); 