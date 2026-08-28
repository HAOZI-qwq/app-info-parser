const Zip = require('./zip')
const {
  mapInfoResource,
  findApkIconPaths,
  detectImageMimeType,
  getImageDimensions,
  getBase64FromBuffer
} = require('./utils')

const ManifestName = /^androidmanifest\.xml$/
const ResourceName = /^resources\.arsc$/

const ManifestXmlParser = require('./xml-parser/manifest')
const ResourceFinder = require('./resource-finder')

function escapeRegExp (value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function largerIcon (current, candidate) {
  if (!candidate) return current
  if (!current) return candidate

  const a = current.dimensions || { width: 0, height: 0 }
  const b = candidate.dimensions || { width: 0, height: 0 }
  const areaA = a.width * a.height
  const areaB = b.width * b.height

  if (areaB > areaA) return candidate
  if (areaB < areaA) return current

  return Math.max(b.width, b.height) > Math.max(a.width, a.height)
    ? candidate
    : current
}

class ApkParser extends Zip {
  /**
   * parser for parsing .apk file
   * @param {String | File | Blob} file // file's path in Node, instance of File or Blob in Browser
   */
  constructor (file) {
    super(file)
    if (!(this instanceof ApkParser)) {
      return new ApkParser(file)
    }
  }

  async parse () {
    const buffers = await this.getEntries([ManifestName, ResourceName])
    if (!buffers[ManifestName]) {
      throw new Error('AndroidManifest.xml can\'t be found.')
    }

    let apkInfo = this._parseManifest(buffers[ManifestName])
    apkInfo.icon = null
    apkInfo.iconPath = null

    if (!buffers[ResourceName]) {
      return apkInfo
    }

    const resourceMap = this._parseResourceMap(buffers[ResourceName])
    apkInfo = mapInfoResource(apkInfo, resourceMap)

    const iconResult = await this._loadIcon(findApkIconPaths(apkInfo))
    if (iconResult) {
      apkInfo.icon = getBase64FromBuffer(iconResult.buffer, iconResult.mimeType)
      apkInfo.iconPath = iconResult.path
    }

    return apkInfo
  }

  async _loadIcon (iconPaths) {
    let best = null

    for (const iconPath of iconPaths) {
      const exact = new RegExp('^' + escapeRegExp(iconPath) + '$', 'i')
      try {
        const buffer = await this.getEntry(exact)
        const mimeType = detectImageMimeType(buffer)
        if (buffer && mimeType) {
          best = largerIcon(best, {
            buffer,
            mimeType,
            path: iconPath,
            dimensions: getImageDimensions(buffer, mimeType)
          })
          continue
        }
      } catch (e) {
        // Try the next candidate/fallback.
      }

      if (/\.xml$/i.test(iconPath)) {
        best = largerIcon(best, await this._findLegacyRasterIcon(iconPath))
      }
    }

    return best
  }

  async _findLegacyRasterIcon (xmlPath) {
    const fileName = xmlPath.split('/').pop() || ''
    const stem = fileName.replace(/\.xml$/i, '')
    if (!stem) return null

    const densityOrder = ['xxxhdpi', 'xxhdpi', 'xhdpi', 'hdpi', 'mdpi', 'ldpi']
    for (const density of densityOrder) {
      const regex = new RegExp(
        '^res/(?:mipmap|drawable)-' + density + '(?:-[^/]*)?/' +
        escapeRegExp(stem) + '\\.(?:png|webp|jpe?g|gif)$',
        'i'
      )
      try {
        const buffer = await this.getEntry(regex)
        const mimeType = detectImageMimeType(buffer)
        if (buffer && mimeType) {
          return {
            buffer,
            mimeType,
            path: `legacy:${stem}:${density}`,
            dimensions: getImageDimensions(buffer, mimeType)
          }
        }
      } catch (e) {
        // Continue through lower densities.
      }
    }

    const anyDensity = new RegExp(
      '^res/(?:mipmap|drawable)(?:-[^/]*)?/' +
      escapeRegExp(stem) + '\\.(?:png|webp|jpe?g|gif)$',
      'i'
    )
    try {
      const buffer = await this.getEntry(anyDensity)
      const mimeType = detectImageMimeType(buffer)
      if (buffer && mimeType) {
        return {
          buffer,
          mimeType,
          path: `legacy:${stem}`,
          dimensions: getImageDimensions(buffer, mimeType)
        }
      }
    } catch (e) {
      // No browser-renderable fallback exists.
    }

    return null
  }

  /**
   * Parse manifest
   * @param {Buffer} buffer // manifest file's buffer
   */
  _parseManifest (buffer) {
    try {
      const parser = new ManifestXmlParser(buffer)
      return parser.parse()
    } catch (e) {
      const error = new Error('Parse AndroidManifest.xml error: ' + (e && e.message ? e.message : e))
      error.cause = e
      throw error
    }
  }

  /**
   * Parse resourceMap
   * @param {Buffer} buffer // resourceMap file's buffer
   */
  _parseResourceMap (buffer) {
    try {
      return new ResourceFinder().processResourceTable(buffer)
    } catch (e) {
      const error = new Error('Parser resources.arsc error: ' + (e && e.message ? e.message : e))
      error.cause = e
      throw error
    }
  }
}

module.exports = ApkParser
