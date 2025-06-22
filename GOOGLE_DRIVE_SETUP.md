# Google Drive 配置指南

## 概述
本指南将帮助你配置Google Drive API，用于存储和预览收据图片。

## 步骤

### 1. 启用Google Drive API

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 选择你的项目（pacmc-money-website）
3. 在左侧菜单中，点击"API和服务" → "库"
4. 搜索"Google Drive API"
5. 点击"Google Drive API"，然后点击"启用"

### 2. 配置服务账号权限

你的服务账号已经创建，现在需要确保它有Google Drive的访问权限：

1. 在Google Cloud Console中，进入"API和服务" → "凭据"
2. 找到你的服务账号：`firebase-adminsdk-fbsvc@pacmc-money-website.iam.gserviceaccount.com`
3. 点击服务账号邮箱
4. 在"权限"标签页中，确保有以下角色：
   - Google Drive API 用户
   - 服务账号用户

### 3. 创建Google Drive文件夹（可选）

1. 访问 [Google Drive](https://drive.google.com/)
2. 创建一个新文件夹，命名为"PACMC Receipts"或其他你喜欢的名称
3. 右键点击文件夹，选择"获取链接"
4. 复制文件夹ID（在URL中的/d/后面，/view前面）

### 4. 配置环境变量

在你的`.env.local`文件中添加以下配置：

```env
# 现有的Google Sheets配置
GOOGLE_SERVICE_ACCOUNT_EMAIL=firebase-adminsdk-fbsvc@pacmc-money-website.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDCdMKZPmMbbW3y\nxpSHc8aex0Nbl4ZCqn1TRqhx8SzRVvAiKZAT3tPMqzv4qxGGY9qoopEC1WvwHlx0\n3v+vFyAf4YbKMcvRJ+8TS8W0PY96yDqkOb2ogvvF1Mwt4h+cOC2DmLmEuUABSO0c\n1VIXcze7MYijv4668TlfUNUGo41mUa4nZuMcb/K6FziNAbnD/yr/04OW6DALXPd/\nM31MRf/9vwhXIma67KjFIv2XyO6fNV4h7T1B06eBDIz0JW8i34TmvFJLSsmjPElE\nHskTVtwzmqy1fsE0B9VGZ+VXHdzd7ZgrfA+c17UUCVBvnGc7m8/B1rbgI4XmZ/1h\n6QnC7LIbAgMBAAECggEACaeuedllJll6mhFOEqOm+v890vBlFC5O5rGdb3rgFMzS\nQ3/4zWPE9GaUJbaouhl/I9xegtuB7nwzbwIbg+AMEkkqXiO20P3Amx6qBFcCJsCG\nWN0dE57dTWdRc/3EQAdyCxSsMXDZQrcSPtpApzVrUPoWpLrAJXwQszDaQugf/zJ8\n4LR/gvNV+koVH83uOVYXn+ykiRCXwQ4DoLgdiX1sXApBBqt76YqZa8oj7IzIR/8r\n+Ui7CY/TIWELueyEWwdWSibNL9abERIfu7fnUS9alXx38XkQlMGSpXKdYmghFpFZ\nxMbISWpqUtQPhUTqxnDQ2uVRAs+8MOx5Q6Ggd68RcQKBgQDh6L9YH3rwUEedTzGB\ntmNqMCIAIBtf0+iA8peogDOms7825qBCKrnXQC2M7LCBwFO6gICfPGYqG1nxZ1/r\n7g7GmZ6tSDlWjcItkTmWQS52uGDUO+LyUHSo/bIltcDgluKTwTwgTBFd//gtH0D2\nQecWvqALDHhjJbbnOtUWg9YKtwKBgQDcW39nKCkEfQCWNx80LV3/ly+Cs0n+0YOD\ntWGX745ZLIcNAB/Bq4lISLruLNlsBcnh5zre+0owrPYFhiTXa+kHMS4Pe+zf1aie\ndvm6rmNC9O2UCN7VMmR9FDcFQPL5jD1/myQASw4cIjKf+9QfDJ6XrZq/9PeGxayq\nhUHjGBp/vQKBgEZ9Gh9EC1cqpX3XNQpVP6XliOZjHkeDVnvNtjaUcglk8pgN1Blx\nPXWFh/D99YE24qlB6WBGN1aSHDlv2QVDzYZ4boOBEqsIJnuTYdWZVwciNsxiN0kG\ng7ArIMgVcy5gxif2Vm15br3W3bgulVWBcLqvFj78UCAXp3904wJYdpP3AoGBAJ+R\n2oZ2/Iz1gFFHBV+hYqpNbug0sObIDXZ5CH0fynMk3X86kcSLVVR05njHHYMuBe2C\npo0GZ8kr1tRVOaSNzieZI4Ou9+93Jy3pdhoLYnIAL3K9oa+9WCuDUfyJ9elj9rzL\nOZzEvSj+Uq6rjAYX+1hXLPLIj96WktzAtt+eesH5AoGAZDMBJRWo8dP7YiUgyRG6\n8VALG+pIZ2KPtcOgjA9Yj71xlzu52rXACTIlu+pgPxzllLL4LnSt/TE7z25X1lg8\nKt+XKxjYe9CfU8xtt54LEjfEe0dG1Gzs/fiUo3MBv+61SXl5hUCsru9ncnPkHfE8\na64Dk7iSBgv6aE8xtm2KZsc=\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=你的Google Sheets ID

# Google Drive配置（可选）
GOOGLE_DRIVE_FOLDER_ID=你的Google Drive文件夹ID
```

### 5. 测试配置

1. 重启开发服务器：
   ```bash
   npm run dev
   ```

2. 访问应用并尝试上传一张收据图片
3. 检查图片是否成功上传到Google Drive
4. 验证图片是否可以在应用中预览

## 功能特性

### 上传功能
- 支持图片格式：JPG, JPEG, PNG, GIF, WebP
- 支持PDF文档
- 文件大小限制：10MB
- 自动生成唯一文件名

### 预览功能
- 图片可以直接在应用中预览
- 支持缩放、旋转、重置
- 支持下载原文件
- 模态框显示，用户体验良好

### 存储方式
- 图片存储在Google Drive中
- Google Sheets只存储文件链接和元数据
- 无文件大小限制（除了Google Drive本身的限制）

## 故障排除

### 常见问题

1. **"Google Drive API not enabled"**
   - 确保已在Google Cloud Console中启用Google Drive API

2. **"Permission denied"**
   - 检查服务账号是否有Google Drive访问权限
   - 确保文件夹权限设置正确

3. **"File upload failed"**
   - 检查网络连接
   - 验证环境变量配置
   - 查看浏览器控制台错误信息

### 调试步骤

1. 打开浏览器开发者工具
2. 查看Console标签页的日志信息
3. 检查Network标签页的API请求
4. 查看服务器日志

## 安全注意事项

- 服务账号凭据应保密，不要提交到版本控制系统
- 定期轮换服务账号密钥
- 监控API使用量，避免超出配额
- 考虑设置文件夹访问权限限制 