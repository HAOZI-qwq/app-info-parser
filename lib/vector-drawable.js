const BinaryXmlParser = require('./xml-parser/binary')

function findAttribute (node, name) {
  if (!node || !Array.isArray(node.attributes)) return null
  return node.attributes.find(attr => attr && (attr.name === name || attr.nodeName === name)) || null
}

function attributeValue (node, name, fallback = null) {
  const attr = findAttribute(node, name)
  if (!attr) return fallback
  if (attr.value !== null && attr.value !== undefined) return attr.value
  if (attr.typedValue && attr.typedValue.value !== null && attr.typedValue.value !== undefined) {
    return attr.typedValue.value
  }
  return fallback
}

function numericAttribute (node, name, fallback = 0) {
  const value = attributeValue(node, name, fallback)
  if (value && typeof value === 'object' && typeof value.value === 'number') return value.value
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function escapeXml (value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function resourceKeyFromReference (value) {
  if (typeof value !== 'string' || value.indexOf('resourceId:0x') !== 0) return null
  return '@' + value.slice('resourceId:0x'.length).toUpperCase()
}

function normalizeColorString (value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return ('00000000' + (value >>> 0).toString(16)).slice(-8)
  }

  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null

  if (/^#?[0-9a-f]{3}$/i.test(text)) {
    const hex = text.replace('#', '')
    return 'ff' + hex.split('').map(ch => ch + ch).join('')
  }
  if (/^#?[0-9a-f]{4}$/i.test(text)) {
    const hex = text.replace('#', '')
    return hex.split('').map(ch => ch + ch).join('')
  }
  if (/^#?[0-9a-f]{6}$/i.test(text)) {
    return 'ff' + text.replace('#', '')
  }
  if (/^#?[0-9a-f]{8}$/i.test(text)) {
    return text.replace('#', '')
  }
  if (/^\d+$/.test(text)) {
    const number = Number(text)
    if (Number.isFinite(number)) {
      return ('00000000' + (number >>> 0).toString(16)).slice(-8)
    }
  }
  return null
}

function colorFromAttribute (node, name, resourceMap) {
  const attr = findAttribute(node, name)
  if (!attr) return null

  if (attr.typedValue) {
    const type = attr.typedValue.type
    const value = attr.typedValue.value
    if (type === 'rgb8' || type === 'rgb4') {
      const hex = String(value).replace(/^#/, '')
      return { color: '#' + hex.slice(-6), opacity: 1 }
    }
    if (type === 'argb8' || type === 'argb4') {
      const hex = ('00000000' + String(value).replace(/^#/, '')).slice(-8)
      return {
        color: '#' + hex.slice(2),
        opacity: parseInt(hex.slice(0, 2), 16) / 255
      }
    }

    const key = resourceKeyFromReference(value)
    if (key && resourceMap && resourceMap[key]) {
      for (const mapped of resourceMap[key]) {
        const hex = normalizeColorString(mapped)
        if (hex) {
          return {
            color: '#' + hex.slice(2),
            opacity: parseInt(hex.slice(0, 2), 16) / 255
          }
        }
      }
    }
  }

  const hex = normalizeColorString(attr.value)
  if (!hex) return null
  return {
    color: '#' + hex.slice(2),
    opacity: parseInt(hex.slice(0, 2), 16) / 255
  }
}

function combinedOpacity (colorOpacity, explicitOpacity) {
  const a = colorOpacity === null || colorOpacity === undefined ? 1 : colorOpacity
  const b = explicitOpacity === null || explicitOpacity === undefined ? 1 : explicitOpacity
  return Math.max(0, Math.min(1, a * b))
}

function formatNumber (value) {
  if (!Number.isFinite(value)) return '0'
  if (Math.abs(value) < 1e-12) return '0'
  return String(Number(value.toFixed(6)))
}

function enumValue (node, name, values, fallback) {
  const raw = attributeValue(node, name, fallback)
  if (typeof raw === 'string' && Object.values(values).includes(raw)) return raw
  const n = Number(raw)
  return Object.prototype.hasOwnProperty.call(values, n) ? values[n] : fallback
}

function renderPath (node, resourceMap) {
  if (!node || node.nodeName !== 'path') return null
  if (Array.isArray(node.childNodes) && node.childNodes.some(child => child && child.nodeType === 1)) {
    return null
  }

  const pathData = attributeValue(node, 'pathData', null)
  if (typeof pathData !== 'string' || !pathData.trim()) return null

  const trimStart = numericAttribute(node, 'trimPathStart', 0)
  const trimEnd = numericAttribute(node, 'trimPathEnd', 1)
  const trimOffset = numericAttribute(node, 'trimPathOffset', 0)
  if (trimStart !== 0 || trimEnd !== 1 || trimOffset !== 0) {
    return null
  }

  const attrs = [`d="${escapeXml(pathData)}"`]
  const fillAttr = findAttribute(node, 'fillColor')
  const fill = colorFromAttribute(node, 'fillColor', resourceMap)
  if (fillAttr && !fill) return null
  const fillAlpha = numericAttribute(node, 'fillAlpha', 1)
  if (fill) {
    attrs.push(`fill="${fill.color}"`)
    const opacity = combinedOpacity(fill.opacity, fillAlpha)
    if (opacity < 0.999999) attrs.push(`fill-opacity="${formatNumber(opacity)}"`)
  } else {
    attrs.push('fill="none"')
  }

  const strokeAttr = findAttribute(node, 'strokeColor')
  const stroke = colorFromAttribute(node, 'strokeColor', resourceMap)
  const strokeWidth = numericAttribute(node, 'strokeWidth', 0)
  if (strokeAttr && strokeWidth > 0 && !stroke) return null
  if (stroke && strokeWidth > 0) {
    attrs.push(`stroke="${stroke.color}"`)
    attrs.push(`stroke-width="${formatNumber(strokeWidth)}"`)
    const opacity = combinedOpacity(stroke.opacity, numericAttribute(node, 'strokeAlpha', 1))
    if (opacity < 0.999999) attrs.push(`stroke-opacity="${formatNumber(opacity)}"`)

    const caps = { 0: 'butt', 1: 'round', 2: 'square' }
    const joins = { 0: 'miter', 1: 'round', 2: 'bevel' }
    attrs.push(`stroke-linecap="${enumValue(node, 'strokeLineCap', caps, 'butt')}"`)
    attrs.push(`stroke-linejoin="${enumValue(node, 'strokeLineJoin', joins, 'miter')}"`)
    const miter = numericAttribute(node, 'strokeMiterLimit', 4)
    attrs.push(`stroke-miterlimit="${formatNumber(miter)}"`)
  }

  const fillType = attributeValue(node, 'fillType', 0)
  if (fillType === 1 || fillType === 'evenOdd' || fillType === 'even_odd') {
    attrs.push('fill-rule="evenodd"')
  }

  return `<path ${attrs.join(' ')}/>`
}

function groupTransform (node) {
  const rotation = numericAttribute(node, 'rotation', 0)
  const pivotX = numericAttribute(node, 'pivotX', 0)
  const pivotY = numericAttribute(node, 'pivotY', 0)
  const scaleX = numericAttribute(node, 'scaleX', 1)
  const scaleY = numericAttribute(node, 'scaleY', 1)
  const translateX = numericAttribute(node, 'translateX', 0)
  const translateY = numericAttribute(node, 'translateY', 0)

  const parts = []
  if (translateX || translateY) parts.push(`translate(${formatNumber(translateX)} ${formatNumber(translateY)})`)
  if (pivotX || pivotY) parts.push(`translate(${formatNumber(pivotX)} ${formatNumber(pivotY)})`)
  if (rotation) parts.push(`rotate(${formatNumber(rotation)})`)
  if (scaleX !== 1 || scaleY !== 1) parts.push(`scale(${formatNumber(scaleX)} ${formatNumber(scaleY)})`)
  if (pivotX || pivotY) parts.push(`translate(${formatNumber(-pivotX)} ${formatNumber(-pivotY)})`)
  return parts.join(' ')
}

function renderContainerChildren (node, resourceMap, state) {
  const output = []
  const activeClips = []

  for (const child of node.childNodes || []) {
    if (!child || child.nodeType !== 1) continue

    if (child.nodeName === 'path') {
      const path = renderPath(child, resourceMap)
      if (!path) return null
      let rendered = path
      for (let i = activeClips.length - 1; i >= 0; i--) {
        rendered = `<g clip-path="url(#${activeClips[i]})">${rendered}</g>`
      }
      output.push(rendered)
      continue
    }

    if (child.nodeName === 'group') {
      const body = renderContainerChildren(child, resourceMap, state)
      if (body === null) return null
      const transform = groupTransform(child)
      let rendered = transform ? `<g transform="${escapeXml(transform)}">${body}</g>` : `<g>${body}</g>`
      for (let i = activeClips.length - 1; i >= 0; i--) {
        rendered = `<g clip-path="url(#${activeClips[i]})">${rendered}</g>`
      }
      output.push(rendered)
      continue
    }

    if (child.nodeName === 'clip-path') {
      const pathData = attributeValue(child, 'pathData', null)
      if (typeof pathData !== 'string' || !pathData.trim()) return null
      const id = `vector-clip-${state.nextClipId++}`
      state.defs.push(`<clipPath id="${id}"><path d="${escapeXml(pathData)}"/></clipPath>`)
      activeClips.push(id)
      continue
    }

    return null
  }

  return output.join('')
}

function vectorDocumentToSvg (document, resourceMap) {
  if (!document || document.nodeName !== 'vector') return null

  const viewportWidth = numericAttribute(document, 'viewportWidth', 0)
  const viewportHeight = numericAttribute(document, 'viewportHeight', 0)
  if (!(viewportWidth > 0) || !(viewportHeight > 0)) return null

  let width = numericAttribute(document, 'width', viewportWidth)
  let height = numericAttribute(document, 'height', viewportHeight)
  if (!(width > 0)) width = viewportWidth
  if (!(height > 0)) height = viewportHeight

  const state = { defs: [], nextClipId: 0 }
  const body = renderContainerChildren(document, resourceMap, state)
  if (body === null) return null

  const rootAttrs = [
    'xmlns="http://www.w3.org/2000/svg"',
    `width="${formatNumber(width)}"`,
    `height="${formatNumber(height)}"`,
    `viewBox="0 0 ${formatNumber(viewportWidth)} ${formatNumber(viewportHeight)}"`
  ]
  const alpha = numericAttribute(document, 'alpha', 1)
  if (alpha < 0.999999) rootAttrs.push(`opacity="${formatNumber(Math.max(0, Math.min(1, alpha)))}"`)

  const defs = state.defs.length ? `<defs>${state.defs.join('')}</defs>` : ''
  return {
    svg: `<svg ${rootAttrs.join(' ')}>${defs}${body}</svg>`,
    width,
    height,
    viewportWidth,
    viewportHeight
  }
}

function vectorDrawableToSvg (buffer, resourceMap) {
  try {
    const document = new BinaryXmlParser(buffer).parse()
    return vectorDocumentToSvg(document, resourceMap)
  } catch (e) {
    return null
  }
}

module.exports = {
  vectorDrawableToSvg,
  vectorDocumentToSvg
}
