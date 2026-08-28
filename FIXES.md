# Fixes in the maintained fork

This document describes the main compatibility and correctness fixes maintained in `HAOZI-qwq/app-info-parser` compared with upstream `chenquincy/app-info-parser@1.1.6`.

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

### Adaptive icons

Modern Android launcher icons may resolve to XML resources rather than directly to a raster image. The maintained fork avoids labeling XML bytes as `image/png` and improves raster fallback selection.

### Raster icon selection

The icon selector prefers useful higher-density raster resources and recognizes common image formats including:

- PNG
- WebP
- JPEG

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

- https://github.com/HAOZI-qwq/app-info-parser
