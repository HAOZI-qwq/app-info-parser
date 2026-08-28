function objectType (o) {
  return Object.prototype.toString.call(o).slice(8, -1).toLowerCase()
}

function isArray (o) {
  return objectType(o) === 'array'
}

function isObject (o) {
  return objectType(o) === 'object'
}

function isPrimitive (o) {
  return o === null || ['boolean', 'number', 'string', 'undefined'].includes(objectType(o))
}

function isBrowser () {
  return (
    typeof process === 'undefined' ||
    Object.prototype.toString.call(process) !== '[object process]'
  )
}

/**
 * map file place with resourceMap
 * @param {Object} apkInfo // json info parsed from .apk file
 * @param {Object} resourceMap // resourceMap
 */
function mapInfoResource (apkInfo, resourceMap) {
  iteratorObj(apkInfo)
  return apkInfo

  function iteratorObj (obj) {
    for (var i in obj) {
      if (isArray(obj[i])) {
        iteratorArray(obj[i])
      } else if (isObject(obj[i])) {
        iteratorObj(obj[i])
      } else if (isPrimitive(obj[i])) {
        if (isResources(obj[i])) {
          const mapped = resourceMap[transKeyToMatchResourceMap(obj[i])]
          // Keep the original resource id when the table could not resolve it.
          // Replacing it with undefined makes later fallback logic impossible.
          if (mapped && mapped.length) obj[i] = mapped
        }
      }
    }
  }

  function iteratorArray (array) {
    const l = array.length
    for (let i = 0; i < l; i++) {
      if (isArray(array[i])) {
        iteratorArray(array[i])
      } else if (isObject(array[i])) {
        iteratorObj(array[i])
      } else if (isPrimitive(array[i])) {
        if (isResources(array[i])) {
          const mapped = resourceMap[transKeyToMatchResourceMap(array[i])]
          if (mapped && mapped.length) array[i] = mapped
        }
      }
    }
  }

  function isResources (attrValue) {
    if (!attrValue) return false
    if (typeof attrValue !== 'string') attrValue = attrValue.toString()
    return attrValue.indexOf('resourceId:') === 0
  }

  function transKeyToMatchResourceMap (resourceId) {
    return '@' + resourceId.replace('resourceId:0x', '').toUpperCase()
  }
}

function flattenStrings (input, output = []) {
  if (isArray(input)) {
    input.forEach(value => flattenStrings(value, output))
  } else if (typeof input === 'string') {
    output.push(input)
  }
  return output
}

function iconDensityScore (path) {
  const value = path.toLowerCase()
  if (value.indexOf('xxxhdpi') !== -1) return 600
  if (value.indexOf('xxhdpi') !== -1) return 500
  if (value.indexOf('xhdpi') !== -1) return 400
  if (value.indexOf('hdpi') !== -1) return 300
  if (value.indexOf('mdpi') !== -1) return 200
  if (value.indexOf('ldpi') !== -1) return 100
  return 0
}

function isRasterImagePath (path) {
  return /\.(?:png|webp|jpe?g|gif)$/i.test(path)
}

/**
 * Return APK icon candidates ordered from most useful to least useful.
 * Raster icons are preferred over adaptive/vector XML resources.
 * Density names are only a hint: optimized APKs may flatten/obfuscate resource
 * paths, so ApkParser also compares the intrinsic dimensions of each image.
 */
function findApkIconPaths (info) {
  if (!info || !info.application || !info.application.icon) return []

  const icons = flattenStrings(info.application.icon)
    .filter(icon => icon && icon.indexOf('resourceId:') !== 0)

  const unique = []
  icons.forEach(icon => {
    if (unique.indexOf(icon) === -1) unique.push(icon)
  })

  return unique.sort((a, b) => {
    const rasterA = isRasterImagePath(a) ? 10000 : 0
    const rasterB = isRasterImagePath(b) ? 10000 : 0
    const mipmapA = /(^|\/)mipmap/i.test(a) ? 25 : 0
    const mipmapB = /(^|\/)mipmap/i.test(b) ? 25 : 0
    return (rasterB + iconDensityScore(b) + mipmapB) - (rasterA + iconDensityScore(a) + mipmapA)
  })
}

/**
 * find .apk file's icon path from json info
 * @param info // json info parsed from .apk file
 */
function findApkIconPath (info) {
  return findApkIconPaths(info)[0] || ''
}

/**
 * find .ipa file's icon path from json info
 * @param info // json info parsed from .ipa file
 */
function findIpaIconPath (info) {
  if (
    info.CFBundleIcons &&
    info.CFBundleIcons.CFBundlePrimaryIcon &&
    info.CFBundleIcons.CFBundlePrimaryIcon.CFBundleIconFiles &&
    info.CFBundleIcons.CFBundlePrimaryIcon.CFBundleIconFiles.length
  ) {
    return info.CFBundleIcons.CFBundlePrimaryIcon.CFBundleIconFiles[info.CFBundleIcons.CFBundlePrimaryIcon.CFBundleIconFiles.length - 1]
  } else if (info.CFBundleIconFiles && info.CFBundleIconFiles.length) {
    return info.CFBundleIconFiles[info.CFBundleIconFiles.length - 1]
  } else {
    return '.app/Icon.png'
  }
}

function detectImageMimeType (buffer) {
  if (!buffer || typeof buffer.length !== 'number') return null

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) return 'image/png'

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }

  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) return 'image/webp'

  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61
  ) return 'image/gif'

  return null
}

function readUInt16LE (buffer, offset) {
  return (buffer[offset] | (buffer[offset + 1] << 8)) >>> 0
}

function readUInt16BE (buffer, offset) {
  return ((buffer[offset] << 8) | buffer[offset + 1]) >>> 0
}

function readUInt24LE (buffer, offset) {
  return (buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16)) >>> 0
}

function readUInt32BE (buffer, offset) {
  return (
    (buffer[offset] * 0x1000000) +
    (buffer[offset + 1] << 16) +
    (buffer[offset + 2] << 8) +
    buffer[offset + 3]
  ) >>> 0
}

/**
 * Read intrinsic image dimensions without decoding or re-encoding the image.
 * Supports PNG, WebP (VP8/VP8L/VP8X), JPEG and GIF.
 */
function getImageDimensions (buffer, mimeType) {
  if (!buffer || typeof buffer.length !== 'number') return null
  const type = mimeType || detectImageMimeType(buffer)

  if (type === 'image/png' && buffer.length >= 24) {
    const width = readUInt32BE(buffer, 16)
    const height = readUInt32BE(buffer, 20)
    return width && height ? { width, height } : null
  }

  if (type === 'image/gif' && buffer.length >= 10) {
    const width = readUInt16LE(buffer, 6)
    const height = readUInt16LE(buffer, 8)
    return width && height ? { width, height } : null
  }

  if (type === 'image/webp' && buffer.length >= 20) {
    const chunk = String.fromCharCode(buffer[12], buffer[13], buffer[14], buffer[15])

    if (chunk === 'VP8X' && buffer.length >= 30) {
      const width = readUInt24LE(buffer, 24) + 1
      const height = readUInt24LE(buffer, 27) + 1
      return { width, height }
    }

    if (
      chunk === 'VP8 ' && buffer.length >= 30 &&
      buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a
    ) {
      const width = readUInt16LE(buffer, 26) & 0x3fff
      const height = readUInt16LE(buffer, 28) & 0x3fff
      return width && height ? { width, height } : null
    }

    if (chunk === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
      const bits = (
        buffer[21] |
        (buffer[22] << 8) |
        (buffer[23] << 16) |
        (buffer[24] << 24)
      ) >>> 0
      const width = (bits & 0x3fff) + 1
      const height = ((bits >>> 14) & 0x3fff) + 1
      return { width, height }
    }

    return null
  }

  if (type === 'image/jpeg' && buffer.length >= 4) {
    let offset = 2
    while (offset + 3 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset++
        continue
      }

      while (offset < buffer.length && buffer[offset] === 0xff) offset++
      if (offset >= buffer.length) break

      const marker = buffer[offset]
      offset++

      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        continue
      }

      if (offset + 1 >= buffer.length) break
      const segmentLength = readUInt16BE(buffer, offset)
      if (segmentLength < 2 || offset + segmentLength > buffer.length) break

      const isSof = (
        marker >= 0xc0 && marker <= 0xcf &&
        marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
      )

      if (isSof && segmentLength >= 7 && offset + 6 < buffer.length) {
        const height = readUInt16BE(buffer, offset + 3)
        const width = readUInt16BE(buffer, offset + 5)
        return width && height ? { width, height } : null
      }

      offset += segmentLength
    }
  }

  return null
}

/**
 * transform buffer to base64 data URI
 * @param {Buffer} buffer
 * @param {String} mimeType optional explicit mime type
 */
function getBase64FromBuffer (buffer, mimeType) {
  if (!buffer) return null
  const type = mimeType || detectImageMimeType(buffer) || 'application/octet-stream'
  return `data:${type};base64,` + buffer.toString('base64')
}

/**
 * 去除unicode空字符
 * @param {String} str
 */
function decodeNullUnicode (str) {
  if (typeof str === 'string') {
    // eslint-disable-next-line
    str = str.replace(/\u0000/g, '')
  }
  return str
}

module.exports = {
  isArray,
  isObject,
  isPrimitive,
  isBrowser,
  mapInfoResource,
  findApkIconPath,
  findApkIconPaths,
  findIpaIconPath,
  isRasterImagePath,
  detectImageMimeType,
  getImageDimensions,
  getBase64FromBuffer,
  decodeNullUnicode
}
