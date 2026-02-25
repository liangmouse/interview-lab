# Young Interview Expert - LiveKit Agent

面试专家 AI Agent，基于 LiveKit Agents 官方架构构建。

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8

### 安装依赖

```bash
# 在项目根目录
pnpm install
```

### 环境变量配置

创建 `.env.local` 文件：

```bash
# LiveKit 服务器配置
LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret

# Gemini 配置（用于 LLM 和 TTS）
GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-3-flash-preview

# Deepgram 配置（用于 STT）
DEEPGRAM_API_KEY=your-deepgram-key

# 开发模式（可选）
DEV_ROOM_NAME=test-room  # 设置后自动进入开发模式
```

### 启动 Agent

#### Worker 模式（生产环境）

```bash
# 在项目根目录
pnpm run agent:dev

# 或者直接运行
npx tsx agent/main.ts start
```

#### 开发模式（直连房间）

```bash
# 设置开发房间名
export DEV_ROOM_NAME=my-test-room

# 启动 Agent
pnpm run agent:dev
```

Agent 将自动连接到指定房间，等待用户加入。

## 🏗️ 架构说明

### 核心组件

```
┌─────────────────────────────────────────┐
│         defineAgent (main.ts)           │
├─────────────────────────────────────────┤
│  prewarm:                               │
│    - 预加载 Silero VAD 模型             │
│                                         │
│  entry:                                 │
│    ├─ voice.Agent                       │
│    │   └─ instructions + tools          │
│    │                                    │
│    └─ voice.AgentSession                │
│        ├─ STT: Deepgram                 │
│        ├─ LLM: OpenAI (Gemini)          │
│        ├─ TTS: OpenAI (Gemini)          │
│        └─ VAD: Silero                   │
└─────────────────────────────────────────┘
```

### 关键特性

1. **VAD (Voice Activity Detection)**
   - 使用 Silero VAD 模型
   - 准确检测用户何时开始/停止说话
   - 支持自然的对话节奏

2. **自动状态管理**
   - IDLE → LISTENING → PROCESSING → SPEAKING
   - 完全由 AgentSession 自动处理
   - 无需手动管理状态转换

3. **智能打断**
   - 用户说话时自动打断 Agent
   - 可配置最小打断时长（默认 500ms）
   - 打断后立即响应新输入

4. **上下文感知**
   - 自动加载用户 Profile
   - 支持面试上下文动态切换
   - RPC 消息驱动的上下文更新

5. **完整监控**
   - 状态变化日志
   - 用户转录实时显示
   - 指标自动收集
   - 错误捕获和恢复

## 📁 项目结构

```
agent/
├── main.ts                          # 入口文件
├── src/
│   ├── config/
│   │   └── providers.ts             # Gemini Provider 配置
│   ├── services/
│   │   └── context-loader.ts        # 上下文加载服务
│   ├── constants/
│   │   ├── prompts.ts              # Prompt 配置
│   │   └── vocabulary.ts           # 技术词汇
│   └── utils.ts                    # 工具函数
├── TESTING.md                      # 测试指南
├── REFACTORING_SUMMARY.md          # 重构总结
└── README.md                       # 本文档
```

## 🔧 配置选项

### Agent 配置

```typescript
const agent = new voice.Agent({
  instructions: '你是一位专业的面试官...',  // Agent 行为指令
  tools: {                                 // 可用的 LLM 工具
    // 在这里添加工具
  },
});
```

### Session 配置

```typescript
const session = new voice.AgentSession({
  // STT 配置
  stt: new deepgram.STT({
    model: 'nova-2-general',
    language: 'zh',              // 中文识别
    smartFormat: true,           // 智能格式化
    keyterms: TECH_VOCABULARY,   // 技术词汇
  }),

  // LLM 配置
  llm: new openai.LLM({
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-3-flash-preview',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    temperature: 0.7,
  }),

  // TTS 配置
  tts: new openai.TTS({
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.5-flash-preview-tts',
    voice: 'Kore',
    speed: 1.0,
  }),

  // VAD 配置
  vad: ctx.proc.userData.vad,

  // 语音交互选项
  voiceOptions: {
    allowInterruptions: true,        // 允许打断
    minInterruptionDuration: 500,    // 最小打断时长（毫秒）
  },
});
```

## 📡 事件监听

Agent 发出以下事件：

```typescript
// 状态变化
session.on(voice.AgentSessionEventTypes.AgentStateChanged, (ev) => {
  console.log(`状态: ${ev.oldState} -> ${ev.newState}`);
});

// 用户输入转录
session.on(voice.AgentSessionEventTypes.UserInputTranscribed, (ev) => {
  console.log(`用户说: ${ev.transcript}`);
});

// 指标收集
session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev) => {
  console.log('使用指标:', ev.metrics);
});

// 错误处理
session.on(voice.AgentSessionEventTypes.Error, (ev) => {
  console.error('错误:', ev.error);
});
```

## 🔌 RPC 消息

### 开始面试

从客户端发送：

```javascript
room.localParticipant.publishData(
  JSON.stringify({
    name: 'start_interview',
    data: {
      interviewId: 'interview-123'
    }
  }),
  { reliable: true, topic: 'lk-chat-topic' }
);
```

Agent 将：
1. 加载面试上下文
2. 更新 system prompt
3. 发送确认消息

## 🧪 测试

详细测试指南请参考 [`TESTING.md`](./TESTING.md)

快速测试：

```bash
# 1. 启动 Agent（开发模式）
export DEV_ROOM_NAME=test-room
pnpm run agent:dev

# 2. 在浏览器中打开 LiveKit 测试页面
# 3. 加入房间 test-room
# 4. 开始对话测试
```

## 🐛 调试

### 启用详细日志

```bash
LOG_LEVEL=debug pnpm run agent:dev
```

### 查看特定事件

在 `main.ts` 中添加更多事件监听：

```typescript
// VAD 状态变化
session.on(voice.AgentSessionEventTypes.VadStateChanged, (ev) => {
  console.log(`[VAD] ${ev.state}`);
});

// Agent 思考中
session.on(voice.AgentSessionEventTypes.AgentThinking, (ev) => {
  console.log('[Agent] 正在思考...');
});
```

### 常见问题

#### 1. Agent 无法连接

- 检查 `LIVEKIT_URL` 是否正确
- 确认 API Key 和 Secret 有效
- 查看防火墙设置

#### 2. 语音识别不准确

- 确认 Deepgram API Key 有效
- 检查音频质量
- 尝试添加更多技术词汇到 `vocabulary.ts`

#### 3. TTS 延迟高

- 检查 Gemini API 配额
- 考虑切换到更快的 voice model
- 优化网络连接

#### 4. VAD 误触发

- 调整 `minInterruptionDuration`
- 检查环境噪音
- 考虑使用降噪

## 📚 相关文档

- [LiveKit Agents 官方文档](https://docs.livekit.io/agents/)
- [LiveKit Agents JS SDK](https://github.com/livekit/agents-js)
- [重构总结](./REFACTORING_SUMMARY.md)
- [测试指南](./TESTING.md)
