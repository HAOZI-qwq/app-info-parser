const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const NodeUnzip = require('../lib/node-unzip')

function crc32 (buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function makeStoredZip (entries) {
  const localParts = []
  const centralParts = []
  let localOffset = 0

  entries.forEach(entry => {
    const name = Buffer.from(entry.name, 'utf8')
    const data = Buffer.from(entry.data)
    const crc = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    localParts.push(local, name, data)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(localOffset, 42)
    centralParts.push(central, name)

    localOffset += local.length + name.length + data.length
  })

  const localData = Buffer.concat(localParts)
  const centralData = Buffer.concat(centralParts)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralData.length, 12)
  end.writeUInt32LE(localData.length, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([localData, centralData, end])
}

function getBuffer (unzip, rules) {
  return new Promise((resolve, reject) => {
    unzip.getBuffer(rules, {}, (error, result) => error ? reject(error) : resolve(result))
  })
}

function getNames (unzip) {
  return new Promise((resolve, reject) => {
    unzip.getEntryNames((error, names) => error ? reject(error) : resolve(names))
  })
}

async function run () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-info-parser-next-'))
  const zipPath = path.join(dir, 'sample.apk')
  const movedPath = path.join(dir, 'moved.apk')

  fs.writeFileSync(zipPath, makeStoredZip([
    { name: 'AndroidManifest.xml', data: Buffer.from('manifest') },
    { name: 'lib/arm64-v8a/libdemo.so', data: Buffer.from('native') }
  ]))

  const unzip = new NodeUnzip(zipPath)
  const output = await getBuffer(unzip, [/^AndroidManifest\.xml$/])
  assert.strictEqual(output[/^AndroidManifest\.xml$/].toString(), 'manifest')

  const names = await getNames(unzip)
  assert(names.includes('lib/arm64-v8a/libdemo.so'))

  // This specifically catches the upstream Windows bug: parsing returned
  // before yauzl closed the file descriptor, so rename/unlink failed until the
  // Node process exited.
  fs.renameSync(zipPath, movedPath)
  fs.unlinkSync(movedPath)
  fs.rmdirSync(dir)
}

run()
  .then(() => console.log('node unzip handle test passed'))
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
