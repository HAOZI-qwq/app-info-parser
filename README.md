# app-info-parser

> A maintained fork of [chenquincy/app-info-parser](https://github.com/chenquincy/app-info-parser), focused on modern APK/IPA parsing compatibility and bug fixes.

一个用于解析 `.apk` / `.ipa` 应用信息的 JavaScript 解析器，支持 Node.js 和浏览器环境。解析结果主要来自 Android `AndroidManifest.xml`、`resources.arsc` 以及 iOS `Info.plist` / `embedded.mobileprovision`。

## About this fork / 关于本维护版

本项目基于原项目 [chenquincy/app-info-parser](https://github.com/chenquincy/app-info-parser) 维护。

原项目由 Quincy Chen（陈秋鑫）开发，并以 MIT License 开源。上游项目已声明不再继续功能维护，因此本 fork 在尽量保持原 API 和使用方式兼容的前提下，继续修复现代 Android APK 资源格式、图标解析、Unicode 字符串及浏览器资源释放等问题。

> 本 fork 不代表原作者，也不会修改或移除原项目的版权与 MIT License 声明。

## Main improvements / 主要改进

相较上游 `1.1.6`，本维护版主要修复和改进：

- 支持现代 Android `resources.arsc` 资源表结构
- 支持 `FLAG_SPARSE`
- 支持 `FLAG_OFFSET16`
- 支持 `FLAG_COMPACT`
- 按真实 resource entry offset 定位资源项
- 修复资源引用解析顺序问题
- 保留 Unicode、空格及特殊字符形式的 `versionName`
- 修复 UTF-16 String Pool 解码
- 修复 String Pool 索引 `0` 被误判为空的问题
- 修复 Android `dimension` / `fraction` / `float` 类型解析
- 改进 APK 图标选择逻辑
- 避免将 Adaptive Icon XML 错误标记为 PNG
- 支持 PNG / WebP / JPEG 图标 MIME 识别
- 修复浏览器 ZIP Worker 未释放导致的资源泄漏
- 修复 IPA 大图标转换时可能出现的 `Maximum call stack size exceeded`
- 改进 Manifest / resources 解析异常信息，保留原始错误原因

详细说明见 [FIXES.md](./FIXES.md)。

## Support

- Node.js ✅
- Browser ✅（IE 除外）
- NPX ✅

## Installation

### 安装此维护版

当前 `npm install app-info-parser` 指向的是上游 npm 包，并不是本 fork。

如果需要直接使用本仓库版本，可以从 GitHub 安装：

```shell
npm install github:HAOZI-qwq/app-info-parser
```

或者：

```shell
yarn add github:HAOZI-qwq/app-info-parser
```

### 上游 npm 包

如果你明确需要原版 `1.1.6`：

```shell
npm install app-info-parser
```

## Getting started

### Node.js

```javascript
const AppInfoParser = require('app-info-parser')

const parser = new AppInfoParser('../packages/test.apk') // or xxx.ipa
parser.parse().then(result => {
  console.log('app info ----> ', result)
  console.log('icon base64 ----> ', result.icon)
}).catch(err => {
  console.log('err ----> ', err)
})
```

如果你通过 GitHub 安装本 fork，`require('app-info-parser')` 的使用方式保持不变。

### Browser

可以直接使用仓库中构建后的：

```text
dist/app-info-parser.js
dist/app-info-parser.min.js
```

示例：

```html
<input type="file" id="file" onchange="fileSelect()">
<script src="./dist/app-info-parser.min.js"></script>
<script>
function fileSelect () {
  const files = document.getElementById('file').files
  const parser = new window.AppInfoParser(files[0])

  parser.parse().then(result => {
    console.log('app info ----> ', result)
    console.log('icon ----> ', result.icon)
  }).catch(err => {
    console.error(err)
  })
}
</script>
```

### NPX

原项目提供以下命令：

```shell
npx app-info-parser -f <file-path> -o <output-path>
```

注意：如果直接执行 `npx app-info-parser`，默认仍会获取 npm 上游版本，除非未来本维护版以新的 npm 包名发布。

## API

### `AppInfoParser | ApkParser | IpaParser`

#### `constructor(file)`

- Browser: `Blob` / `File`
- Node.js: 文件路径

#### `parse()`

返回 `Promise<Object>`，解析成功后得到 APK/IPA 信息。

## Build

安装依赖：

```shell
npm install
```

构建浏览器版本：

```shell
npm run dist
```

输出：

```text
dist/app-info-parser.js
dist/app-info-parser.min.js
```

## Versioning

本 fork 从上游 `1.1.6` 继续维护，首个维护版使用：

```text
1.1.7-fixed.1
```

后续版本和具体修复记录见 [CHANGELOG.md](./CHANGELOG.md)。

## Upstream / 原项目

- Original repository: [chenquincy/app-info-parser](https://github.com/chenquincy/app-info-parser)
- Maintained fork: [HAOZI-qwq/app-info-parser](https://github.com/HAOZI-qwq/app-info-parser)

感谢原作者及原项目贡献者提供的基础实现。

## License

MIT License。

本仓库保留原项目的版权和许可证文件：

```text
Copyright (c) 2018 陈秋鑫
```

详见 [LICENSE](./LICENSE)。
