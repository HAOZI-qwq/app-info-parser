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
  getBase64FromBuffer,
  decodeNullUnicode
}
