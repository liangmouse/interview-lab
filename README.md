# Interview Lab

> 🚧 **项目正在开发中** 🚧

一个专为中文互联网技术岗求职者打造的 AI 面试官智能体应用，致力于提供舒适、专业且高效的面试体验。

## 应用特点

### 功能亮点

- 📄 支持导入求职者简历，AI 可针对简历内容智能提问
- 🎙️ 综合面试使用豆包端到端实时语音大模型，浏览器通过本地 gateway 转发音频
- 📝 提供练习与测试两种模式：
  - 练习模式：AI 针对八股/算法题，用户作答后给出标准答案
  - 测试模式：AI 计分，数字人面试官有表情变化，面试结束给出 0-100 分成绩
- 💾 自动保存每一次面试记录，并对面试对话进行评估
- ⏰ 支持算法题/手撕代码题，限时作答并可运行代码

### 技术栈

- **Supabase**：数据库与认证
- **Tailwindcss + shadcn-ui**：前端 UI
- **Next.js + TypeScript**：全栈开发
- **Node.js Gateway + WebSocket**：代理浏览器与火山实时语音服务
- **Vercel**：部署
- **CodeMirror**：代码编辑器

## 开发指南

### 快速开始

```bash
# 1. 克隆项目
git clone https://github.com/your-username/Young-Interview-Expert.git
cd Young-Interview-Expert

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入你的 Supabase 配置等环境变量

# 4. 设置数据库
#   - 使用 Supabase

# 5. 启动开发环境（Next.js + Gateway）
pnpm dev
# 综合面试实时语音需要配置 VOLCENGINE_STT_* 与 VOLC_REALTIME_BROWSER_API_KEY
```

### 环境要求

- Node.js >= 18.17.0
- pnpm (推荐) 或 npm

### 主要脚本

```bash
pnpm dev        # 同时启动 Next.js + Gateway + Scheduler（推荐）
pnpm dev:realtime # 启动 Next.js + Gateway，用于调试实时语音
pnpm dev:web    # 仅启动 Next.js
pnpm dev:gateway # 仅启动 Gateway
pnpm build      # 构建生产版本
pnpm lint       # 代码检查
pnpm format     # 代码格式化
```
