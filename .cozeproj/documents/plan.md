# 今日用神展示优化（隐藏喜神 + 推导原因说明）

## 概述

针对八字穿搭指南的"每日用神"区块做两项展示优化（mobile 小程序）：
1. **隐藏喜神**：文案 `今日用神「x」· 喜神「y」` 中的喜神对用户不可见（后端喜神仍参与运势/穿搭色计算，仅 UI 不展示；且当前喜神多为随机选取，展示价值低）。
2. **新增推导原因**：告诉用户"今日用神为什么是 x"——后端按 7 条相生相克规则生成通俗解释文案，前端替换现有泛化说明。

先产出 HTML 原型验收，再实施代码开发。

## 技术方案

| 维度 | 选择 | 理由 |
|------|------|------|
| 原型 | design-canvas 产出 mobile HTML 原型 | 设计引导已开启，用户明确要求先画 demo |
| 喜神隐藏 | 仅改前端两处文案，后端字段/逻辑不动 | 喜神仍参与运势与穿搭色计算；避免破坏缓存与类型 |
| 推导原因 | 后端 `getDailyFavorableElements` 返回新增 `reason`，7 分支各配文案 | 原因与算法同源，保证解释与真实规则一致，不依赖 LLM（零成本零延迟） |
| 接口透出 | bazi 响应新增 `dailyYongShenReason?: string` | 可选字段，旧缓存/旧客户端兼容 |
| 缓存兼容 | 前端空值兜底：无 reason 时显示现有泛化文案 | dailyResults 为 jsonb 存储，无需改表；历史缓存不报错 |
| 文案呈现 | reason 置于用神行下方，替换现有"今日用神回归/已相应调整"泛化文案 | 原型确认视觉层级 |

## 功能模块

### 1. 后端：用神推导原因生成
- `getDailyFavorableElements(natalYongShen, natalXiShen, dayElement)` 返回值 `{ yongShen, xiShen }` → `{ yongShen, xiShen, reason }`
- 7 个分支文案（通俗、一句化、含五行关系），示例：
  - 日干=命盘用神：`今日干支五行属${dayElement}，与您命盘用神一致，能量纯粹，今日用神仍为「${yongShen}」`
  - 日干生用神：`今日日干${dayElement}生${natalYongShen}（能量外泄），最需补足「${dayElement}」本身，故今日用神取「${yongShen}」`
  - 用神生日干：`今日日干得命盘用神相生，顺势取「${yongShen}」为今日用神`
  - 日干克用神：`今日日干${dayElement}克命盘用神${natalYongShen}，需以喜神「${natalXiShen}」通关调候，故今日用神取「${yongShen}」`
  - 用神克日干 / 日干生喜神 / 日干=喜神：同理各配一条通俗解释
- 调用处（`bazi.service.ts` 462-464 行）将 `reason` 组装进响应 `dailyYongShenReason`

### 2. 前端：两处用神区块改造（同一视觉规格）
涉及 `outfit-guide-content.tsx`（首页）与 `result/index.tsx`（结果页）两处同构实现：
- 文案：`今日用神「x」· 喜神「y」` → `今日用神「x」`
- 泛化说明行 → 真实 `reason`（无 reason 兜底显示原泛化文案）
- `types/bazi.ts`、`types/archive.ts` 增加 `dailyYongShenReason?: string`；`loading/index.tsx` 透传；`index/index.tsx` mock 数据补 reason

## 是否有原型设计

是（设计引导工具已开启，且用户明确要求先画 demo）

## 实施步骤

### 阶段一：原型设计
1. **产出"每日用神区块"改造原型**：加载 design-canvas 技能，基于现有穿搭指南页结构，产出含改造后用神区块的 mobile HTML 原型（隐藏喜神 + 推导原因展示，给 1-2 条示例文案）；完成后 done 提交，等用户验收确认。

### 阶段二：代码开发
2. **后端用神 reason 生成与透出**：`bazi.service.ts`（`getDailyFavorableElements` 返回 reason、响应组装 `dailyYongShenReason`）、`stylist.service.ts`（如响应在此组装）。
3. **前端两处展示改造**：按原型还原用神区块（隐藏喜神 + reason 展示），同步类型与透传：`outfit-guide-content.tsx`、`result/index.tsx`、`loading/index.tsx`（含 `types/bazi.ts`、`types/archive.ts`、`index/index.tsx` mock）。
4. **API 测试与前后端匹配验证**：curl 调开发接口确认响应含 `dailyYongShenReason` 且文案与分支规则一致；核对前端字段名/解析层级。
5. **校验交付**：`pnpm validate` 修复所有 error 后交付。

## 页面规格

> 本次为已有页面局部区块改造，不涉及导航变更；规格仅覆盖改动区块。

##### @nav(mobile-tabbar)
> type: tabbar
> platform: mobile

沿用现有导航结构，本次不变更。

##### @page(/) 首页（今日穿搭指南）

**核心职责**：展示用户今日运势与穿搭建议（本次仅改"喜用神分析"卡片内的"每日用神"区块）。
**访问路径**：现有入口不变。

**每日用神区块字段**：
- 圆形五行图标（用神字 + 五行色描边/浅底）/ 标题行：`今日用神「x」`（不再展示喜神）/ 推导原因行：后端 `dailyYongShenReason` 文案（一句化通俗解释，五行色弱化显示）/ 兜底：无 reason 时显示"今日用神回归，穿搭主色调保持不变"或"今日五行能量变化，穿搭主色调已相应调整"

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 每日用神区块 | 无交互 | 纯展示 | — | 仅 pageMode='daily' 显示；本命模式不出现该区块 |

##### @page(/result) 结果页

**核心职责**：八字分析结果与穿搭方案展示（本次仅改"喜用神分析"卡片内的"每日用神"区块，视觉规格与首页完全一致）。
**访问路径**：测评/生成流程完成后进入。

**每日用神区块字段**：与 @page(/) 一致（同一组件结构的两份实现，本次同步改造）。

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 每日用神区块 | 无交互 | 纯展示 | — | 仅 pageMode='daily' 显示 |
