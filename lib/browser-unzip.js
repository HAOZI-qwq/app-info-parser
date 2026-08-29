/*
 * Browser-only unzip adapter built on the browser internals of
 * isomorphic-unzip. The upstream 1.1.5 browser implementation creates a
 * zip.js reader (and therefore an inflater Web Worker) for every getBuffer()
 * call but never closes the reader. This adapter closes it after extraction
 * so repeated APK/IPA parsing does not leak workers.
 */

const zip = require('isomorphic-unzip/lib/browser/zip')
const blobToBuffer = require('isomorphic-unzip/lib/browser/blob-to-buffer')

function isArray (value) {
  return Array.isArray(value)
}

function isFunction (value) {
  return typeof value === 'function'
}

function matches (rule, entryName) {
  if (typeof rule === 'function') return rule(entryName)
  if (typeof rule === 'string') {
    return entryName.toLowerCase().indexOf(rule.toLowerCase()) > -1
  }
  if (rule instanceof RegExp) {
    rule.lastIndex = 0
    return rule.test(entryName.toLowerCase())
  }
  return false
}

class BrowserUnzip {
  constructor (file) {
    if (typeof Blob === 'undefined' || !(file instanceof Blob)) {
      throw new Error('Invalid input, expect the first param to be a File/Blob.')
    }
    this.file = file
  }

  destroy () {
    this.file = null
  }

  getEntryNames (callback) {
    if (!isFunction(callback)) throw new Error('getEntryNames: callback must be a function.')

    zip.createReader(new zip.BlobReader(this.file), zipReader => {
      zipReader.getEntries(entries => {
        const names = entries.map(entry => entry.filename)
        zipReader.close(() => callback(null, names))
      })
    }, error => callback(error))
  }

  getBuffer (whatYouNeed, options, callback) {
    if (!isArray(whatYouNeed)) {
      if (isFunction(callback)) {
        callback(new Error('getBuffer: invalid param, expect first param to be an Array.'))
      }
      return
    }

    if (isFunction(options)) {
      callback = options
      options = {}
    }
    options = options || {}

    if (!isFunction(callback)) {
      throw new Error('getBuffer: callback must be a function.')
    }

    const rules = whatYouNeed.map(rule => {
      return typeof rule === 'string' ? rule.split('\u0000').join('') : rule
    })

    zip.createReader(new zip.BlobReader(this.file), zipReader => {
      let finished = false

      const finish = (error, result, count) => {
        if (finished) return
        finished = true
        zipReader.close(() => callback(error, result, count))
      }

      zipReader.getEntries(entries => {
        const matched = []

        entries.forEach(entry => {
          rules.forEach(rule => {
            if (matches(rule, entry.filename)) {
              matched.push({ rule, entry })
            }
          })
        })

        // Match the upstream default: for a rule, the last matching entry wins
        // unless `multiple` is explicitly requested.
        let selected
        if (options.multiple) {
          selected = matched
        } else {
          const byRule = Object.create(null)
          matched.forEach(item => { byRule[String(item.rule)] = item })
          selected = Object.keys(byRule).map(key => byRule[key])
        }

        if (!selected.length) {
          finish(null, {}, entries.length)
          return
        }

        const output = {}
        let pending = selected.length

        const completeOne = () => {
          pending--
          if (pending === 0) finish(null, output, entries.length)
        }

        selected.forEach(item => {
          const writer = new zip.BlobWriter()
          item.entry.getData(writer, blob => {
            const save = data => {
              const key = String(item.rule)
              if (options.multiple) {
                if (!output[key]) output[key] = []
                output[key].push({ fileName: item.entry.filename, buffer: data })
              } else {
                output[key] = data
              }
              completeOne()
            }

            if (options.type === 'blob') {
              save(blob)
            } else {
              blobToBuffer(blob, (error, buffer) => {
                if (error) {
                  finish(error)
                  return
                }
                save(buffer)
              })
            }
          })
        })
      })
    }, error => callback(error))
  }
}

module.exports = BrowserUnzip
