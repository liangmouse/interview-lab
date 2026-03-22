# 三个 Tab 实现计划（UIUX Pro Max）

## 当前状态
- `interview/page.tsx` → `InterviewModeTabs` → 综合面试 & 专项面试 均为 `SectionPlaceholder`
- `interview/archive/page.tsx` → `SectionPlaceholder`
- `records/page.tsx` → `SectionPlaceholder`

## 分支
`claude/build-interview-tabs-0Uukk`

---

## Tab 1：模拟面试（`interview-mode-tabs.tsx`）

### 综合面试（Full Interview）
将 `SectionPlaceholder` 替换为 `FullInterviewPanel`，功能：
- 岗位方向选择卡片（前端 / 后端 / 全栈 / 移动端），带图标，hover 高亮
- 难度选择（初级 / 中级 / 高级 / 专家），pill 形式
- 时长选择（10 / 25 / 40 / 60 min），pill 形式
- 个性化模式切换（通用 / 基于简历）
- "开始综合面试" 按钮，loading state
- 调用现有 `createInterview()` action，跳转到面试房间

### 专项面试（Focus Interview）
将 `SectionPlaceholder` 替换为 `FocusInterviewPanel`，功能：
- 专项维度大卡片选择（HR 面试 / 技术问答 / 代码编程 / 系统设计），带图标和描述
- 难度 + 时长选择（同上）
- "开始专项面试" 按钮
- 调用同一 `createInterview()` action（topic 映射到专项类型）

---

## Tab 2：面试档案（`interview/archive/page.tsx`）

替换为 `InterviewArchiveView`（client component），功能：
- **顶部统计栏**：总场次 / 平均分 / 总时长 / 完成率（调用 `getInterviewStats()`）
- **筛选行**：全部 / 已完成 / 进行中 + 排序按钮
- **面试卡片列表**（调用 `getProfileInterviews()`，最多20条）：
  - 日期 + 类型标签
  - 评分 badge（≥80 绿，≥60 黄，<60 红）
  - 时长 + 状态 badge
  - 迷你雷达图（`MiniRadarChart` 组件，SVG，80×80）
  - "查看详情" 链接 → `/interview/[id]`
- **空状态**：图标 + 文案 + "开始面试"按钮

---

## Tab 3：面试记录（`records/page.tsx`）

替换为 `RecordsView`（client component），功能：
- **顶部指标卡片**（3列）：总面试次数 / 平均分 / 总练习时长（调用 `getInterviewStats()`）
- **分数折线图**（SVG 自绘，不引入新依赖）：以时间为 x 轴，分数为 y 轴，展示趋势
- **维度雷达图**（大尺寸，200×200）：汇总所有面试的维度均值
- **面试记录表格**：日期 / 类型 / 评分 / 时长 / 状态，带悬停效果
- **空状态**：图标 + 文案 + "开始第一次面试"按钮

---

## 新建文件

| 文件 | 说明 |
|------|------|
| `src/components/interview/full-interview-panel.tsx` | 综合面试配置面板（client） |
| `src/components/interview/focus-interview-panel.tsx` | 专项面试配置面板（client） |
| `src/components/interview/mini-radar-chart.tsx` | 迷你雷达图 SVG 组件（共用） |
| `src/components/interview/interview-archive-view.tsx` | 面试档案页面内容（client） |
| `src/components/interview/records-view.tsx` | 面试记录分析页面（client） |

## 修改文件

| 文件 | 改动 |
|------|------|
| `src/components/dashboard/interview-mode-tabs.tsx` | 替换两个 SectionPlaceholder |
| `src/app/[locale]/(user)/(shell)/interview/archive/page.tsx` | 替换 SectionPlaceholder |
| `src/app/[locale]/(user)/(shell)/records/page.tsx` | 替换 SectionPlaceholder |

## 设计系统
- 主色：`#0F3E2E`（deep ink green）
- 强调色：`#059669`（emerald）
- 背景：`hsl(48 33% 98%)`
- 卡片：white，圆角 `rounded-xl`，`border-border/50 shadow-sm`
- Hover：`hover:-translate-y-0.5 hover:shadow-md transition-all duration-200`
- 分数色阶：≥80 `text-emerald-600 bg-emerald-50`，≥60 `text-amber-600 bg-amber-50`，<60 `text-red-600 bg-red-50`
- 加载：Skeleton 组件（已有）
- 不引入新依赖，雷达图 / 折线图均用 SVG 手写
