# Fixes in the maintained fork

This document describes the main compatibility and correctness fixes maintained in `HAOZI-qwq/app-info-parser-next` compared with upstream `chenquincy/app-info-parser@1.1.6`.

## Android `resources.arsc`

### Modern resource table entry flags

The upstream parser was designed around older `ResTable_type` layouts and assumed a traditional 32-bit entry offset table.

This fork adds support for modern Android resource table flags, including:

- `FLAG_SPARSE`
- `FLAG_OFFSET16`
- `FLAG_COMPACT`

Resource entries are now located using their actual entry offsets instead of being read as if every entry were packed sequentially.

### Resource reference resolution

Resource references are resolved after the relevant resource table data has been collected, reducing failures caused by reference targets that appear later in the table.

## Android typed values

### Dimension

The previous implementation incorrectly calculated the unit from an uninitialized value and treated Android complex dimensions as a simple integer shift.

The maintained implementation decodes Android complex values using the mantissa/radix representation and preserves the correct unit such as `px`, `dp`, `sp`, `pt`, `in`, and `mm`.

### Fraction

Fractions now use Android complex-value decoding instead of reinterpreting integer bits as an IEEE-754 float.

### Float

`TYPE_FLOAT` values are now handled explicitly instead of falling through to the generic unknown-value path.

## String pools

### UTF-16 resource strings

UTF-16 resource string-pool entries are decoded as UTF-16 instead of UTF-8.

### Index zero

String-pool reference index `0` is treated as a valid string index. Missing references are distinguished from index zero using the appropriate negative/sentinel values.

## `versionName`

The upstream parser sanitized `versionName` with a regular expression that removed spaces, non-ASCII letters and other Unicode characters.

The maintained fork preserves the original manifest value, so examples such as the following remain intact:

```text
Versión 1.0.27
6.0 Beta 03
测试版 1.2.3
```

## APK icons

### R8 / resource shrinking icon paths

Optimized release APKs may flatten or obfuscate resource paths, removing useful names such as `mipmap-xxxhdpi` from the final ZIP entries.

The parser no longer relies only on density names in the path. PNG, WebP, JPEG and GIF candidates are inspected for their intrinsic width and height and the largest real bitmap is preferred.

This avoids selecting a low-resolution icon merely because an optimized APK renamed entries to opaque paths such as `res/d2.webp` or `res/sK.webp`.

### VectorDrawable icons

Some APKs contain no raster launcher icon at all and use a binary Android `VectorDrawable` XML resource as the complete icon.

The maintained fork can parse supported `<vector>` resources and convert them to a standalone SVG Data URI. Supported drawing features include:

- vector width / height / viewport
- `<path>` `pathData`
- fill colors and alpha
- stroke colors, width, alpha, caps, joins and miter limit
- `fillType`
- nested `<group>` transforms
- basic `<clip-path>` handling
- directly encoded colors and simple color resource references

A successfully converted vector is preferred over a raster fallback because it remains sharp at arbitrary display sizes.

For correctness, the converter falls back instead of returning a partially rendered icon when it encounters unsupported path features such as trimmed paths or inline complex-color/gradient children.

### Adaptive icons

Modern Android launcher icons may resolve to XML resources rather than directly to a raster image. The maintained fork avoids labeling XML bytes as `image/png` and improves raster fallback selection.

Full Adaptive Icon foreground/background composition is separate from VectorDrawable conversion and is not yet treated as a complete rasterization engine.

### Raster icon selection

The icon selector recognizes common image formats including:

- PNG
- WebP
- JPEG
- GIF

Intrinsic dimensions are read from the image headers without decoding or recompressing the image.

## Browser ZIP Worker cleanup

The browser ZIP implementation provides a `zipReader.close()` method that terminates its inflater Worker. The upstream integration could leave readers/workers alive after parsing.

The maintained fork closes the reader after use to reduce Worker and memory accumulation during repeated APK/IPA parsing.

## IPA large-icon conversion

The previous browser fallback could spread a large icon buffer into `String.fromCharCode.apply()`, which may throw:

```text
Maximum call stack size exceeded
```

The maintained implementation avoids passing an arbitrarily large byte array as one function-call argument list.

## Error reporting

Manifest and resource parsing errors now preserve the underlying exception information instead of replacing it with a generic message that hides the original cause.

## Compatibility goals

The primary goals of this fork are:

1. Preserve the existing `AppInfoParser` API where practical.
2. Improve parsing correctness on newer Android APKs.
3. Avoid changing original manifest values unnecessarily.
4. Improve long-running browser behavior when parsing multiple packages.
5. Keep the original MIT License and upstream attribution intact.

## Upstream

Original project:

- https://github.com/chenquincy/app-info-parser

Maintained fork:

- https://github.com/HAOZI-qwq/app-info-parser-next
