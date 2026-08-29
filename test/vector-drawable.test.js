const assert = require('assert')
const ApkParser = require('../lib/apk')
const { vectorDrawableToSvg } = require('../lib/vector-drawable')
const { parseAdaptiveIcon } = require('../lib/adaptive-icon')

function encodeLength8 (value) {
  if (value < 0x80) return Buffer.from([value])
  return Buffer.from([0x80 | ((value >>> 8) & 0x7f), value & 0xff])
}

function stringPoolChunk (strings) {
  const encoded = strings.map(value => {
    const bytes = Buffer.from(value, 'utf8')
    return Buffer.concat([
      encodeLength8(value.length),
      encodeLength8(bytes.length),
      bytes,
      Buffer.from([0])
    ])
  })

  const offsets = []
  let cursor = 0
  encoded.forEach(buffer => {
    offsets.push(cursor)
    cursor += buffer.length
  })

  const dataLength = (cursor + 3) & ~3
  const stringsStart = 28 + strings.length * 4
  const size = stringsStart + dataLength
  const buffer = Buffer.alloc(size)

  buffer.writeUInt16LE(1, 0)
  buffer.writeUInt16LE(28, 2)
  buffer.writeUInt32LE(size, 4)
  buffer.writeUInt32LE(strings.length, 8)
  buffer.writeUInt32LE(0, 12)
  buffer.writeUInt32LE(0x100, 16)
  buffer.writeUInt32LE(stringsStart, 20)
  buffer.writeUInt32LE(0, 24)
  offsets.forEach((offset, index) => buffer.writeUInt32LE(offset, 28 + index * 4))

  cursor = stringsStart
  encoded.forEach(item => {
    item.copy(buffer, cursor)
    cursor += item.length
  })

  return buffer
}

function typedValue (type, data) {
  const buffer = Buffer.alloc(8)
  buffer.writeUInt16LE(8, 0)
  buffer[2] = 0
  buffer[3] = type
  buffer.writeUInt32LE(data >>> 0, 4)
  return buffer
}

function startElement (nameRef, attributes) {
  const size = 36 + attributes.length * 20
  const buffer = Buffer.alloc(size)

  buffer.writeUInt16LE(0x0102, 0)
  buffer.writeUInt16LE(16, 2)
  buffer.writeUInt32LE(size, 4)
  buffer.writeUInt32LE(1, 8)
  buffer.writeInt32LE(-1, 12)
  buffer.writeInt32LE(-1, 16)
  buffer.writeInt32LE(nameRef, 20)
  buffer.writeUInt16LE(20, 24)
  buffer.writeUInt16LE(20, 26)
  buffer.writeUInt16LE(attributes.length, 28)
  buffer.writeUInt16LE(0, 30)
  buffer.writeUInt16LE(0, 32)
  buffer.writeUInt16LE(0, 34)

  let offset = 36
  attributes.forEach(attribute => {
    buffer.writeInt32LE(-1, offset)
    buffer.writeInt32LE(attribute.nameRef, offset + 4)
    buffer.writeInt32LE(attribute.rawRef === undefined ? -1 : attribute.rawRef, offset + 8)
    typedValue(attribute.type, attribute.data).copy(buffer, offset + 12)
    offset += 20
  })

  return buffer
}

function endElement (nameRef) {
  const buffer = Buffer.alloc(24)
  buffer.writeUInt16LE(0x0103, 0)
  buffer.writeUInt16LE(16, 2)
  buffer.writeUInt32LE(24, 4)
  buffer.writeUInt32LE(1, 8)
  buffer.writeInt32LE(-1, 12)
  buffer.writeInt32LE(-1, 16)
  buffer.writeInt32LE(nameRef, 20)
  return buffer
}

function binaryXml (chunks) {
  const size = 8 + chunks.reduce((total, chunk) => total + chunk.length, 0)
  const header = Buffer.alloc(8)
  header.writeUInt16LE(3, 0)
  header.writeUInt16LE(8, 2)
  header.writeUInt32LE(size, 4)
  return Buffer.concat([header].concat(chunks))
}

function floatBits (value) {
  const buffer = Buffer.alloc(4)
  buffer.writeFloatLE(value, 0)
  return buffer.readUInt32LE(0)
}

function fakeVectorDrawable () {
  const strings = [
    'vector',
    'width',
    'height',
    'viewportWidth',
    'viewportHeight',
    'path',
    'fillColor',
    'pathData',
    'M0,0H512V512H0z'
  ]

  return binaryXml([
    stringPoolChunk(strings),
    startElement(0, [
      { nameRef: 1, type: 5, data: (512 << 8) | 1 },
      { nameRef: 2, type: 5, data: (512 << 8) | 1 },
      { nameRef: 3, type: 4, data: floatBits(512) },
      { nameRef: 4, type: 4, data: floatBits(512) }
    ]),
    startElement(5, [
      { nameRef: 6, type: 0x1c, data: 0xff4398d4 },
      { nameRef: 7, rawRef: 8, type: 3, data: 8 }
    ]),
    endElement(5),
    endElement(0)
  ])
}

function fakeAdaptiveIcon () {
  const strings = ['adaptive-icon', 'background', 'foreground', 'drawable']
  return binaryXml([
    stringPoolChunk(strings),
    startElement(0, []),
    startElement(1, [{ nameRef: 3, type: 1, data: 0x7f010001 }]),
    endElement(1),
    startElement(2, [{ nameRef: 3, type: 1, data: 0x7f010002 }]),
    endElement(2),
    endElement(0)
  ])
}

function fakePng (width, height) {
  const buffer = Buffer.alloc(24)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0)
  buffer.write('IHDR', 12, 'ascii')
  buffer.writeUInt32BE(width, 16)
  buffer.writeUInt32BE(height, 20)
  return buffer
}

const vectorBuffer = fakeVectorDrawable()
const converted = vectorDrawableToSvg(vectorBuffer)
assert(converted)
assert.strictEqual(converted.width, 512)
assert.strictEqual(converted.height, 512)
assert.strictEqual(converted.viewportWidth, 512)
assert.strictEqual(converted.viewportHeight, 512)
assert(converted.svg.includes('viewBox="0 0 512 512"'))
assert(converted.svg.includes('fill="#4398d4"'))
assert(converted.svg.includes('d="M0,0H512V512H0z"'))

const adaptiveBuffer = fakeAdaptiveIcon()
const adaptiveDefinition = parseAdaptiveIcon(adaptiveBuffer)
assert(adaptiveDefinition)
assert.strictEqual(adaptiveDefinition.background.value, 'resourceId:0x7f010001')
assert.strictEqual(adaptiveDefinition.foreground.value, 'resourceId:0x7f010002')

async function run () {
  const entries = {
    'res/mipmap-xxxhdpi-v4/ic_launcher.png': fakePng(192, 192),
    'res/mipmap-anydpi-v26/ic_launcher.xml': vectorBuffer
  }

  const parser = Object.create(ApkParser.prototype)
  parser.getEntry = async regex => {
    for (const path of Object.keys(entries)) {
      regex.lastIndex = 0
      if (regex.test(path)) return entries[path]
    }
    throw new Error('entry not found')
  }

  const result = await parser._loadIcon(Object.keys(entries), {})
  assert(result)
  assert.strictEqual(result.path, 'res/mipmap-anydpi-v26/ic_launcher.xml')
  assert.strictEqual(result.mimeType, 'image/svg+xml')
  assert.strictEqual(result.isVector, true)
  assert.deepStrictEqual(result.dimensions, { width: 512, height: 512 })
  assert(result.buffer.toString('utf8').startsWith('<svg '))

  const adaptiveEntries = {
    'res/mipmap-anydpi-v26/ic_launcher.xml': adaptiveBuffer,
    'res/drawable/ic_launcher_foreground.xml': vectorBuffer
  }
  parser.getEntry = async regex => {
    for (const path of Object.keys(adaptiveEntries)) {
      regex.lastIndex = 0
      if (regex.test(path)) return adaptiveEntries[path]
    }
    throw new Error('entry not found')
  }

  const adaptiveResult = await parser._loadIcon(
    ['res/mipmap-anydpi-v26/ic_launcher.xml'],
    {
      '@7F010001': [String(0xffff0000 >>> 0)],
      '@7F010002': ['res/drawable/ic_launcher_foreground.xml']
    }
  )

  assert(adaptiveResult)
  assert.strictEqual(adaptiveResult.mimeType, 'image/svg+xml')
  assert.strictEqual(adaptiveResult.isVector, true)
  assert.deepStrictEqual(adaptiveResult.dimensions, { width: 432, height: 432 })
  assert(adaptiveResult.adaptiveIcons.background.startsWith('data:image/svg+xml;base64,'))
  assert(adaptiveResult.adaptiveIcons.foreground.startsWith('data:image/svg+xml;base64,'))
  assert(adaptiveResult.buffer.toString('utf8').includes('<image '))
}

run()
  .then(() => console.log('vector/adaptive icon tests passed'))
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
