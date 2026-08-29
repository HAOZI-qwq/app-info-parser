const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const AppInfoParser = require('../lib')

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
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    localParts.push(local, name, data)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(localOffset, 42)
    centralParts.push(central, name)

    localOffset += local.length + name.length + data.length
  })

  const localData = Buffer.concat(localParts)
  const centralData = Buffer.concat(centralParts)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralData.length, 12)
  end.writeUInt32LE(localData.length, 16)

  return Buffer.concat([localData, centralData, end])
}

function fakePng () {
  const buffer = Buffer.alloc(24)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0)
  buffer.write('IHDR', 12, 'ascii')
  buffer.writeUInt32BE(128, 16)
  buffer.writeUInt32BE(128, 20)
  return buffer
}

async function run () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-info-parser-app-'))
  const zipPath = path.join(dir, 'Demo.app.zip')

  const plist = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>com.example.demo</string>
<key>CFBundleShortVersionString</key><string>1.2.3</string>
<key>CFBundleVersion</key><string>42</string>
<key>CFBundleIconFiles</key><array><string>Icon.png</string></array>
</dict></plist>`)

  fs.writeFileSync(zipPath, makeStoredZip([
    { name: 'Demo.app/Info.plist', data: plist },
    { name: 'Demo.app/Icon.png', data: fakePng() }
  ]))

  const result = await new AppInfoParser(zipPath).parse()
  assert.strictEqual(result.CFBundleIdentifier, 'com.example.demo')
  assert.strictEqual(result.CFBundleShortVersionString, '1.2.3')
  assert.strictEqual(result.CFBundleVersion, '42')
  assert(result.icon && result.icon.startsWith('data:image/png;base64,'))

  fs.unlinkSync(zipPath)
  fs.rmdirSync(dir)
}

run()
  .then(() => console.log('compressed .app test passed'))
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
