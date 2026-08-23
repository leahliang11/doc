# JoyMaaS 文档站设计 Token（Vercel Docs 基线）

> 参考基准：vercel.com/docs。核心：90% 灰阶，只在图标和链接用主色，不再让每个组件染色。
> 字重 400/500 主导（去掉 300 轻字重），圆角 6px，常态无阴影，hover 才有轻微反馈。
> CSS 变量定义在 `src/app/globals.css`。

---

## 1. 颜色

### 中性灰阶（主力，90% 场景用这些）
| Token | Light | Dark | 用途 |
|---|---|---|---|
| `--background` | `#ffffff` | `#0a0a0a` (neutral-950) | 页面背景 |
| `--foreground` | `#171717` (neutral-900) | `#ededed` (neutral-200) | 主字色 |
| `--muted-foreground` | `#525252` (neutral-600) | `#a3a3a3` (neutral-400) | 次字色/正文灰 |
| `--card` | `#ffffff` | `#0a0a0a` | 卡片/Callout 底（白/深，不填色） |
| `--border` | `#eaeaea` (neutral-200) | `#333333` (neutral-700) | 极细边框 |
| `--muted` | `#fafafa` (neutral-50) | `#171717` (neutral-900) | 收起态/次要容器底 |

### 主色（只在图标、链接、focus 用，不染色块）
| Token | Light | Dark | 用途 |
|---|---|---|---|
| `--primary` | `#0070f3` | `#3291ff` | 链接、图标主色、focus ring |
| `--accent` | `#fafafa` | `#171717` | hover 背景 |

### 语义点缀色（只用在图标/小标记，不用作底色）
| 语义 | Light | Dark | 用途 |
|---|---|---|---|
| warning（琥珀） | `#f5a623` | `#f5a623` | warning 图标 |
| danger（红） | `#e00` | `#ff5555` | danger 图标 |
| success（绿） | `#0070f3`→用主色或 `#0a8` | `#0a8` | success 图标 |
| internal（橙） | `#f5a623` | `#f5a623` | InternalOnly 锁图标点缀 |

> **核心原则**：底色永远是白/neutral-950，不填彩色浅底。语义只靠小图标颜色传达，不用色块。

---

## 2. 字体

- **主字体**：Geist / Inter / system-ui（weight 400/500/600）
- **等宽**：Geist Mono / ui-monospace
- **字重主导 400/500**（去掉 Stripe 的 300 轻字重），标题用 600

### 字号 / 字重
| 角色 | 字号 | 字重 |
|---|---|---|
| h1（页标题） | 32px | 600 |
| h2（章节） | 24px | 600 |
| h3（小节） | 18px | 600 |
| 正文 | 14px | 400 |
| 正文大（描述） | 16px | 400 |
| 组件标题（Callout 等） | 14px | 500 |
| 组件正文 | 14px | 400 |
| 标签/元数据 | 13px | 500 |
| 代码 | 13px | 400 (mono) |

> 禁忌：不用 weight 300；不用纯黑 `#000`（用 neutral-900 `#171717`）；不让组件大面积染色。

---

## 3. 圆角

- 主力 `6px`（卡片、Callout、输入框、按钮）
- 小元素 `4px`（徽章、代码 inline）
- 不用药丸形（`rounded-full` 仅步骤序号圆点）

---

## 4. 阴影

- **常态无阴影**（边框代替）
- hover：边框加深（`#eaeaea` → `#d4d4d4`），可加 `translate-y-[-1px]`，**不放大阴影**
- focus：`outline: 2px solid var(--primary)`

---

## 5. 垂直节奏（`.prose-doc` 内）
| 元素 | 上 | 下 |
|---|---|---|
| h2 | 40px | 16px |
| h3 | 28px | 12px |
| 段落 | 0 | 14px |
| Callout / InternalOnly / NextSteps | 16px | 16px |
| 代码块 | 20px | 20px |
| 列表 | 0 | 14px |
| 行高 | 1.6（正文） | |

---

## 6. 组件视觉规范

### Callout
- 底：`bg-card`（白 / dark neutral-950），**不填彩色浅底**
- 边框：`1px solid var(--border)`（#eaeaea / #333）
- 左侧 2px 细线：颜色更淡（`var(--border)` 加深一档，或语义色 30% 透明度）
- 结构：`[图标 14px][标题 14px/500 主字色]` 同行；正文 14px/400 次字色，紧跟下方
- 图标用语义色（小面积），容器不染色

### InternalOnly
- 收起态：一行灰底 `bg-muted`（neutral-50/900）+ 左锁图标（橙色 h-3 w-3 点缀）+ "仅内部可见" 灰字 + 右箭头
- **不要橙色底**，容器全 neutral
- 只锁图标用橙色

### NextSteps 卡片
- 内边距 p-4，边框极细 `var(--border)`，无阴影
- 标题 15px/500，说明 13px/400，箭头 12px
- 高度让内容决定，不要 min-height
- hover：边框加深 + `translate-y-[-1px]`，不加阴影

---

## 7. 校对清单
- [ ] 底色白/neutral-950，不填彩色浅底
- [ ] 字重 400/500/600，不用 300
- [ ] 圆角 6px
- [ ] 常态无阴影，hover 才边框加深
- [ ] 主色只在图标/链接/focus，不染色块
- [ ] 边框 #eaeaea/#333
