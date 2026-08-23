# Content Repo

这个目录是 JoyMaaS 文档的**内容源**（唯一权威源）。

## 结构

```
content-repo/
├── content/
│   ├── quickstart/       # 快速开始
│   ├── models/           # 模型说明
│   ├── api/              # API 参考(部分自动生成)
│   ├── api-spec/         # OpenAPI 规范(工程师维护)
│   │   └── openapi.yaml
│   ├── guides/           # 场景指南
│   └── troubleshooting/  # 排障
└── README.md
```

## 谁在写

- **PM / 运营 / 售前**：通过后台 Web 编辑器写散文类文档（quickstart / guides / troubleshooting）
- **工程师**：维护 `content/api-spec/openapi.yaml`，系统自动生成 `content/api/*.mdx`

## 规则

1. **不要手写 `content/api/` 下的文件**——它们从 `openapi.yaml` 自动生成
2. 手写内容用 `@manual-section` 标记保留
3. 每篇 MDX 必须有 frontmatter（title / description / slug / category / audience / status）
4. `audience: internal` 的文档不会出现在公开 `.md` 和 `llms.txt` 里
