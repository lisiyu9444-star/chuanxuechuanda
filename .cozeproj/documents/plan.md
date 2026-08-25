# 测评分数等级称号文案调整计划

## 概述

将「AI 毒舌时尚官」测评 prompt 中的分数等级称号由旧版 7 级（穿搭天花板/时尚达人/今日翻车等）替换为用户新版 10 级画面感文案（行走于秀场的/被摄影师追着拍的/勇气可嘉型的等），并让分享文案织入新称号以增强分享欲。纯服务端 prompt 文案调整（mobile 小程序），无 UI、无表结构变更。

## 技术方案

| 维度 | 选择 | 理由 |
|------|------|------|
| 改动位置 | `server/src/fashion-rating/fashion-rating.service.ts` | prompt、输出示例、兜底映射唯一出处 |
| 前端改动 | 无 | `level` 为纯展示字段（fashion-poster 页面+canvas、history 页直接渲染），无硬编码判断 |
| 历史数据 | 不迁移 | `fashion_ratings` 已存记录保留旧 level 文案，原样展示无影响 |
| 分享文案 | shareTexts 示例与默认兜底织入新称号 | 称号梗 + 分享文案联动，直接提升分享欲 |
| 敏感词 | "Luo奔都比这强的" 按用户原文实现 | 用户自定义文案并已自行做规避处理 |

## 功能模块

### 服务端 prompt 与解析（fashion-rating.service.ts，共 4 处）

1. **【评分等级】段落（约 40-47 行）**：整体替换为新 10 级对照表
   - 95+ 行走于秀场的 / 90-94 这就是超模本模的 / 85-89 被摄影师追着拍的 / 80-84 衣品很能打的 / 75-79 审美在线的 / 70-74 搭配有巧思的 / 65-69 挺有实验精神的 / 60-64 穿出去胆儿挺肥的 / 50-59 勇气可嘉型的 / <50 Luo奔都比这强的
2. **输出格式示例（约 56 行）**：`"level": "时尚达人"` → 新等级示例（如 `"level": "衣品很能打的"`）；shareTexts 示例同步织入称号（高分玩梗/低分自嘲两种语气）
3. **prompt 补充指引**：要求 AI 生成 shareTexts 时引用本次 level 称号（可与人格标签组合），保持毒舌幽默、适合朋友圈传播
4. **`levelOf(score)` 兜底映射（约 382-389 行）**：同步为新 10 级，确保 AI 返回缺失/非法 level 时不冒出旧文案；`defaultShareTexts` 兜底文案同步带称号

### 不变更项（明确排除）

- 前端 fashion-poster / fashion-rating / history 页面：零改动
- confident/selfDeprecating 选用分界（fashion-share 页 `totalScore >= 80`）：新表中 80+ 均为明确褒义，现有分界仍然成立，不动
- 评分维度权重、54 字 wittyComment 限制等其他 prompt 内容：不动

## 是否有原型设计

否（纯后端 prompt 文案调整，无任何页面/UI 改动，属首次开发后的小功能迭代）

## 实施步骤

1. **替换 prompt 等级与分享文案示例**：更新【评分等级】10 级表、输出示例 level、shareTexts 示例与生成指引（织入称号）——`server/src/fashion-rating/fashion-rating.service.ts`
2. **同步兜底映射**：`levelOf(score)` 改新 10 级、`defaultShareTexts` 带称号——同文件
3. **热更新后 curl 实测**：上传测试图调测评接口，验证返回 level 为新文案且与分数段匹配、shareTexts 含称号——`/api/fashion-rating/rate`
4. **前后端匹配验证 + `pnpm validate`**：确认 level/shareTexts 字段解析与渲染链路（poster、history、fashion-share）无影响，lint/tsc 全过
5. **日志健康检查并交付**：dev.log 无新错误，告知用户验证方式（重新测评一次看新称号）
