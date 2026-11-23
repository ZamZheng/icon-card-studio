# 私有Logo上传页面源码

当前入口：https://icon-card-assets-zamzheng.mutedmixer64.chatgpt.site

本目录是配套Site的源码副本。实际部署保留现有项目ID和owner-only访问权限，通过Sites发布，不使用GitHub Pages。

维护者先建立 `.openai/hosting.json`（可从hosting.example.json复制，使用已存在的准确项目ID），再运行：

```bash
npm run build
npm test
```

Worker输出为dist/server/index.js。上传内容保存R2的BUCKET绑定，品牌元数据在brand/current.json，肖像元数据在portrait/current.json，各自原文件按SHA-256留存、互不覆盖。肖像入口为/?asset=portrait。原文件候选不自动写入GitHub或替换工具固定Logo。

项目不使用用户Token或密钥作为源文件；平台负责ChatGPT登录保护。POST要求真实用户身份和同源Origin，GET由私有Site访问边界保护；服务访问与浏览器身份分开授权。

本地dev脚本仅在本地预览环境使用内存存储并提供测试身份，不能当作线上持久服务。线上构建只包含worker，不包含本地dev服务。
