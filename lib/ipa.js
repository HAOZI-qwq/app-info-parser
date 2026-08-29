const parsePlist = require('plist').parse
const parseBplist = require('bplist-parser').parseBuffer
const cgbiToPng = require('cgbi-to-png')

const Zip = require('./zip')
const { findIpaIconPath, getBase64FromBuffer, detectImageMimeType } = require('./utils')

// Support both normal IPA layout (Payload/Foo.app/...) and a directly zipped
// simulator/device .app bundle (Foo.app/...).
const PlistName = /^(?:payload\/)?[^/]+\.app\/info\.plist$/i
const ProvisionName = /^(?:payload\/)?[^/]+\.app\/embedded\.mobileprovision$/i

function escapeRegExp (value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

class IpaParser extends Zip {
  /**
   * parser for parsing .ipa file or a zipped .app bundle
   * @param {String | File | Blob} file // file's path in Node, instance of File or Blob in Browser
   */
  constructor (file) {
    super(file)
    if (!(this instanceof IpaParser)) {
      return new IpaParser(file)
    }
  }

  async parse () {
    const buffers = await this.getEntries([PlistName, ProvisionName])
    if (!buffers[PlistName]) {
      throw new Error('Info.plist can\'t be found.')
    }

    const plistInfo = this._parsePlist(buffers[PlistName])
    plistInfo.mobileProvision = this._parseProvision(buffers[ProvisionName])
    plistInfo.icon = null
    plistInfo.iconPath = null

    const iconName = findIpaIconPath(plistInfo)
    const iconRegex = new RegExp(escapeRegExp(iconName), 'i')
    const iconBuffer = await this.getEntry(iconRegex)

    if (!iconBuffer) return plistInfo

    try {
      // iOS PNGs can contain Apple's CgBI transformation. Revert it first.
      const reverted = cgbiToPng.revert(iconBuffer)
      plistInfo.icon = getBase64FromBuffer(reverted, detectImageMimeType(reverted) || 'image/png')
      plistInfo.iconPath = iconName
    } catch (err) {
      // Buffer#toString('base64') is safe for large files and avoids the old
      // String.fromCharCode(...iconBuffer) argument/stack overflow.
      const mimeType = detectImageMimeType(iconBuffer)
      if (mimeType) {
        plistInfo.icon = getBase64FromBuffer(iconBuffer, mimeType)
        plistInfo.iconPath = iconName
      } else {
        plistInfo.icon = null
        console.warn('[Warning] failed to parse icon: ', err)
      }
    }

    return plistInfo
  }

  /**
   * Parse plist
   * @param {Buffer} buffer // plist file's buffer
   */
  _parsePlist (buffer) {
    let result
    const bufferType = buffer[0]
    if (bufferType === 60 || bufferType === 239) {
      result = parsePlist(buffer.toString())
    } else if (bufferType === 98) {
      result = parseBplist(buffer)[0]
    } else {
      throw new Error('Unknown plist buffer type.')
    }
    return result
  }

  /**
   * parse provision
   * @param {Buffer} buffer // provision file's buffer
   */
  _parseProvision (buffer) {
    let info = {}
    if (buffer) {
      const content = buffer.toString('utf-8')
      const firstIndex = content.indexOf('<?xml')
      const endIndex = content.indexOf('</plist>')
      if (firstIndex >= 0 && endIndex >= firstIndex) {
        const plistContent = content.slice(firstIndex, endIndex + 8)
        if (plistContent) info = parsePlist(plistContent)
      }
    }
    return info
  }
}

module.exports = IpaParser
