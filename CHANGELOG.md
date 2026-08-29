# Changelog / 更新日志

All notable changes to this project will be documented in this file / 本文件记录项目的重要版本变更

## 1.2.0 (2026-08-29)

### Android icons / Android 图标

- Add Android Adaptive Icon parsing for `background`, `foreground` and `monochrome` layers / 新增 Android Adaptive Icon 解析，支持 `background`、`foreground` 和 `monochrome` 图层
- Compose Adaptive Icon background and foreground layers into a browser-renderable SVG Data URI while keeping `icon` as a string / 支持将 Adaptive Icon 背景与前景合成为浏览器可直接显示的 SVG Data URI，同时保持 `icon` 为字符串类型
- Expose resolved Adaptive Icon layers through the additive `adaptiveIcons` field / 新增 `adaptiveIcons` 字段，可分别获取解析后的 Adaptive Icon 各图层

### Android metadata / Android 元数据

- Add APK native ABI detection from `lib/<abi>/*.so` without decompressing native libraries / 新增 APK 原生 ABI 架构识别，通过 `lib/<abi>/*.so` 判断且无需解压原生库
- Add `resourceConfigs` with parsed `ResTable_config` locale, density, SDK and device-configuration metadata / 新增 `resourceConfigs`，解析 `ResTable_config` 中的语言地区、密度、SDK 及设备配置等元数据
- Keep the existing resource map representation unchanged for compatibility / 保持原有 resource map 数据结构不变，避免破坏现有兼容性

### ZIP lifecycle / ZIP 生命周期

- Replace the Node-side unzip adapter with a managed `yauzl` implementation that explicitly closes ZIP file descriptors before reads resolve / 重写 Node.js ZIP 读取层，使用受控的 `yauzl` 实现，在读取完成前主动关闭 ZIP 文件描述符
- Fix APK/IPA files remaining locked on Windows after `parse()` completes / 修复 Windows 下 `parse()` 完成后 APK/IPA 文件仍被占用的问题
- Add Windows CI coverage for immediate rename/delete after ZIP reads / 新增 Windows CI 测试，验证 ZIP 读取后可立即重命名和删除文件

### iOS

- Add support for directly zipped `.app` bundles in addition to normal IPA `Payload/*.app` layout / 除标准 IPA 的 `Payload/*.app` 结构外，新增直接压缩 `.app` Bundle 的解析支持
- Keep IPA CgBI and normal image fallback behavior unchanged / 保持 IPA CgBI 图标转换及普通图片回退逻辑不变

### Types and tests / 类型与测试

- Expand TypeScript definitions for browser inputs, icons, Adaptive Icon layers, ABIs, resource configs and iOS fields / 完善 TypeScript 类型定义，覆盖浏览器输入、图标、Adaptive Icon 图层、ABI、资源配置及 iOS 字段
- Add regression tests for Adaptive Icons, ABIs, `ResTable_config`, Node file-handle release and compressed `.app` parsing / 新增 Adaptive Icon、ABI、`ResTable_config`、Node 文件句柄释放及压缩 `.app` 解析的回归测试

---

## 1.1.8 (2026-08-29)

### APK icons

- Select optimized/R8 raster icon resources using their real image dimensions instead of relying only on density names in resource paths.
- Add intrinsic size detection for PNG, WebP, JPEG and GIF icons.
- Fix low-resolution launcher icons when resource shrinking flattens or obfuscates paths such as `mipmap-xxxhdpi`.
- Add Android VectorDrawable parsing and conversion to SVG Data URIs.
- Prefer successfully converted VectorDrawable icons over raster fallbacks so vector-only APKs can return a sharp icon instead of `null`.
- Add support for VectorDrawable paths, fill/stroke attributes, nested groups and basic clip paths.
- Keep fallback behavior for unsupported complex vector features rather than returning an incomplete image.

### Tests and browser build

- Add regression coverage for obfuscated R8-style icon paths.
- Add binary Android XML VectorDrawable regression tests.
- Rebuild `dist/app-info-parser-next.js` and `dist/app-info-parser-next.min.js` through GitHub Actions.

---

## 1.1.7-fixed.1 (2026-08-28)

First maintained-fork release based on upstream `1.1.6`.

### Android resource table

- Add support for modern `resources.arsc` entry layouts.
- Add `FLAG_SPARSE` handling.
- Add `FLAG_OFFSET16` handling.
- Add `FLAG_COMPACT` handling.
- Use actual resource entry offsets instead of assuming sequential entries.
- Improve resource reference resolution order.

### Android typed values

- Fix `dimension` complex-value decoding and units.
- Fix `fraction` complex-value decoding.
- Add explicit `TYPE_FLOAT` parsing.

### Strings and manifest values

- Fix UTF-16 resource string-pool decoding.
- Treat string-pool index `0` as valid.
- Preserve Unicode, spaces and special characters in `versionName`.

### Icons

- Improve APK launcher icon selection.
- Avoid treating Adaptive Icon XML as PNG data.
- Add PNG / WebP / JPEG MIME recognition for extracted icons.

### Browser and IPA

- Close ZIP readers and inflater Workers after use to reduce resource leaks during repeated parsing.
- Avoid large `String.fromCharCode.apply()` argument lists when converting IPA icons in browsers.

### Diagnostics

- Preserve underlying Manifest and `resources.arsc` parsing errors for easier debugging.

### Project maintenance

- Mark this repository as a maintained fork of `chenquincy/app-info-parser`.
- Preserve the original MIT License and upstream attribution.
- Add `FIXES.md` with detailed compatibility notes.

---

## Upstream changelog

The entries below are preserved from the original project.

### [1.1.6](https://github.com/chenquincy/app-info-parser/compare/v1.1.2...v1.1.6) (2024-01-08)

### Bug Fixes

* add attribute uses-permisson-sdk-23 ([4e6af71](https://github.com/chenquincy/app-info-parser/commit/4e6af7189ea843bd475fc808b7e126cee9011196))
* **ipa:** match shorter path of info.plist ([e74fa87](https://github.com/chenquincy/app-info-parser/commit/e74fa87590f4d16e8a0f162f085b8e2308089868)), closes [#86](https://github.com/chenquincy/app-info-parser/issues/86)
* without mini files ([61d4337](https://github.com/chenquincy/app-info-parser/commit/61d43372be186996ca8def5617d938a88924ddfb))

### [1.1.5](https://github.com/chenquincy/app-info-parser/compare/v1.1.4...v1.1.5) (2023-05-08)

### Bug Fixes

* **ipa:** match shorter path of info.plist ([e74fa87](https://github.com/chenquincy/app-info-parser/commit/e74fa87590f4d16e8a0f162f085b8e2308089868)), closes [#86](https://github.com/chenquincy/app-info-parser/issues/86)

### [1.1.4](https://github.com/chenquincy/app-info-parser/compare/v1.1.2...v1.1.4) (2022-08-08)

### Bug Fixes

* add attribute uses-permisson-sdk-23 ([4e6af71](https://github.com/chenquincy/app-info-parser/commit/4e6af7189ea843bd475fc808b7e126cee9011196))

### [1.1.3](https://github.com/dk-plus/app-info-parser/compare/v1.1.2...v1.1.3) (2021-07-28)

### Bug Fixes

* add attribute uses-permisson-sdk-23 ([4e6af71](https://github.com/dk-plus/app-info-parser/commit/4e6af7189ea843bd475fc808b7e126cee9011196))

### [1.1.2](https://github.com/chenquincy/app-info-parser/compare/v1.1.1...v1.1.2) (2021-06-15)

### Bug Fixes

* **ApkParser:** versionName special chars filter ([de6db75](https://github.com/chenquincy/app-info-parser/commit/de6db75493abeed15ded2fe91328a2ea7a3ea5f4)), closes [#61](https://github.com/chenquincy/app-info-parser/issues/61)

### [1.1.1](https://github.com/chenquincy/app-info-parser/compare/v1.1.0...v1.1.1) (2021-06-11)

### Bug Fixes

* **$npx:** dependency error ([347a677](https://github.com/chenquincy/app-info-parser/commit/347a677e5b083ba505a9599054f4ab7927e3aeeb)), closes [#62](https://github.com/chenquincy/app-info-parser/issues/62)

## [1.1.0](https://github.com/chenquincy/app-info-parser/compare/v1.0.1-alpha.1...v1.1.0) (2021-05-08)

### Features

* support npx ([469c602](https://github.com/chenquincy/app-info-parser/commit/469c60259f6319c654a01eca8ffcd8558ad48633))

Older upstream releases remain available in the original repository history:

- https://github.com/chenquincy/app-info-parser/blob/master/CHANGELOG.md
