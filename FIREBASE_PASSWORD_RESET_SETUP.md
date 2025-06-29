# Firebase 密码重置功能配置指南

## 🔧 问题诊断

如果忘记密码功能无法正常工作，请按以下步骤检查和配置：

## 1. Firebase 控制台配置

### 1.1 启用 Email/Password 认证
1. 登录 [Firebase Console](https://console.firebase.google.com/)
2. 选择你的项目
3. 进入 **Authentication** > **Sign-in method**
4. 确保 **Email/Password** 已启用
5. 点击 **Email/Password** 进行配置

### 1.2 配置密码重置模板
1. 在 **Authentication** > **Templates** 中
2. 选择 **Password reset** 模板
3. 自定义邮件内容（可选）：
   ```
   主题: Reset your PACMC Money password
   
   内容:
   Hello,
   
   You requested to reset your password for PACMC Money.
   
   Click the link below to reset your password:
   {{link}}
   
   If you didn't request this, please ignore this email.
   
   Best regards,
   PACMC Money Team
   ```

### 1.3 配置授权域名
1. 在 **Authentication** > **Settings** > **Authorized domains**
2. 添加你的域名：
   - `localhost` (开发环境)
   - `your-domain.com` (生产环境)
   - `your-app.vercel.app` (如果使用Vercel)

## 2. 环境变量检查

确保 `.env.local` 文件包含正确的Firebase配置：

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## 3. 测试步骤

### 3.1 测试忘记密码功能
1. 访问应用主页
2. 点击 "Forgot password?"
3. 输入有效的邮箱地址
4. 点击 "Send Reset Link"
5. 检查控制台是否有错误信息

### 3.2 检查邮件发送
1. 检查邮箱收件箱
2. 检查垃圾邮件文件夹
3. 查看Firebase控制台的 **Authentication** > **Users** 中的用户状态

### 3.3 测试重置链接
1. 点击邮件中的重置链接
2. 应该跳转到 `/reset-password?oobCode=xxx`
3. 输入新密码并确认

## 4. 常见问题解决

### 4.1 错误: "auth/operation-not-allowed"
**解决方案**: 在Firebase控制台启用Email/Password认证

### 4.2 错误: "auth/user-not-found"
**解决方案**: 确保邮箱地址正确，且用户已注册

### 4.3 错误: "auth/invalid-email"
**解决方案**: 检查邮箱格式是否正确

### 4.4 错误: "auth/too-many-requests"
**解决方案**: 等待一段时间后再试，或检查是否有恶意请求

### 4.5 邮件没有收到
**解决方案**:
1. 检查垃圾邮件文件夹
2. 确认Firebase邮件模板配置正确
3. 检查域名授权设置

## 5. 调试信息

### 5.1 浏览器控制台
打开浏览器开发者工具，查看Console标签页的错误信息：

```javascript
// 应该看到类似这样的日志
Attempting to send password reset email to: user@example.com
Password reset email sent successfully to: user@example.com
```

### 5.2 Firebase控制台
1. 进入 **Authentication** > **Users**
2. 查看用户状态和最后登录时间
3. 检查是否有密码重置记录

## 6. 高级配置

### 6.1 自定义重置邮件模板
在Firebase控制台 **Authentication** > **Templates** 中自定义：

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Reset Your Password</title>
</head>
<body>
    <h2>Reset Your PACMC Money Password</h2>
    <p>Hello,</p>
    <p>You requested to reset your password for PACMC Money.</p>
    <p>Click the button below to reset your password:</p>
    <a href="{{link}}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        Reset Password
    </a>
    <p>If you didn't request this, please ignore this email.</p>
    <p>Best regards,<br>PACMC Money Team</p>
</body>
</html>
```

### 6.2 自定义重置URL
在发送密码重置邮件时，可以指定自定义URL：

```javascript
await sendPasswordResetEmail(auth, email, {
  url: `${window.location.origin}/reset-password`,
  handleCodeInApp: false,
});
```

## 7. 安全建议

### 7.1 限制重置频率
在Firebase控制台设置密码重置限制：
1. **Authentication** > **Settings** > **Security**
2. 配置密码重置频率限制

### 7.2 监控异常活动
1. 定期检查 **Authentication** > **Users** 中的异常登录
2. 监控密码重置请求频率
3. 设置邮件通知异常活动

## 8. 联系支持

如果问题仍然存在，请提供以下信息：

1. Firebase项目ID
2. 错误信息截图
3. 浏览器控制台日志
4. 环境变量配置（隐藏敏感信息）
5. 重现步骤

## 9. 测试账户

为了测试功能，建议创建一个测试账户：

```javascript
// 测试邮箱
test@pacmc-money.com

// 测试密码
TestPassword123
```

---

**注意**: 确保在生产环境中使用真实的邮箱地址进行测试，并遵循安全最佳实践。 