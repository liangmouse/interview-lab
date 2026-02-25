# Interview Lab 🚀

> 🚧 **项目正在开发中** 🚧

一个专为中文互联网技术岗求职者打造的 AI 面试官智能体应用，致力于提供舒适、专业且高效的面试体验，让用户愿意多次使用，助力在校招和社招中乘风破浪 🤩 

## 应用特点 ✨

### 功能亮点 💡

- 📄 支持导入求职者简历，AI 可针对简历内容智能提问
- 🎥 面试支持视频通话与语音对话两种模式
- 📝 提供练习与测试两种模式：
  - 练习模式：AI 针对八股/算法题，用户作答后给出标准答案
  - 测试模式：AI 计分，数字人面试官有表情变化，面试结束给出 0-100 分成绩
- 💾 自动保存每一次面试记录，并对面试对话进行评估
- ⏰ 支持算法题/手撕代码题，限时作答并可运行代码

### 技术栈 🛠️

- **Supabase**：数据库与认证
- **Tailwindcss + shadcn-ui**：前端 UI
- **Next.js + TypeScript**：全栈开发
- **Vercel**：部署
- **CodeMirror**：代码编辑器

## 开发指南 🔧

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

# 5. 启动开发环境（Next.js + Agent）
pnpm dev
# 如果缺少 LIVEKIT_* 环境变量，会自动降级为仅启动 Next.js
# Ctrl+C 退出时会自动执行 Agent 清理
```

### 环境要求

- Node.js >= 18.17.0
- pnpm (推荐) 或 npm

### 主要脚本

```bash
pnpm dev        # 同时启动 Next.js + Agent（推荐）
pnpm dev:web    # 仅启动 Next.js
pnpm agent:dev  # 仅启动 Agent
pnpm build      # 构建生产版本
pnpm lint       # 代码检查
pnpm format     # 代码格式化
```
