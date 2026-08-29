# app-info-parser-next

> A maintained fork of [chenquincy/app-info-parser](https://github.com/chenquincy/app-info-parser), focused on modern APK/IPA parsing compatibility and bug fixes

一个用于解析 `.apk` / `.ipa` / 压缩 `.app` 应用信息的 JavaScript 解析器，支持 Node.js 和浏览器环境

解析结果主要来自 Android `AndroidManifest.xml`、`resources.arsc` 以及 iOS `Info.plist` / `embedded.mobileprovision`

## About this fork / 关于本维护版

本项目基于原项目 [chenquincy/app-info-parser](https://github.com/chenquincy/app-info-parser) 维护

原项目由 Quincy Chen（陈秋鑫）开发，并以 MIT License 开源

上游项目已声明不再继续功能维护，因此本 fork 在尽量保持原 API 和使用方式兼容的前提下，继续修复现代 Android APK 资源格式、图标解析、Unicode 字符串及浏览器资源释放等问题

> 本 fork 不代表原作者，也不会修改或移除原项目的版权与 MIT License 声明

## Main improvements / 主要改进

相较上游 `1.1.6`，本维护版主要修复和改进：

- 支持现代 Android `resources.arsc` 资源表结构
- 支持 `FLAG_SPARSE`
- 支持 `FLAG_OFFSET16`
- 支持 `FLAG_COMPACT`
- 按真实 resource entry offset 定位资源项
- 修复资源引用解析顺序问题
- 解析 `ResTable_config`，输出 locale、density、sdkVersion 等配置摘要
- 保留 Unicode、空格及特殊字符形式的 `versionName`
- 修复 UTF-16 String Pool 解码
- 修复 String Pool 索引 `0` 被误判为空的问题
- 修复 Android `dimension` / `fraction` / `float` 类型解析
- 改进 APK 图标选择逻辑
- R8 / resource shrinking 后即使图标路径被压缩或混淆，也会读取真实图片尺寸并选择最大位图
- 支持 Android VectorDrawable XML 图标转换为 SVG
- 支持 Adaptive Icon 的 background / foreground / monochrome 解析
- 支持把 Adaptive Icon background + foreground 合成为可直接显示的 SVG 图标
- 纯 VectorDrawable 且没有 PNG / WebP fallback 的 APK 也可以正常返回图标
- 避免将 Adaptive Icon XML 错误标记为 PNG
- 支持 PNG / WebP / JPEG / GIF 图标 MIME 与真实尺寸识别
- 支持读取 APK 原生 ABI 列表，例如 `arm64-v8a` / `armeabi-v7a` / `x86_64`
- 修复 Node.js 解析完成后 APK / IPA 文件句柄未释放的问题
- 修复浏览器 ZIP Worker 未释放导致的资源泄漏
- 支持直接解析压缩后的 `.app` ZIP 包
- 修复 IPA 大图标转换时可能出现的 `Maximum call stack size exceeded`
- 完善 TypeScript 类型定义
- 改进 Manifest / resources 解析异常信息，保留原始错误原因

详细说明见 [FIXES.md](./FIXES.md)

## Support

- Node.js ✅
- Browser ✅（IE 除外）
- APK ✅
- IPA ✅
- zipped `.app` ✅
- NPX ✅

## Installation

### 安装此维护版

当前 `npm install app-info-parser` 指向的是上游 npm 包，并不是本 fork

如果需要直接使用本仓库版本，可以从 GitHub 安装：

```shell
npm install github:HAOZI-qwq/app-info-parser-next
```

或者：

```shell
yarn add github:HAOZI-qwq/app-info-parser-next
```

### 上游 npm 包

如果你明确需要原版 `1.1.6`：

```shell
npm install app-info-parser
```

## Getting started

### Node.js

```javascript
const AppInfoParser = require('app-info-parser-next')

const parser = new AppInfoParser('../packages/test.apk') // xxx.apk / xxx.ipa / zipped xxx.app
parser.parse().then(result => {
  console.log('app info ----> ', result)
  console.log('icon ----> ', result.icon)
}).catch(err => {
  console.log('err ----> ', err)
})
```

如果通过 GitHub 安装本 fork，包名为 `app-info-parser-next`

### Browser

可以直接使用仓库中构建后的：

```text
dist/app-info-parser-next.js
dist/app-info-parser-next.min.js
```

示例：

```html
<input type="file" id="file" onchange="fileSelect()">
<script src="./dist/app-info-parser-next.min.js"></script>
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

注意：如果直接执行 `npx app-info-parser`，默认仍会获取 npm 上游版本，除非未来本维护版以新的 npm 包名发布

## API

### `AppInfoParser | ApkParser | IpaParser`

#### `constructor(file)`

- Browser: `Blob` / `File`
- Node.js: 文件路径
- 支持 `.apk` / `.ipa` / 压缩 `.app` 的 `.zip`

#### `parse()`

返回 `Promise<Object>`，解析成功后得到应用信息

APK 的 `result.icon` 可能是 PNG / WebP / JPEG / GIF Data URI，也可能是由 VectorDrawable 或 Adaptive Icon 生成的 `data:image/svg+xml;base64,...`

`result.iconPath` 会保留最终选中的 APK 内部图标资源路径

Adaptive Icon 成功解析时会额外返回：

```javascript
result.adaptiveIcons = {
  background: 'data:...',
  foreground: 'data:...',
  monochrome: 'data:...'
}
```

APK 原生库架构：

```javascript
result.abis
// ['armeabi-v7a', 'arm64-v8a']
```

Android 资源配置摘要：

```javascript
result.resourceConfigs.locales
result.resourceConfigs.densities
result.resourceConfigs.sdkVersions
result.resourceConfigs.configurations
```

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
dist/app-info-parser-next.js
dist/app-info-parser-next.min.js
```

### Automatic build / 自动编译

仓库中的 GitHub Actions 会在 `master` 的核心源码、测试或构建配置发生变化时自动执行：

```text
安装依赖 → 回归测试 → 编译 dist → 校验 → 自动提交新的 dist
```

Windows CI 还会额外测试 Node ZIP 文件句柄是否正确释放，以及压缩 `.app` 是否可以正常解析

自动编译只更新构建产物，**不会自动创建 GitHub Release**

## Release / 发布版本

本仓库提供单独的 `Release` GitHub Actions 工作流，采用手动触发，避免普通代码修改被误发布为正式版本

发布时只需要：

1. 确认 `package.json` 中的 `version` 是你要发布的版本
2. 在 `CHANGELOG.md` 中准备同版本的中英双语更新日志章节
3. 打开 GitHub 仓库的 **Actions** 页面
4. 左侧选择 **Release**
5. 点击 **Run workflow**
6. 工作流会自动运行测试和编译
7. 自动从 `CHANGELOG.md` 提取当前版本章节作为中英双语 Release Notes
8. 自动创建对应的 Git Tag，例如 `v1.2.0`
9. 自动创建 GitHub Release
10. 自动把以下文件作为 Release 附件上传

```text
dist/app-info-parser-next.js
dist/app-info-parser-next.min.js
```

GitHub 还会自动为每个 Release 提供源码的 `.zip` 和 `.tar.gz` 下载包

如果同版本的 Release 已经存在，再次运行工作流会更新该版本的双语 Release Notes，并覆盖上传最新的 `dist` 附件，不会重复创建版本

## Versioning

本 fork 从上游 `1.1.6` 继续维护

首个维护版为 `1.1.7-fixed.1`，当前开发版本为 `1.2.0`，具体修复记录见 [CHANGELOG.md](./CHANGELOG.md)

## Upstream / 原项目

- Original repository: [chenquincy/app-info-parser](https://github.com/chenquincy/app-info-parser)
- Maintained fork: [HAOZI-qwq/app-info-parser-next](https://github.com/HAOZI-qwq/app-info-parser-next)

感谢原作者及原项目贡献者提供的基础实现

## License

MIT License

本仓库保留原项目的版权和许可证文件：

```text
Copyright (c) 2018 陈秋鑫
```

详见 [LICENSE](./LICENSE)
