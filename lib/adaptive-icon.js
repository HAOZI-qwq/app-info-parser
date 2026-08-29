const BinaryXmlParser = require('./xml-parser/binary')

const LAYER_NAMES = ['background', 'foreground', 'monochrome']

function findAttribute (node, name) {
  if (!node || !Array.isArray(node.attributes)) return null
  return node.attributes.find(attr => attr && (attr.name === name || attr.nodeName === name)) || null
}

function layerReference (node) {
  const attr = findAttribute(node, 'drawable')
  if (!attr) return null

  const typed = attr.typedValue || {}
  const value = typed.value !== null && typed.value !== undefined
    ? typed.value
    : attr.value

  if (value === null || value === undefined) return null

  return {
    value,
    type: typed.type || null,
    rawType: typed.rawType === undefined ? null : typed.rawType
  }
}

function parseAdaptiveIcon (buffer) {
  try {
    const document = new BinaryXmlParser(buffer).parse()
    if (!document || document.nodeName !== 'adaptive-icon') return null

    const result = {}
    for (const child of document.childNodes || []) {
      if (!child || LAYER_NAMES.indexOf(child.nodeName) === -1) continue
      const reference = layerReference(child)
      if (reference) result[child.nodeName] = reference
    }

    return Object.keys(result).length ? result : null
  } catch (e) {
    return null
  }
}

function escapeXml (value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function normalizeColor (value, type) {
  if (value === null || value === undefined) return null

  let hex = null
  if (typeof value === 'number' && Number.isFinite(value)) {
    hex = ('00000000' + (value >>> 0).toString(16)).slice(-8)
  } else if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return null

    if (/^#?[0-9a-f]{3}$/i.test(text)) {
      const short = text.replace('#', '')
      hex = 'ff' + short.split('').map(ch => ch + ch).join('')
    } else if (/^#?[0-9a-f]{4}$/i.test(text)) {
      const short = text.replace('#', '')
      hex = short.split('').map(ch => ch + ch).join('')
    } else if (/^#?[0-9a-f]{6}$/i.test(text)) {
      hex = 'ff' + text.replace('#', '')
    } else if (/^#?[0-9a-f]{8}$/i.test(text)) {
      hex = text.replace('#', '')
    } else if (/^\d+$/.test(text)) {
      const number = Number(text)
      if (Number.isFinite(number)) {
        hex = ('00000000' + (number >>> 0).toString(16)).slice(-8)
      }
    }
  }

  if (!hex) return null

  // Binary XML rgb values do not contain alpha even though the generic
  // normalizer above produces an ARGB-shaped value.
  if (type === 'rgb8' || type === 'rgb4') hex = 'ff' + hex.slice(-6)

  const alpha = parseInt(hex.slice(0, 2), 16) / 255
  return {
    color: '#' + hex.slice(2),
    opacity: alpha
  }
}

function layerMarkup (layer, size, isBackground) {
  if (!layer) return ''

  if (layer.color) {
    const opacity = layer.opacity === undefined ? 1 : layer.opacity
    const opacityAttr = opacity < 0.999999 ? ` fill-opacity="${opacity}"` : ''
    return `<rect width="${size}" height="${size}" fill="${escapeXml(layer.color)}"${opacityAttr}/>`
  }

  if (layer.dataUri) {
    const fit = isBackground ? 'xMidYMid slice' : 'xMidYMid meet'
    return `<image width="${size}" height="${size}" preserveAspectRatio="${fit}" href="${escapeXml(layer.dataUri)}"/>`
  }

  return ''
}

/**
 * Compose the unmasked square representation of an Android Adaptive Icon.
 * Launchers apply their own device-specific masks, so this intentionally does
 * not crop the result to a circle/squircle.
 */
function composeAdaptiveIconSvg (layers, size = 432) {
  if (!layers || (!layers.background && !layers.foreground && !layers.monochrome)) return null

  const body = [
    layerMarkup(layers.background, size, true),
    layerMarkup(layers.foreground, size, false)
  ].join('')

  if (!body) return null

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`
}

module.exports = {
  parseAdaptiveIcon,
  composeAdaptiveIconSvg,
  normalizeColor
}
