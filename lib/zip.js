const { isBrowser, decodeNullUnicode } = require('./utils')
const Unzip = isBrowser() ? require('./browser-unzip') : require('./node-unzip')

class Zip {
  constructor (file) {
    if (isBrowser()) {
      if (!(file instanceof window.Blob || typeof file.size !== 'undefined')) {
        throw new Error('Param error: [file] must be an instance of Blob or File in browser.')
      }
      this.file = file
    } else {
      if (typeof file !== 'string') {
        throw new Error('Param error: [file] must be file path in Node.')
      }
      this.file = require('path').resolve(file)
    }
    this.unzip = new Unzip(this.file)
  }

  /**
   * get entries by regexps, the return format is: { <filename>: <Buffer|Blob> }
   * @param {Array} regexps // regexps for matching files
   * @param {String} type // return type, can be buffer or blob, default buffer
   */
  getEntries (regexps, type = 'buffer') {
    regexps = regexps.map(regex => decodeNullUnicode(regex))
    return new Promise((resolve, reject) => {
      this.unzip.getBuffer(regexps, { type }, (err, buffers) => {
        err ? reject(err) : resolve(buffers)
      })
    })
  }

  /**
   * Return all ZIP entry names without decompressing their payloads.
   */
  getEntryNames () {
    return new Promise((resolve, reject) => {
      this.unzip.getEntryNames((err, names) => {
        err ? reject(err) : resolve(names || [])
      })
    })
  }

  /**
   * get entry by regex, return an instance of Buffer or Blob
   * @param {Regex|String} regex // regex for matching file
   * @param {String} type // return type, can be buffer or blob, default buffer
   */
  getEntry (regex, type = 'buffer') {
    regex = decodeNullUnicode(regex)
    return new Promise((resolve, reject) => {
      this.unzip.getBuffer([regex], { type }, (err, buffers) => {
        err ? reject(err) : resolve(buffers[regex])
      })
    })
  }

  destroy () {
    if (this.unzip && typeof this.unzip.destroy === 'function') {
      this.unzip.destroy()
    }
    this.unzip = null
    this.file = null
  }
}

module.exports = Zip
