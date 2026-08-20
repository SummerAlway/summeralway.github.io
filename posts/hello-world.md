---
title: "你好，世界！"
date: 2026-08-20
tags: 随笔, 开篇
---

这是我的第一篇博客。博客文章统一存放在 GitHub 仓库的 `posts` 文件夹里，只要把 `.md` 文件推送上去，博客页就会自动发布。

## 如何发布一篇文章

1. 在本地写好 Markdown 文件
2. 放到仓库的 `posts/` 文件夹
3. 推送：`git add . && git commit -m "new post" && git push`
4. 打开博客页刷新即可看到新文章

## Front Matter 格式

文章开头用 `---` 包裹元信息，可配置标题、日期、标签：

```markdown
---
title: "文章标题"
date: 2026-08-20
tags: 标签1, 标签2
---

正文内容……
```
