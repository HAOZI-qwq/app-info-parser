const assert = require('assert')
const { findApkAbis } = require('../lib/abi')
const { readConfig, densityQualifier } = require('../lib/resource-config')

const abis = findApkAbis([
  'AndroidManifest.xml',
  'lib/x86/libdemo.so',
  'lib/arm64-v8a/libfoo.so',
  'lib/armeabi-v7a/libfoo.so',
  'lib/arm64-v8a/libbar.so',
  'assets/lib/not-an-abi.so'
])
assert.deepStrictEqual(abis, ['armeabi-v7a', 'arm64-v8a', 'x86'])

const configBuffer = Buffer.alloc(36)
configBuffer.writeUInt32LE(36, 0)
configBuffer.writeUInt16LE(460, 4)
configBuffer.writeUInt16LE(1, 6)
configBuffer.write('zh', 8, 'ascii')
configBuffer.write('CN', 10, 'ascii')
configBuffer.writeUInt8(1, 12)
configBuffer.writeUInt16LE(480, 14)
configBuffer.writeUInt16LE(1080, 20)
configBuffer.writeUInt16LE(2400, 22)
configBuffer.writeUInt16LE(26, 24)
configBuffer.writeUInt8(0x20, 29)
configBuffer.writeUInt16LE(360, 30)
configBuffer.writeUInt16LE(360, 32)
configBuffer.writeUInt16LE(800, 34)

const config = readConfig(configBuffer, 0, configBuffer.length)
assert.strictEqual(config.locale, 'zh-rCN')
assert.strictEqual(config.language, 'zh')
assert.strictEqual(config.region, 'CN')
assert.strictEqual(config.mcc, 460)
assert.strictEqual(config.mnc, 1)
assert.strictEqual(config.density, 480)
assert.strictEqual(config.densityQualifier, 'xxhdpi')
assert.strictEqual(config.sdkVersion, 26)
assert.strictEqual(config.screenWidthDp, 360)
assert.strictEqual(config.screenHeightDp, 800)
assert.strictEqual(densityQualifier(0xfffe), 'anydpi')
assert.strictEqual(densityQualifier(0xffff), 'nodpi')

console.log('metadata tests passed')
