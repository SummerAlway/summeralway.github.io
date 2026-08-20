# posts 文件夹

这里是博客文章的存放位置。

## 如何发布文章

把 `.md` 文件放进本文件夹并推送到 GitHub 即可，博客页会自动从本文件夹加载并渲染所有 Markdown 文章。

### 文章格式（Front Matter）

每篇文章开头用 `---` 定义元信息：

```markdown
---
title: "文章标题"
date: 2026-08-20
tags: 标签1, 标签2
---

这里是正文，支持完整 Markdown 语法。
```

- `title`：文章标题（必填，缺省时用文件名）
- `date`：发布日期（可选，格式 `YYYY-MM-DD`）
- `tags`：标签（可选，用英文逗号分隔）

## 推送命令

```bash
git add posts/
git commit -m "add new post"
git push
```

推送完成后，打开博客页刷新即可看到新文章。
