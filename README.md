# Download YNote

基于Node.js、Puppeteer下载有道云笔记，完全依赖web版接口实现，如若遇到接口变更就跟着改吧~

## 功能列表

- [x] 第一版只支持ALL IN下载至浏览器默认下载文件夹
- [ ] 支持目录镜像下载
- [ ] 支持指定目录下载
- [x] 支持md文档下载
- [ ] 支持word文档下载

### 方式一

`config.js`配置用户登录态cookie，注意安全风险，切勿提交至公共网络。

```js
const COOKIE = '' // document.cookie
const UA = '' // navigator.userAgent
const HOST = 'https://note.youdao.com/web/'
```

```bash
$ yarn start --headless
```

### 方式二

```bash
$ yarn start --devtools
```

1. Puppeteer打开页面，用户手动登录
2. 切回云笔记窗口，点击`我的文件夹`
