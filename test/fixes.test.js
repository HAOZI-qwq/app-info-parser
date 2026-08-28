const assert = require('assert')
const BinaryXmlParser = require('../lib/xml-parser/binary')
const ResourceFinder = require('../lib/resource-finder')
const ByteBuffer = require('bytebuffer')
const utils = require('../lib/utils')

// TypedValue complex dimension: 10dp, radix 23p0.
{
  const b = Buffer.alloc(4)
  b.writeUInt32LE((10 << 8) | 1, 0)
  const p = new BinaryXmlParser(b)
  const d = p.readDimension()
  assert.strictEqual(d.unit, 'dp')
  assert.strictEqual(d.rawUnit, 1)
  assert.strictEqual(d.value, 10)
}

// TypedValue fraction: 50% encoded using radix 0p23.
{
  const b = Buffer.alloc(4)
  b.writeUInt32LE(0x40000030, 0)
  const p = new BinaryXmlParser(b)
  const f = p.readFraction()
  assert.strictEqual(f.type, '%')
  assert(Math.abs(f.value - 0.5) < 1e-9)
}

// TYPE_FLOAT and string-pool index 0.
{
  const b = Buffer.alloc(8)
  b.writeUInt16LE(8, 0)
  b[2] = 0
  b[3] = 3
  b.writeInt32LE(0, 4)
  const p = new BinaryXmlParser(b)
  p.strings = ['zero']
  assert.strictEqual(p.readTypedValue().value, 'zero')

  const floatBits = Buffer.alloc(4)
  floatBits.writeFloatLE(1.5, 0)
  assert.strictEqual(p.convertIntToFloat(floatBits.readUInt32LE(0)), 1.5)
}

// versionName must preserve Unicode, spaces and punctuation.
{
  const b = Buffer.alloc(20)
  b.writeInt32LE(-1, 0)
  b.writeInt32LE(0, 4)
  b.writeInt32LE(1, 8)
  b.writeUInt16LE(8, 12)
  b[14] = 0
  b[15] = 3
  b.writeInt32LE(1, 16)
  const p = new BinaryXmlParser(b)
  p.strings = ['versionName', 'Versión 1.0.27 测试']
  const a = p.readXmlAttribute()
  assert.strictEqual(a.value, 'Versión 1.0.27 测试')
  assert.strictEqual(a.typedValue.value, 'Versión 1.0.27 测试')
  assert.strictEqual(p.strings[1], 'Versión 1.0.27 测试')
}

function fullTypeChunk ({ flags = 0, id = 1, entryCount, indices, entriesStart, entries, headerSize = 24 }) {
  const size = entriesStart + entries.length
  const b = Buffer.alloc(size)
  b.writeUInt16LE(0x0201, 0)
  b.writeUInt16LE(headerSize, 2)
  b.writeUInt32LE(size, 4)
  b[8] = id
  b[9] = flags
  b.writeUInt16LE(0, 10)
  b.writeUInt32LE(entryCount, 12)
  b.writeUInt32LE(entriesStart, 16)
  b.writeUInt32LE(4, 20) // minimal config size
  indices.copy(b, headerSize)
  entries.copy(b, entriesStart)
  return b
}

function simpleEntry (key, dataType, data, size = 8) {
  const b = Buffer.alloc(16)
  b.writeUInt16LE(size, 0)
  b.writeUInt16LE(0, 2)
  b.writeUInt32LE(key, 4)
  b.writeUInt16LE(8, 8)
  b[10] = 0
  b[11] = dataType
  b.writeUInt32LE(data >>> 0, 12)
  return b
}

// Normal entry offsets must be honored (including gaps).
{
  const rf = new ResourceFinder()
  rf.package_id = 0x7f
  rf.keyStringPool = ['first', 'second']
  rf.valueStringPool = ['A', 'B']
  const e0 = simpleEntry(0, 3, 0)
  const e1 = simpleEntry(1, 3, 1)
  const entries = Buffer.alloc(40)
  e0.copy(entries, 0)
  e1.copy(entries, 24) // deliberate 8-byte gap
  const idx = Buffer.alloc(8)
  idx.writeUInt32LE(0, 0)
  idx.writeUInt32LE(24, 4)
  rf.processType(ByteBuffer.wrap(fullTypeChunk({ entryCount: 2, indices: idx, entriesStart: 32, entries })))
  assert.deepStrictEqual(rf.responseMap['@7F010000'], ['A'])
  assert.deepStrictEqual(rf.responseMap['@7F010001'], ['B'])
}

// Sparse type: actual entry id is stored in the sparse record.
{
  const rf = new ResourceFinder()
  rf.package_id = 0x7f
  rf.keyStringPool = ['sparse']
  rf.valueStringPool = ['S']
  const idx = Buffer.alloc(4)
  idx.writeUInt16LE(5, 0)
  idx.writeUInt16LE(0, 2)
  const entries = simpleEntry(0, 3, 0)
  rf.processType(ByteBuffer.wrap(fullTypeChunk({ flags: 1, entryCount: 1, indices: idx, entriesStart: 28, entries })))
  assert.deepStrictEqual(rf.responseMap['@7F010005'], ['S'])
}

// 16-bit offset table.
{
  const rf = new ResourceFinder()
  rf.package_id = 0x7f
  rf.keyStringPool = ['offset16']
  rf.valueStringPool = ['O']
  const idx = Buffer.alloc(4)
  idx.writeUInt16LE(0xffff, 0)
  idx.writeUInt16LE(0, 2)
  const entries = simpleEntry(0, 3, 0)
  rf.processType(ByteBuffer.wrap(fullTypeChunk({ flags: 2, entryCount: 2, indices: idx, entriesStart: 28, entries })))
  assert.deepStrictEqual(rf.responseMap['@7F010001'], ['O'])
}

// Compact entry: key uint16, flags contains dataType in high byte.
{
  const rf = new ResourceFinder()
  rf.package_id = 0x7f
  rf.keyStringPool = ['compact']
  rf.valueStringPool = ['C']
  const idx = Buffer.alloc(4)
  idx.writeUInt32LE(0, 0)
  const entry = Buffer.alloc(8)
  entry.writeUInt16LE(0, 0)
  entry.writeUInt16LE((3 << 8) | 0x08, 2)
  entry.writeUInt32LE(0, 4)
  rf.processType(ByteBuffer.wrap(fullTypeChunk({ entryCount: 1, indices: idx, entriesStart: 28, entries: entry })))
  assert.deepStrictEqual(rf.responseMap['@7F010000'], ['C'])
}

// UTF-16 resource string pool must decode as UTF-16LE, not UTF-8.
{
  const text = '你好'
  const b = Buffer.alloc(40)
  b.writeUInt16LE(1, 0)
  b.writeUInt16LE(28, 2)
  b.writeUInt32LE(40, 4)
  b.writeUInt32LE(1, 8)
  b.writeUInt32LE(0, 12)
  b.writeUInt32LE(0, 16)
  b.writeUInt32LE(32, 20)
  b.writeUInt32LE(0, 24)
  b.writeUInt32LE(0, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(text.charCodeAt(0), 34)
  b.writeUInt16LE(text.charCodeAt(1), 36)
  b.writeUInt16LE(0, 38)
  const rf = new ResourceFinder()
  assert.deepStrictEqual(rf.processStringPool(require('bytebuffer').wrap(b)), [text])
}

// Icon selection prefers actual high-density raster over adaptive XML.
{
  const info = { application: { icon: [
    'res/mipmap-anydpi-v26/ic_launcher.xml',
    'res/mipmap-hdpi/ic_launcher.png',
    'res/mipmap-xxxhdpi/ic_launcher.webp'
  ] } }
  const paths = utils.findApkIconPaths(info)
  assert.strictEqual(paths[0], 'res/mipmap-xxxhdpi/ic_launcher.webp')
  assert.strictEqual(paths[paths.length - 1], 'res/mipmap-anydpi-v26/ic_launcher.xml')
}

// MIME detection prevents binary XML from being labelled image/png.
{
  assert.strictEqual(utils.detectImageMimeType(Buffer.from([0x03, 0x00, 0x08, 0x00])), null)
  assert.strictEqual(utils.detectImageMimeType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png')
}

console.log('all targeted tests passed')
