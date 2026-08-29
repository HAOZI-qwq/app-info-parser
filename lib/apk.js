const Zip = require('./zip')
const {
  mapInfoResource,
  findApkIconPaths,
  detectImageMimeType,
  getImageDimensions,
  getBase64FromBuffer
} = require('./utils')
const { vectorDrawableToSvg } = require('./vector-drawable')
const { parseAdaptiveIcon, composeAdaptiveIconSvg, normalizeColor } = require('./adaptive-icon')

const ManifestName = /^androidmanifest\.xml$/
const ResourceName = /^resources\.arsc$/

const ManifestXmlParser = require('./xml-parser/manifest')
const ResourceFinder = require('./resource-finder')

function escapeRegExp (value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function resourceKeyFromReference (value) {
  if (typeof value !== 'string' || value.indexOf('resourceId:0x') !== 0) return null
  return '@' + value.slice('resourceId:0x'.length).toUpperCase()
}

function flattenValues (input, output = []) {
  if (Array.isArray(input)) {
    input.forEach(value => flattenValues(value, output))
  } else if (input !== null && input !== undefined) {
    output.push(input)
  }
  return output
}

function largerIcon (current, candidate) {
  if (!candidate) return current
  if (!current) return candidate

  if (candidate.isVector && !current.isVector) return candidate
  if (current.isVector && !candidate.isVector) return current

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

function layerDataUri (layer) {
  if (!layer) return null
  if (layer.dataUri) return layer.dataUri
  if (!layer.color) return null

  const opacity = layer.opacity === undefined ? 1 : layer.opacity
  const opacityAttr = opacity < 0.999999 ? ` fill-opacity="${opacity}"` : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"><rect width="1" height="1" fill="${layer.color}"${opacityAttr}/></svg>`
  return getBase64FromBuffer(Buffer.from(svg, 'utf8'), 'image/svg+xml')
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
    apkInfo.adaptiveIcons = null

    if (!buffers[ResourceName]) {
      return apkInfo
    }

    const resourceMap = this._parseResourceMap(buffers[ResourceName])
    apkInfo = mapInfoResource(apkInfo, resourceMap)

    const iconResult = await this._loadIcon(findApkIconPaths(apkInfo), resourceMap)
    if (iconResult) {
      apkInfo.icon = getBase64FromBuffer(iconResult.buffer, iconResult.mimeType)
      apkInfo.iconPath = iconResult.path
      if (iconResult.adaptiveIcons) apkInfo.adaptiveIcons = iconResult.adaptiveIcons
    }

    return apkInfo
  }

  async _loadIcon (iconPaths, resourceMap) {
    let best = null

    for (const iconPath of iconPaths) {
      const exact = new RegExp('^' + escapeRegExp(iconPath) + '$', 'i')
      let entryBuffer = null

      try {
        entryBuffer = await this.getEntry(exact)
        const mimeType = detectImageMimeType(entryBuffer)
        if (entryBuffer && mimeType) {
          best = largerIcon(best, {
            buffer: entryBuffer,
            mimeType,
            path: iconPath,
            dimensions: getImageDimensions(entryBuffer, mimeType)
          })
          continue
        }
      } catch (e) {
        // Try the next candidate/fallback.
      }

      if (/\.xml$/i.test(iconPath)) {
        if (entryBuffer) {
          const adaptive = await this._loadAdaptiveIcon(entryBuffer, resourceMap, iconPath)
          if (adaptive) {
            best = largerIcon(best, adaptive)
            continue
          }

          const vector = vectorDrawableToSvg(entryBuffer, resourceMap)
          if (vector) {
            best = largerIcon(best, {
              buffer: Buffer.from(vector.svg, 'utf8'),
              mimeType: 'image/svg+xml',
              path: iconPath,
              dimensions: { width: vector.width, height: vector.height },
              isVector: true
            })
            continue
          }
        }

        best = largerIcon(best, await this._findLegacyRasterIcon(iconPath))
      }
    }

    return best
  }

  async _loadAdaptiveIcon (buffer, resourceMap, iconPath) {
    const definition = parseAdaptiveIcon(buffer)
    if (!definition) return null

    const layers = {}
    const publicLayers = {}

    for (const name of ['background', 'foreground', 'monochrome']) {
      if (!definition[name]) continue
      const layer = await this._loadAdaptiveLayer(definition[name], resourceMap)
      if (!layer) continue
      layers[name] = layer
      publicLayers[name] = layerDataUri(layer)
    }

    const svg = composeAdaptiveIconSvg(layers)
    if (!svg) return null

    return {
      buffer: Buffer.from(svg, 'utf8'),
      mimeType: 'image/svg+xml',
      path: iconPath,
      dimensions: { width: 432, height: 432 },
      isVector: true,
      adaptiveIcons: publicLayers
    }
  }

  async _loadAdaptiveLayer (reference, resourceMap) {
    const directColor = normalizeColor(reference.value, reference.type)
    if (directColor && /^(?:rgb|argb)/.test(reference.type || '')) {
      return directColor
    }

    const resourceKey = resourceKeyFromReference(reference.value)
    const values = resourceKey && resourceMap && resourceMap[resourceKey]
      ? flattenValues(resourceMap[resourceKey])
      : [reference.value]

    let best = null

    for (const value of values) {
      if (typeof value === 'string' && /\.(?:png|webp|jpe?g|gif)$/i.test(value)) {
        try {
          const entryBuffer = await this.getEntry(new RegExp('^' + escapeRegExp(value) + '$', 'i'))
          const mimeType = detectImageMimeType(entryBuffer)
          if (!entryBuffer || !mimeType) continue
          best = largerIcon(best, {
            dataUri: getBase64FromBuffer(entryBuffer, mimeType),
            path: value,
            dimensions: getImageDimensions(entryBuffer, mimeType)
          })
        } catch (e) {
          // Continue to other resource configurations.
        }
        continue
      }

      if (typeof value === 'string' && /\.xml$/i.test(value)) {
        try {
          const entryBuffer = await this.getEntry(new RegExp('^' + escapeRegExp(value) + '$', 'i'))
          const vector = vectorDrawableToSvg(entryBuffer, resourceMap)
          if (!vector) continue
          best = largerIcon(best, {
            dataUri: getBase64FromBuffer(Buffer.from(vector.svg, 'utf8'), 'image/svg+xml'),
            path: value,
            dimensions: { width: vector.width, height: vector.height },
            isVector: true
          })
        } catch (e) {
          // Continue to color/other fallbacks.
        }
        continue
      }

      const color = normalizeColor(value, null)
      if (color && !best) best = color
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
