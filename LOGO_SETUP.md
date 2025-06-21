# Logo 设置说明

## 如何更换你的logo

### 方法1：使用本地图片（推荐）

1. **准备你的logo图片**
   - 支持的格式：JPG, PNG, SVG
   - 建议尺寸：至少 32x32 像素（显示为 32x32）
   - 建议使用正方形图片以获得最佳效果

2. **放置图片**
   ```bash
   # 将你的logo图片复制到public文件夹
   cp 你的logo图片.jpg public/logo.jpg
   ```

3. **重命名图片**
   - 将图片重命名为 `logo.jpg`（或 `logo.png`）
   - 确保图片在 `public` 文件夹中

### 方法2：使用在线图片URL

如果你有图片的在线链接，可以修改代码中的路径：

```tsx
<img
  src="你的在线图片URL"
  alt="PACMC Logo"
  className="h-8 w-8 rounded-full mr-3 object-cover"
/>
```

### 当前设置

- **图片路径**: `/logo.jpg`
- **显示尺寸**: 32x32 像素
- **样式**: 圆形，带圆角
- **位置**: 所有页面的左上角

### 已更新的页面

- ✅ 主页 (`src/app/page.tsx`)
- ✅ 财务记录页面 (`src/app/financial-list/page.tsx`)

### 注意事项

- 确保图片文件存在，否则会显示破损图片图标
- 建议使用高质量的图片以获得清晰显示效果
- 图片会自动适应圆形显示

## 完成设置后

设置完成后，你的logo将显示在所有页面的左上角，点击可以返回主页。 