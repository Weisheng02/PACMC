# PACMC 青少年团契财务管理系统

一个专为教会青少年团契设计的财务管理网站，支持 Google 登录、权限控制和财务数据管理。

## 🚀 功能特色

### 🔐 用户认证与权限管理
- **Google 登录**：使用 Firebase Authentication 进行安全的 Google 登录
- **三级权限系统**：
  - **财政成员**：可以新增、编辑财务记录，管理用户权限
  - **核心团队**：可以查看财务记录，导出报表
  - **高层顾问/牧者**：只能查看图表和报表

### 📊 财务管理功能
- **财务列表**：查看所有收入和支出记录
- **图表分析**：每月收支趋势图、分类支出比例图
- **数据录入**：财政成员可通过表单添加新记录
- **报表导出**：支持 PDF 和 Excel 格式导出

### 🎨 现代化界面
- 响应式设计，支持手机和电脑
- 直观的权限控制界面
- 美观的图表和统计展示

## 🛠️ 技术栈

- **前端**：Next.js 15 + React + TypeScript
- **样式**：Tailwind CSS
- **认证**：Firebase Authentication
- **数据库**：Firestore（用户权限）+ Google Sheets API（财务数据）
- **图表**：Recharts
- **图标**：Lucide React

## 📦 安装与运行

### 1. 克隆项目
```bash
git clone <repository-url>
cd pacmc-money
```

### 2. 安装依赖
```bash
npm install
```

### 3. 配置 Firebase
确保您已经：
- 创建了 Firebase 项目
- 启用了 Google 登录
- 配置了 Firestore 数据库

### 4. 配置 Google Sheets API

#### 4.1 创建 Google Cloud 项目
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 Google Sheets API

#### 4.2 创建服务账号
1. 在 Google Cloud Console 中，转到"IAM 和管理" → "服务账号"
2. 点击"创建服务账号"
3. 填写服务账号名称和描述
4. 创建并下载 JSON 密钥文件

#### 4.3 配置 Google Sheet
1. 打开您的 Google Sheet
2. 点击"共享"按钮
3. 添加服务账号邮箱（格式：`service-account@project.iam.gserviceaccount.com`）
4. 给予"编辑"权限

#### 4.4 设置环境变量
1. 复制 `env.example` 为 `.env.local`
2. 填入以下信息：
```env
GOOGLE_SHEET_ID=your_google_sheet_id_here
GOOGLE_SHEET_NAME=Sheet1
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
```

### 5. 启动开发服务器
```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

## 🔧 配置说明

### Firebase 配置
项目使用 Firebase 进行用户认证和权限管理。配置信息位于 `src/lib/firebase.ts`。

### Google Sheets 数据结构
系统期望的 Google Sheet 结构：
- **A 列**：记录 ID
- **B 列**：日期
- **C 列**：类型（income/expense）
- **D 列**：类别
- **E 列**：描述
- **F 列**：金额
- **G 列**：记录人
- **H 列**：创建时间

### 用户权限管理
- 新用户首次登录时默认获得"核心团队"权限
- 财政成员可以通过用户管理功能修改其他用户的权限
- 权限信息存储在 Firestore 的 `users` 集合中

## 📱 使用指南

### 首次使用
1. 访问网站首页
2. 点击"使用 Google 登录"
3. 选择您的 Google 账号
4. 系统会自动创建用户档案（默认权限：核心团队）

### 权限升级
如需升级权限，请联系财政成员在用户管理页面进行设置。

### 功能访问
- **财务列表**：核心团队及以上可查看
- **图表分析**：所有用户可访问
- **新增记录**：仅财政成员可操作
- **用户管理**：仅财政成员可操作
- **报表导出**：核心团队及以上可操作

## 🚀 部署

### Vercel 部署（推荐）
1. 将代码推送到 GitHub
2. 在 Vercel 中导入项目
3. 配置环境变量（Firebase 配置 + Google Sheets API 配置）
4. 部署完成

### 其他平台
项目基于 Next.js，可以部署到任何支持 Node.js 的平台。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目。

## 📄 许可证

MIT License

---

**开发中功能**：
- [x] Google Sheets API 集成
- [x] 财务数据录入表单
- [ ] 图表分析页面
- [ ] 报表导出功能
- [ ] 用户管理界面
# PACMC
