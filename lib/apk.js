const Zip = require('./zip')
const {
  mapInfoResource,
  findApkIconPaths,
  detectImageMimeType,
  getBase64FromBuffer
} = require('./utils')

const ManifestName = /^androidmanifest\.xml$/
const ResourceName = /^resources\.arsc$/

const ManifestXmlParser = require('./xml-parser/manifest')
const ResourceFinder = require('./resource-finder')

function escapeRegExp (value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
    for (const iconPath of iconPaths) {
      const exact = new RegExp('^' + escapeRegExp(iconPath) + '$', 'i')
      try {
        const iconBuffer = await this.getEntry(exact)
        const mimeType = detectImageMimeType(iconBuffer)
        if (iconBuffer && mimeType) {
          return { buffer: iconBuffer, mimeType, path: iconPath }
        }
      } catch (e) {
        // Try the next candidate/fallback.
      }

      // Adaptive icons and vector drawables are XML resources. They cannot be
      // labelled as image/png. Prefer a legacy density-specific raster with the
      // same resource name when one exists in the APK.
      if (/\.xml$/i.test(iconPath)) {
        const legacy = await this._findLegacyRasterIcon(iconPath)
        if (legacy) return legacy
      }
    }

    return null
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
          return { buffer, mimeType, path: `legacy:${stem}:${density}` }
        }
      } catch (e) {
        // Continue through lower densities.
      }
    }

    // Last chance: a raster resource with the same name in any drawable/mipmap
    // configuration. This covers uncommon qualifier combinations.
    const anyDensity = new RegExp(
      '^res/(?:mipmap|drawable)(?:-[^/]*)?/' +
      escapeRegExp(stem) + '\\.(?:png|webp|jpe?g|gif)$',
      'i'
    )
    try {
      const buffer = await this.getEntry(anyDensity)
      const mimeType = detectImageMimeType(buffer)
      if (buffer && mimeType) {
        return { buffer, mimeType, path: `legacy:${stem}` }
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
      // The old code passed an `ignore` option that BinaryXmlParser never
      // implemented. Removing the dead option makes behavior explicit and keeps
      // launcher/activity parsing intact.
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
