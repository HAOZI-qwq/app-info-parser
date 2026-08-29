const RES_TABLE_TYPE = 0x0002
const RES_TABLE_PACKAGE_TYPE = 0x0200
const RES_TABLE_TYPE_TYPE = 0x0201

function unpackLocalePart (first, second, base) {
  if (!first && !second) return ''
  if ((first & 0x80) === 0) {
    return String.fromCharCode(first, second).replace(/\u0000/g, '')
  }

  const baseCode = base.charCodeAt(0)
  return String.fromCharCode(
    baseCode + (second & 0x1f),
    baseCode + ((second & 0xe0) >> 5) + ((first & 0x03) << 3),
    baseCode + ((first & 0x7c) >> 2)
  )
}

function densityQualifier (density) {
  if (density === 0) return 'default'
  if (density === 0xffff) return 'nodpi'
  if (density === 0xfffe) return 'anydpi'

  const named = {
    120: 'ldpi',
    160: 'mdpi',
    213: 'tvdpi',
    240: 'hdpi',
    320: 'xhdpi',
    480: 'xxhdpi',
    640: 'xxxhdpi'
  }
  return named[density] || `${density}dpi`
}

function readConfig (buffer, offset, size) {
  const end = offset + size
  const has = (relative, bytes) => offset + relative + bytes <= end
  const u8 = relative => has(relative, 1) ? buffer.readUInt8(offset + relative) : 0
  const u16 = relative => has(relative, 2) ? buffer.readUInt16LE(offset + relative) : 0

  const language = has(8, 2) ? unpackLocalePart(u8(8), u8(9), 'a') : ''
  const region = has(10, 2) ? unpackLocalePart(u8(10), u8(11), '0') : ''
  const locale = language ? language + (region ? `-r${region}` : '') : 'default'
  const density = u16(14)

  return {
    locale,
    language,
    region,
    mcc: u16(4),
    mnc: u16(6),
    orientation: u8(12),
    touchscreen: u8(13),
    density,
    densityQualifier: densityQualifier(density),
    keyboard: u8(16),
    navigation: u8(17),
    inputFlags: u8(18),
    screenWidth: u16(20),
    screenHeight: u16(22),
    sdkVersion: u16(24),
    minorVersion: u16(26),
    screenLayout: u8(28),
    uiMode: u8(29),
    smallestScreenWidthDp: u16(30),
    screenWidthDp: u16(32),
    screenHeightDp: u16(34)
  }
}

function configKey (config) {
  return JSON.stringify(config)
}

function parsePackageConfigs (buffer, packageStart, packageSize, packageHeaderSize, configs, seen) {
  let offset = packageStart + packageHeaderSize
  const packageEnd = packageStart + packageSize

  while (offset + 8 <= packageEnd) {
    const type = buffer.readUInt16LE(offset)
    const headerSize = buffer.readUInt16LE(offset + 2)
    const chunkSize = buffer.readUInt32LE(offset + 4)
    if (chunkSize < 8 || offset + chunkSize > packageEnd) break

    if (type === RES_TABLE_TYPE_TYPE && headerSize >= 24 && offset + headerSize <= packageEnd) {
      const configSize = buffer.readUInt32LE(offset + 20)
      if (configSize >= 4 && configSize <= headerSize - 20 && offset + 20 + configSize <= packageEnd) {
        const config = readConfig(buffer, offset + 20, configSize)
        const key = configKey(config)
        if (!seen.has(key)) {
          seen.add(key)
          configs.push(config)
        }
      }
    }

    offset += chunkSize
  }
}

function parseResourceConfigs (buffer) {
  if (!buffer || buffer.length < 12 || buffer.readUInt16LE(0) !== RES_TABLE_TYPE) {
    return { locales: [], densities: [], sdkVersions: [], configurations: [] }
  }

  const tableHeaderSize = buffer.readUInt16LE(2)
  const tableSize = Math.min(buffer.readUInt32LE(4), buffer.length)
  const configurations = []
  const seen = new Set()

  let offset = tableHeaderSize
  while (offset + 8 <= tableSize) {
    const type = buffer.readUInt16LE(offset)
    const headerSize = buffer.readUInt16LE(offset + 2)
    const chunkSize = buffer.readUInt32LE(offset + 4)
    if (chunkSize < 8 || offset + chunkSize > tableSize) break

    if (type === RES_TABLE_PACKAGE_TYPE && headerSize >= 8) {
      parsePackageConfigs(buffer, offset, chunkSize, headerSize, configurations, seen)
    }

    offset += chunkSize
  }

  const locales = Array.from(new Set(configurations.map(config => config.locale)))
  const densities = Array.from(new Set(configurations.map(config => config.densityQualifier)))
  const sdkVersions = Array.from(new Set(configurations.map(config => config.sdkVersion))).sort((a, b) => a - b)

  return {
    locales,
    densities,
    sdkVersions,
    configurations
  }
}

module.exports = {
  parseResourceConfigs,
  readConfig,
  densityQualifier,
  unpackLocalePart
}
