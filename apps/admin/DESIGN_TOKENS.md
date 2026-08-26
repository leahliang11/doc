# JoyMaaS 文档后台 DESIGN_TOKENS

> 版本 P1 · 与前台统一品牌紫色体系，沿用 Stripe 后台信息密度风格

---

## 1. 颜色 Token

| Token | 值 | 用途 |
|---|---|---|
| `--brand` | `#7257E8` | 主品牌色，与前台一致 |
| `--brand-soft` | `#F1EFFC` | 品牌浅底，tag/背景 |
| `--brand-hover` | `#5c43d0` | 品牌色 hover 态 |
| `--primary` | `#7257E8` | 对齐 brand（历史兼容名） |
| `--primary-light` | `#8b74ed` |  |
| `--primary-lighter` | `#F1EFFC` | 对齐 brand-soft |
| `--bg` | `#F8FAFC` | 页面画布 |
| `--bg-card` | `#FFFFFF` | 卡片/面板背景 |
| `--bg-page` | `#FFFFFF` | 内容页背景 |
| `--bg-hover` | `#F1F5F9` | hover 态 |
| `--bg-sidebar` | `#FFFFFF` | 侧栏背景 |
| `--border` | `#E2E8F0` | 常规边框 |
| `--border-light` | `#F1F5F9` | 弱边框 |
| `--text` / `--text-primary` | `#1E293B` | 主文本 |
| `--text-secondary` | `#64748B` | 辅助文本 |
| `--text-tertiary` | `#94A3B8` | 占位/元数据 |
| `--green` | `#10B981` | 成功/已发布 |
| `--green-light` | `#D1FAE5` | 成功浅底 |
| `--red` | `#EF4444` | 错误/拒绝 |
| `--red-light` | `#FEE2E2` | 错误浅底 |
| `--orange` | `#F59E0B` | 警告/待审 |
| `--orange-light` | `#FEF3C7` | 警告浅底 |

**颜色原则**：
- 紫色负责品牌与通用交互（按钮、激活态、链接）
- 绿/红/橙只表达状态语义，不做装饰
- 不引入蓝色装饰体系

---

## 2. 字体

- 正文：系统无衬线（-apple-system / PingFang SC），14px / 1.6
- 标题：600，16-20px
- 小标签：12px / 500
- 元数据：11px

---

## 3. 布局

| 区域 | 尺寸 |
|---|---|
| 侧栏宽度 | 240px（原 260px，收窄更紧凑）|
| 侧栏收起 | 60px |
| 内容区最大宽度 | 1400px |
| 卡片圆角 | 12px |
| 小控件圆角 | 6-8px |

---

## 4. 组件规范

### 侧栏导航
- 分组标题（nav-group-title）：11px / 600 / 大写字母 / `--text-tertiary`
- 导航项（nav-item）：14px / 1.6 / hover 浅灰底 + 左侧 2px 品牌紫线
- 激活项（active）：品牌浅底 + 品牌紫文字 + 左侧 3px 品牌紫线
- 图标：16px，对齐文字基线

### 状态徽标（Badge）
| 状态 | 背景色 | 文字色 | 文案 |
|---|---|---|---|
| pending | `--orange-light` | `--orange` | 待审核 |
| approved | `--green-light` | `--green` | 已通过 |
| merged | `#DCFCE7` | `#16A34A` | 已发布 |
| rejected | `--red-light` | `--red` | 已拒绝 |
| auto | `--brand-soft` | `--brand` | 机器生成 |

### 按钮
- 主按钮：`--brand` 底色，白字，8px 圆角，hover 上移 1px + 阴影
- 次按钮：白底 + `--border` 边框，hover 浅灰底
- 危险按钮：`--red-light` 底 + `--red` 文字

### 表格
- 表头：`--bg-hover` 底色，12px / 600 / 大写字母 / `--text-secondary`
- 行 hover：`--bg-hover`
- 行间距：40px 高度（原来偏紧）
- 交替行色：不做，靠 hover 区分

---

## 5. 交互细节

- 保存反馈：保存中灰色旋转 → 成功绿色勾 → 2s 后消失
- 卡片 hover：上移 2px + 轻阴影（`--shadow-sm`）
- 按钮 hover：上移 1px
- 状态带（doc card 右上角）：6px 圆点 + 文字
- focus ring：2px 品牌紫
