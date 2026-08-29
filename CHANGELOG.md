# Changelog

All notable changes to this project will be documented in this file.

## 1.2.0 (2026-08-29)

### Android icons

- Add Android Adaptive Icon parsing for `background`, `foreground` and `monochrome` layers.
- Compose Adaptive Icon background and foreground layers into a browser-renderable SVG Data URI while keeping `icon` as a string.
- Expose resolved Adaptive Icon layers through the additive `adaptiveIcons` field.

### Android metadata

- Add APK native ABI detection from `lib/<abi>/*.so` without decompressing native libraries.
- Add `resourceConfigs` with parsed `ResTable_config` locale, density, SDK and device-configuration metadata.
- Keep the existing resource map representation unchanged for compatibility.

### ZIP lifecycle

- Replace the Node-side unzip adapter with a managed `yauzl` implementation that explicitly closes ZIP file descriptors before reads resolve.
- Fix APK/IPA files remaining locked on Windows after `parse()` completes.
- Add Windows CI coverage for immediate rename/delete after ZIP reads.

### iOS

- Add support for directly zipped `.app` bundles in addition to normal IPA `Payload/*.app` layout.
- Keep IPA CgBI and normal image fallback behavior unchanged.

### Types and tests

- Expand TypeScript definitions for browser inputs, icons, Adaptive Icon layers, ABIs, resource configs and iOS fields.
- Add regression tests for Adaptive Icons, ABIs, `ResTable_config`, Node file-handle release and compressed `.app` parsing.

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
