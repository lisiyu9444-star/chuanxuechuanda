# AI 毒舌时尚官（穿搭评分）v1.0 MVP 实施计划

## 概述

在现有「幸运穿搭」小程序中新增第二个 Tab「测评」：用户上传穿搭照片，后端经内容安全审核后调用多模态 AI（doubao-seed 系列，`image_url` 消息）按 PRD System Prompt 输出毒舌评分 JSON，前端以杂志风极简海报呈现（大图 + 超大分数 + 等级 + 风格人格 + 一句话毒舌点评），支持保存卡片、再测一次、分享好友。登录用户 3 次/天，历史记录挂在「我的」页入口。涉及集成能力：LLM 多模态（llm 技能）、TOS 对象存储（storage 技能）、图片跨端上传（miniapp-upload-asr 技能，**必须加载**）、微信 img_sec_check 内容审核（新增 access_token 链路）。

## 技术方案

| 维度 | 选择 | 理由 |
|------|------|------|
| 页面形态 | 测评 Tab 页（上传/结果两状态）+ 复用 pages/loading 扩展 mode=fashion-rating | 用户已确认：Loading 跳独立页复用现有组件，navigateBack 回 tab 页避免 switchTab 闪烁 |
| AI 模型 | doubao-seed-2-0-pro-260215（LLMClient，image_url 多模态消息） | SDK models.d.ts 已支持 image_url 类型；与现有 stylist 服务同链路 |
| 内容安全 | 微信 img_sec_check（AI 调用前强制）；新增 access_token 获取+进程缓存（7200s）；3s 超时/开发模式降级放行+日志 | PRD 强制要求；appid/secret 已在 app_secrets 表 |
| 图片链路 | 前端 chooseImage 压缩 →（>2MB 时 canvas 压缩长边≤1024/0.8/jpg）→ Network.uploadFile；后端 Multer 双模式读取 → sharp/二次校验 → TOS uploadFile | miniapp-upload-asr 跨端规范；TOS key 永久有效 |
| 频率限制 | DB 计数：fashion_ratings WHERE user_id + created_at ≥ 当日 0 点；登录 3 次/天，未登录走登录拦截 | 无 Redis 依赖，最简实现 |
| 存储 | PostgreSQL + Drizzle 新增 fashion_ratings 表（exec_sql 建表） | PRD 已定 DDL |
| 保存卡片 | canvas 2d 绘制结果海报 → canvasToTempFilePath（2x）→ saveImageToPhotosAlbum；失败降级 toast「请长按截图保存」；H5 端提示长按截图 | PRD 方案；canvas 仅小程序端可用需平台检测 |
| 分享 | Taro.useShareAppMessage（测评页），title 拼分数+风格人格，path 带 referrer | PRD 方案；H5 端隐藏 |
| 主题 | 沿用 slate-900 主色 + 白底灰黑杂志风；禁止紫色 | 项目既定规范 |

## 功能模块

### 1. Tab 与路由
- `src/app.config.ts`：tabBar.list 第 2 位插入「测评」（pages/fashion-rating/index），pages 注册测评页 + 测评记录页
- Tab 图标：`npx taro-lucide-tabbar Sparkles` 生成（color #999999 / active #1F2937，与现有一致）
- 「我的」页新增「测评记录」入口行（→ 测评记录页）

### 2. 后端 fashion-rating 模块（server/src/fashion-rating/）
- `schema.ts` 新增 fashion_ratings 表（id `fr_{ts}_{rand}` / user_id / image_url / result JSONB / created_at + 两索引），exec_sql 建表
- 微信 token 工具：client_credential 获取 access_token，进程缓存（有效期 7200s 提前 5min 续），供 img_sec_check 使用
- `POST /api/fashion-rating/rate`（需登录）：Multer 单文件 `image` → 校验 jpg/png/webp ≤10MB → img_sec_check（不通过 400「图片不合规，请更换」）→ TOS 上传 → LLM 多模态评分（PRD System Prompt，temperature 0.5，JSON 输出）→ 解析（失败时正则提取 totalScore/level 降级）→ 存库 → 返回 `{ id, imageUrl, result, createdAt }`
- `GET /api/fashion-rating/remaining`：返回今日剩余次数
- `GET /api/fashion-rating/list`：登录用户历史（按 created_at 倒序）
- `DELETE /api/fashion-rating/:id`：删除本人记录
- 频率：rate 前检查，超限 429「今日评分次数已用完」
- AI 输出 JSON（PRD 删除线字段全部砍掉）：`{ totalScore, level, stylePersonality, wittyComment, shareTexts{confident,selfDeprecating}, isInvalid, imageWarning }`

### 3. 前端测评页（src/pages/fashion-rating/index.tsx）
- 状态机：`upload`（默认）/ `result`
- 上传态：大量留白 + 居中虚线「＋ 上传穿搭照片」大按钮 + 灰字「拍照或从相册选择」+ 底部「今日还可测 N 次」（次数 0 时按钮灰显「今日次数已用完」）；点击先 requireLogin 拦截
- 选图 → 前端压缩 → 图片临时路径存 storage（`fashion_pending_image`）→ navigateTo loading 页（mode=fashion-rating）
- `useDidShow`：读取 `fashion_latest_result`（loading 写入），有则切 result 态并清除标记
- 结果态（海报组件 `src/components/fashion-poster.tsx`）：圆角大图 + 右下角覆盖超大分数 + 等级·副标题 + 风格人格 + 两行斜体毒舌点评（wittyComment；imageWarning 顶部小字提示；isInvalid 时海报区展示幽默拒绝语+重传引导）+ 极简分隔线 + 操作区：[保存卡片][再测一次] 纯文字链接 + 「分享好友，挑战 TA」细线边框胶囊主 CTA
- 保存卡片：小程序 canvas 2d 绘制（图+分数+等级+人格+点评）→ 相册；H5/失败降级 toast「请长按截图保存」
- 分享：useShareAppMessage（分数+人格文案，path 带 referrer）
- 再测一次：清结果回 upload 态（剩余次数实时刷新）

### 4. Loading 页扩展（src/pages/loading/index.tsx）
- mode=fashion-rating：毒舌文案轮播（PRD 8 条，2.5s 淡入淡出）替代八字文案
- 取 `fashion_pending_image` → Network.uploadFile POST /api/fashion-rating/rate（可 abort）→ 成功写 `fashion_latest_result` + navigateBack；失败 toast + navigateBack
- 取消（返回）：abort 请求 + toast「生成已取消」，复用现有 useUnload 模式

### 5. 前端测评记录页（src/pages/fashion-rating/history/index.tsx）
- 列表项：缩略图 / 分数+等级 / 风格人格 / 日期
- 点击 → 海报重现（复用 fashion-poster 组件，只读）
- 删除：长按或左滑删除（AlertDialog 确认）→ DELETE 接口 → 刷新列表
- 空态：Skeleton 加载 + 空态引导去测评

## 是否有原型设计

是（设计引导工具已开启）

## 实施步骤

**阶段一：原型设计**
1. 加载 design-canvas 技能，按 mobile 规范设计 3 个原型页（测评-上传态、测评-结果海报态、测评记录页），完成后 done 提交等用户验收确认。

**阶段二：代码开发**
2. Tab 与路由配置：app.config.ts 插入测评 Tab + 注册两个新页面 + 生成测评 tabbar 图标；「我的」页加「测评记录」入口（src/app.config.ts、src/pages/profile/index.tsx）。
3. 后端 fashion-rating 模块：fashion_ratings 建表 + 微信 access_token/img_sec_check + rate/remaining/list/delete 四接口，同一 todo 内完成 curl API 测试 + 前后端匹配验证（server/src/fashion-rating/*、schema.ts）。
4. 前端测评页三状态 + 海报组件 + 选图压缩上传 + 截图保存/分享/再测一次（src/pages/fashion-rating/index.tsx、src/components/fashion-poster.tsx）。
5. Loading 页扩展 mode=fashion-rating（毒舌文案轮播 + 上传请求 + 结果回传）（src/pages/loading/index.tsx）。
6. 前端测评记录页（列表 + 海报重现 + 删除）（src/pages/fashion-rating/history/index.tsx）。
7. `pnpm validate` 校验 + `pnpm build` 编译检查 + 日志健康检查。

## 页面规格

### 全局导航

##### @nav(mobile-tabbar)
> type: tabbar
> platform: mobile

- @page(/) 首页 | icon: house
- @page(/fashion-rating) 测评 | icon: sparkles
- @page(/profile) 我的 | icon: user

### 页面详情

##### @page(/fashion-rating) 测评

**核心职责**：上传穿搭照片获取 AI 毒舌评分，并以杂志风海报呈现与分享结果。
**访问路径**：Tabbar 直达；分享链接携带 referrer 参数进入（仅记录来源，不影响功能）。
**布局**：顶部导航栏（标题「测评」）；主内容区为单页两状态：上传态（大量留白 + 居中上传卡片 + 底部剩余次数）/ 结果态（杂志海报：圆角大图 + 右下角超大分数 + 等级·副标题 + 风格人格 + 两行斜体毒舌点评 + 极简分隔线 + 操作区）。
**列表项字段**（历史入口/次数区）：今日剩余次数（底部灰字）。
**状态**：
- 空态（上传态默认）：虚线「＋ 上传穿搭照片」+「拍照或从相册选择」
- 次数用完：上传按钮灰显 +「今日次数已用完」
- 非穿搭照：海报区展示 AI 幽默拒绝语 + 重传引导
- 图片模糊：海报顶部小字 imageWarning 提示

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 上传卡片 | 点击 | 未登录唤起登录弹层；已登录调起拍照/相册选择器 | — | 次数为 0 时禁用 |
| 选择图片后 | 自动 | 前端压缩 → 存临时路径 → 跳转 pages/loading（mode=fashion-rating） | 图片路径走 storage | — |
| loading 返回 | 自动 | 读取 fashion_latest_result，有结果切结果态 | — | useDidShow |
| 保存卡片 | 点击 | canvas 绘制海报存相册，toast「已保存到相册」；失败 toast「请长按截图保存」 | — | 仅小程序；H5 直接提示长按截图 |
| 再测一次 | 点击 | 清空结果回上传态，刷新剩余次数 | — | — |
| 分享好友 CTA | 点击 | 唤起微信转发（标题含分数+风格人格，path 带 referrer） | referrer | 仅小程序；H5 隐藏 |

##### @page(/fashion-rating-history) 测评记录

**核心职责**：登录用户查看、回顾与删除历史测评记录。
**访问路径**：「我的」页「测评记录」入口进入；未登录由入口拦截。
**布局**：顶部导航栏（标题「测评记录」+ 返回）；主内容区为记录卡片列表（倒序）。
**列表项字段**：缩略图 / 分数 / 等级 / 风格人格 / 测评日期
**状态**：
- 空态：插画占位 +「还没有测评记录，去测一张吧」+ 跳转测评 Tab 按钮
- 加载态：Skeleton 卡片列表

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 记录卡片 | 点击 | 页内展开海报重现（复用 fashion-poster，只读） | 记录 id | — |
| 记录卡片 | 长按 | 弹出 @modal(confirm-delete) | 记录 id | — |
| 返回按钮 | 点击 | 返回「我的」页 | — | — |
| 空态按钮 | 点击 | switchTab 跳转 @page(/fashion-rating) | — | — |

**弹窗 confirm-delete**：
- 标题："删除记录"
- 内容：确认删除该次测评记录（分数+日期）
- 操作：确认（调 DELETE 接口并刷新列表）、取消（关闭弹窗）
