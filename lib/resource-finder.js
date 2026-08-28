/**
 * Code originally translated from:
 * https://github.com/hylander0/Iteedee.ApkReader/blob/master/Iteedee.ApkReader/ApkResourceFinder.cs
 *
 * Decode binary file `resources.arsc` from a .apk file to a JavaScript Object.
 *
 * The parser also supports modern Android resource table layouts:
 * - ResTable_type::FLAG_SPARSE
 * - ResTable_type::FLAG_OFFSET16
 * - ResTable_entry::FLAG_COMPACT
 */

var ByteBuffer = require('bytebuffer')

var DEBUG = false

var RES_STRING_POOL_TYPE = 0x0001
var RES_TABLE_TYPE = 0x0002
var RES_TABLE_PACKAGE_TYPE = 0x0200
var RES_TABLE_TYPE_TYPE = 0x0201
var RES_TABLE_TYPE_SPEC_TYPE = 0x0202

var TYPE_REFERENCE = 0x01
var TYPE_STRING = 0x03
var TYPE_DYNAMIC_REFERENCE = 0x07

var TYPE_FLAG_SPARSE = 0x01
var TYPE_FLAG_OFFSET16 = 0x02
var NO_ENTRY = 0xffffffff
var NO_ENTRY16 = 0xffff

var ENTRY_FLAG_COMPLEX = 0x0001
var ENTRY_FLAG_COMPACT = 0x0008

function ResourceFinder () {
  this.valueStringPool = null
  this.typeStringPool = null
  this.keyStringPool = null

  this.package_id = 0

  this.responseMap = {}
  this.entryMap = {}
  this.referenceMap = {}
}

/**
 * Same to C# BinaryReader.readBytes
 *
 * @param bb ByteBuffer
 * @param len length
 * @returns {ByteBuffer}
 */
ResourceFinder.readBytes = function (bb, len) {
  var uint8Array = new Uint8Array(len)
  for (var i = 0; i < len; i++) {
    uint8Array[i] = bb.readUint8()
  }
  return ByteBuffer.wrap(uint8Array, 'binary', true)
}

ResourceFinder.prototype._resourceKey = function (resourceId) {
  return '@' + (resourceId >>> 0).toString(16).toUpperCase()
}

ResourceFinder.prototype._addReference = function (resId, targetId) {
  var key = this._resourceKey(resId)
  var target = this._resourceKey(targetId)
  if (!this.referenceMap[key]) {
    this.referenceMap[key] = []
  }
  if (this.referenceMap[key].indexOf(target) === -1) {
    this.referenceMap[key].push(target)
  }
}

ResourceFinder.prototype._resolveReferences = function () {
  var self = this
  var memo = {}

  function resolve (key, stack) {
    if (memo[key]) return memo[key]
    if (stack[key]) return self.responseMap[key] || []

    var nextStack = {}
    Object.keys(stack).forEach(function (stackKey) { nextStack[stackKey] = true })
    nextStack[key] = true

    var values = (self.responseMap[key] || []).slice()
    var refs = self.referenceMap[key] || []

    refs.forEach(function (ref) {
      resolve(ref, nextStack).forEach(function (value) {
        if (values.indexOf(value) === -1) {
          values.push(value)
        }
      })
    })

    memo[key] = values
    return values
  }

  Object.keys(this.referenceMap).forEach(function (key) {
    var values = resolve(key, {})
    if (!self.responseMap[key]) self.responseMap[key] = []
    values.forEach(function (value) {
      if (self.responseMap[key].indexOf(value) === -1) {
        self.responseMap[key].push(value)
      }
    })
  })
}

/**
 * @param {Buffer} resourceBuffer
 * @return {Object}
 */
ResourceFinder.prototype.processResourceTable = function (resourceBuffer) {
  var bb = ByteBuffer.wrap(resourceBuffer, 'binary', true)

  var type = bb.readShort()
  var headerSize = bb.readShort()
  var size = bb.readInt() >>> 0
  var packageCount = bb.readInt() >>> 0
  var buffer
  var bb2

  if (type !== RES_TABLE_TYPE) {
    throw new Error('No RES_TABLE_TYPE found!')
  }
  if (size > bb.limit) {
    throw new Error('The resource table declares a size larger than the supplied buffer.')
  }

  bb.offset = headerSize

  var realStringPoolCount = 0
  var realPackageCount = 0

  while (bb.offset + 8 <= size) {
    var pos = bb.offset
    var t = bb.readShort()
    var hs = bb.readShort()
    var s = bb.readInt() >>> 0

    if (s < 8 || pos + s > size) {
      throw new Error('Invalid resource table chunk size at offset ' + pos + '.')
    }

    if (t === RES_STRING_POOL_TYPE) {
      if (realStringPoolCount === 0) {
        if (DEBUG) console.log('Processing the string pool ...')
        buffer = new ByteBuffer(s)
        bb.offset = pos
        bb.prependTo(buffer)
        bb2 = ByteBuffer.wrap(buffer, 'binary', true)
        bb2.LE()
        this.valueStringPool = this.processStringPool(bb2)
      }
      realStringPoolCount++
    } else if (t === RES_TABLE_PACKAGE_TYPE) {
      if (DEBUG) console.log('Processing the package ' + realPackageCount + ' ...')
      buffer = new ByteBuffer(s)
      bb.offset = pos
      bb.prependTo(buffer)
      bb2 = ByteBuffer.wrap(buffer, 'binary', true)
      bb2.LE()
      this.processPackage(bb2)
      realPackageCount++
    } else if (DEBUG) {
      console.log('Skipping unsupported top-level resource chunk type 0x' + t.toString(16))
    }

    bb.offset = pos + s
  }

  if (realStringPoolCount < 1) {
    throw new Error('Resource table value string pool not found.')
  }
  if (realPackageCount !== packageCount && DEBUG) {
    console.warn('Real package count does not equal declared package count.')
  }

  this._resolveReferences()
  return this.responseMap
}

/**
 * @param {ByteBuffer} bb
 */
ResourceFinder.prototype.processPackage = function (bb) {
  var type = bb.readShort()
  var headerSize = bb.readShort()
  var size = bb.readInt() >>> 0
  var id = bb.readInt() >>> 0

  if (type !== RES_TABLE_PACKAGE_TYPE) {
    throw new Error('Invalid RES_TABLE_PACKAGE_TYPE chunk.')
  }

  this.package_id = id

  // package name: uint16_t name[128]
  for (var i = 0; i < 256; ++i) bb.readUint8()

  var typeStrings = bb.readInt() >>> 0
  var lastPublicType = bb.readInt() >>> 0 // eslint-disable-line no-unused-vars
  var keyStrings = bb.readInt() >>> 0
  var lastPublicKey = bb.readInt() >>> 0 // eslint-disable-line no-unused-vars

  // Newer package headers also contain typeIdOffset. We deliberately use
  // headerSize/typeStrings offsets instead of assuming a fixed struct size.
  if (typeStrings && typeStrings < headerSize) {
    throw new Error('Invalid type string pool offset in package.')
  }

  if (typeStrings) {
    bb.offset = typeStrings
    var bbTypeStrings = ResourceFinder.readBytes(bb, size - bb.offset)
    this.typeStringPool = this.processStringPool(bbTypeStrings)
  } else {
    this.typeStringPool = []
  }

  var keySize = 0
  if (keyStrings) {
    bb.offset = keyStrings
    var keyType = bb.readShort()
    var keyHeaderSize = bb.readShort() // eslint-disable-line no-unused-vars
    keySize = bb.readInt() >>> 0
    if (keyType !== RES_STRING_POOL_TYPE || keySize < 8 || keyStrings + keySize > size) {
      throw new Error('Invalid key string pool in resource package.')
    }

    bb.offset = keyStrings
    var bbKeyStrings = ResourceFinder.readBytes(bb, size - bb.offset)
    this.keyStringPool = this.processStringPool(bbKeyStrings)
  } else {
    this.keyStringPool = []
  }

  // Type chunks normally follow the key string pool. If keyStrings is absent,
  // start after the package header and scan safely through all child chunks.
  bb.offset = keyStrings ? keyStrings + keySize : headerSize

  while (bb.offset + 8 <= size) {
    var pos = bb.offset
    var t = bb.readShort()
    var hs = bb.readShort() // eslint-disable-line no-unused-vars
    var s = bb.readInt() >>> 0

    if (s < 8 || pos + s > size) break

    bb.offset = pos
    var child = ResourceFinder.readBytes(bb, s)

    if (t === RES_TABLE_TYPE_SPEC_TYPE) {
      this.processTypeSpec(child)
    } else if (t === RES_TABLE_TYPE_TYPE) {
      this.processType(child)
    }

    bb.offset = pos + s
  }
}

/**
 * @param {ByteBuffer} bb
 */
ResourceFinder.prototype.processType = function (bb) {
  var type = bb.readShort()
  var headerSize = bb.readShort()
  var size = bb.readInt() >>> 0
  var id = bb.readUint8()
  var flags = bb.readUint8()
  var reserved = bb.readUint16() // eslint-disable-line no-unused-vars
  var entryCount = bb.readInt() >>> 0
  var entriesStart = bb.readInt() >>> 0

  if (type !== RES_TABLE_TYPE_TYPE) {
    throw new Error('Invalid RES_TABLE_TYPE_TYPE chunk.')
  }
  if (headerSize < 20 || entriesStart < headerSize || entriesStart > size) {
    throw new Error('Invalid ResTable_type header/entriesStart.')
  }

  // Config starts at offset 20. Its first uint32 is its own size. No fixed
  // config size is assumed because Android extends ResTable_config over time.
  if (headerSize >= 24) {
    var configSize = bb.readInt() >>> 0 // eslint-disable-line no-unused-vars
  }

  bb.offset = headerSize

  var entryIndices = []
  var i

  if (flags & TYPE_FLAG_SPARSE) {
    // Each 4-byte sparse record contains { uint16 idx, uint16 offset/4 }.
    if (headerSize + entryCount * 4 > entriesStart) {
      throw new Error('Sparse resource index table exceeds entriesStart.')
    }
    for (i = 0; i < entryCount; ++i) {
      var sparseId = bb.readUint16()
      var sparseOffset = bb.readUint16()
      entryIndices.push({ id: sparseId, offset: sparseOffset * 4 })
    }
  } else if (flags & TYPE_FLAG_OFFSET16) {
    // 16-bit offsets are stored divided by four; 0xffff means NO_ENTRY.
    if (headerSize + entryCount * 2 > entriesStart) {
      throw new Error('16-bit resource index table exceeds entriesStart.')
    }
    for (i = 0; i < entryCount; ++i) {
      var offset16 = bb.readUint16()
      if (offset16 !== NO_ENTRY16) {
        entryIndices.push({ id: i, offset: offset16 * 4 })
      }
    }
  } else {
    if (headerSize + entryCount * 4 > entriesStart) {
      throw new Error('Resource index table exceeds entriesStart.')
    }
    for (i = 0; i < entryCount; ++i) {
      var offset32 = bb.readUint32()
      if (offset32 !== NO_ENTRY) {
        entryIndices.push({ id: i, offset: offset32 })
      }
    }
  }

  for (i = 0; i < entryIndices.length; ++i) {
    var index = entryIndices[i]
    var entryStart = entriesStart + index.offset
    if (entryStart + 8 > size) continue

    bb.offset = entryStart

    // Full and compact entries deliberately share the flags at byte offset 2.
    var firstWord = bb.readUint16()
    var entryFlags = bb.readUint16()
    var isCompact = (entryFlags & ENTRY_FLAG_COMPACT) !== 0

    var entryKey
    var valueDataType
    var valueData

    if (isCompact) {
      // Compact entry layout: key:uint16, flags:uint16, data:uint32.
      entryKey = firstWord
      valueDataType = (entryFlags >>> 8) & 0xff
      valueData = bb.readUint32()
    } else {
      var entrySize = firstWord
      if (entrySize < 8 || entryStart + entrySize > size) continue

      entryKey = bb.readUint32()

      if (entryFlags & ENTRY_FLAG_COMPLEX) {
        // Complex resources are not needed for app label/icon resolution.
        // Skip them safely instead of attempting to interpret them as simple values.
        continue
      }

      // A simple Res_value begins immediately after the ResTable_entry and
      // entrySize can be larger than the classic 8-byte header.
      bb.offset = entryStart + entrySize
      if (bb.offset + 8 > size) continue

      var valueSize = bb.readUint16()
      var valueRes0 = bb.readUint8() // eslint-disable-line no-unused-vars
      valueDataType = bb.readUint8()
      valueData = bb.readUint32()
      if (valueSize < 8) continue
    }

    var resourceId = (((this.package_id & 0xff) << 24) | ((id & 0xff) << 16) | (index.id & 0xffff)) >>> 0
    var idStr = resourceId.toString(16)
    var keyStr = this.keyStringPool[entryKey]

    if (!this.entryMap[resourceId]) this.entryMap[resourceId] = []
    if (keyStr !== undefined && this.entryMap[resourceId].indexOf(keyStr) === -1) {
      this.entryMap[resourceId].push(keyStr)
    }

    if (valueDataType === TYPE_STRING) {
      this.putIntoMap('@' + idStr, this.valueStringPool[valueData])
    } else if (valueDataType === TYPE_REFERENCE || valueDataType === TYPE_DYNAMIC_REFERENCE) {
      this._addReference(resourceId, valueData)
    } else {
      // Preserve the old public behavior for non-string scalar values.
      this.putIntoMap('@' + idStr, String(valueData >>> 0))
    }
  }
}

/**
 * Parse a ResStringPool chunk.
 * @param {ByteBuffer} bb
 * @return {Array<String>}
 */
ResourceFinder.prototype.processStringPool = function (bb) {
  var chunkStart = bb.offset
  var type = bb.readShort()
  var headerSize = bb.readShort()
  var size = bb.readInt() >>> 0
  var stringCount = bb.readInt() >>> 0
  var styleCount = bb.readInt() >>> 0 // eslint-disable-line no-unused-vars
  var flags = bb.readInt() >>> 0
  var stringsStart = bb.readInt() >>> 0
  var stylesStart = bb.readInt() >>> 0 // eslint-disable-line no-unused-vars

  if (type !== RES_STRING_POOL_TYPE || headerSize < 28 || size > bb.limit - chunkStart) {
    throw new Error('Invalid resource string pool.')
  }

  var isUTF8 = (flags & 0x100) !== 0
  var offsets = new Array(stringCount)
  var i

  for (i = 0; i < stringCount; ++i) {
    offsets[i] = bb.readInt() >>> 0
  }

  var strings = new Array(stringCount)

  for (i = 0; i < stringCount; ++i) {
    var pos = chunkStart + stringsStart + offsets[i]
    if (pos >= chunkStart + size) {
      strings[i] = ''
      continue
    }

    bb.offset = pos

    if (isUTF8) {
      // UTF-8 pools store UTF-16 code-unit length first, then byte length.
      var u16len = bb.readUint8()
      if ((u16len & 0x80) !== 0) {
        u16len = ((u16len & 0x7f) << 8) + bb.readUint8()
      }

      var u8len = bb.readUint8()
      if ((u8len & 0x80) !== 0) {
        u8len = ((u8len & 0x7f) << 8) + bb.readUint8()
      }

      if (u8len > 0) {
        var buffer = ResourceFinder.readBytes(bb, u8len)
        try {
          strings[i] = ByteBuffer.wrap(buffer, 'utf8', true).toString('utf8')
        } catch (e) {
          strings[i] = ''
          if (DEBUG) console.error(e)
        }
      } else {
        strings[i] = ''
      }
    } else {
      // UTF-16 pools contain little-endian UTF-16 code units. The previous
      // implementation incorrectly decoded these bytes as UTF-8.
      var length16 = bb.readUint16()
      if ((length16 & 0x8000) !== 0) {
        length16 = ((length16 & 0x7fff) << 16) + bb.readUint16()
      }

      if (length16 > 0) {
        var chars = new Array(length16)
        for (var c = 0; c < length16; ++c) {
          chars[c] = String.fromCharCode(bb.readUint16())
        }
        strings[i] = chars.join('')
      } else {
        strings[i] = ''
      }
    }

    if (DEBUG) console.log('Parsed value:', strings[i])
  }

  return strings
}

/**
 * @param {ByteBuffer} bb
 */
ResourceFinder.prototype.processTypeSpec = function (bb) {
  var type = bb.readShort()
  var headerSize = bb.readShort()
  var size = bb.readInt() >>> 0
  var id = bb.readUint8()
  var res0 = bb.readUint8() // eslint-disable-line no-unused-vars
  var res1 = bb.readUint16() // eslint-disable-line no-unused-vars
  var entryCount = bb.readInt() >>> 0

  if (type !== RES_TABLE_TYPE_SPEC_TYPE || headerSize > size) return

  if (DEBUG) {
    console.log('Processing type spec ' + this.typeStringPool[id - 1] + '...')
  }

  // Flags are currently not used, but consume only values inside the chunk.
  bb.offset = headerSize
  for (var i = 0; i < entryCount && bb.offset + 4 <= size; ++i) {
    bb.readInt()
  }
}

ResourceFinder.prototype.putIntoMap = function (resId, value) {
  var key = resId.toUpperCase()
  if (this.responseMap[key] == null) {
    this.responseMap[key] = []
  }
  if (value !== null && value !== undefined && this.responseMap[key].indexOf(value) === -1) {
    this.responseMap[key].push(value)
  }
}

module.exports = ResourceFinder
