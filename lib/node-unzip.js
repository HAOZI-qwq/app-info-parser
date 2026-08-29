const yauzl = require('yauzl')

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
    return rule.test(entryName)
  }
  return false
}

class NodeUnzip {
  constructor (file) {
    this.file = file
  }

  destroy () {
    this.file = null
  }

  _open (callback) {
    if (!this.file) {
      callback(new Error('ZIP source has been destroyed.'))
      return
    }
    yauzl.open(this.file, { lazyEntries: true, autoClose: false }, callback)
  }

  getEntryNames (callback) {
    if (!isFunction(callback)) throw new Error('getEntryNames: callback must be a function.')

    this._open((error, zipfile) => {
      if (error) {
        callback(error)
        return
      }

      const names = []
      let finished = false

      const finish = err => {
        if (finished) return
        finished = true

        const done = () => callback(err || null, err ? undefined : names)
        zipfile.once('close', done)
        try {
          zipfile.close()
        } catch (closeError) {
          zipfile.removeListener('close', done)
          callback(err || closeError)
        }
      }

      zipfile.on('error', finish)
      zipfile.on('entry', entry => {
        names.push(entry.fileName)
        zipfile.readEntry()
      })
      zipfile.on('end', () => finish(null))
      zipfile.readEntry()
    })
  }

  getBuffer (whatYouNeed, options, callback) {
    if (!Array.isArray(whatYouNeed)) {
      if (isFunction(callback)) callback(new Error('getBuffer: invalid param, expect first param to be an Array.'))
      return
    }

    if (isFunction(options)) {
      callback = options
      options = {}
    }
    options = options || {}

    if (!isFunction(callback)) throw new Error('getBuffer: callback must be a function.')

    const rules = whatYouNeed.map(rule => {
      return typeof rule === 'string' ? rule.split('\u0000').join('') : rule
    })
    const multiple = Boolean(options.multiple)

    this._open((error, zipfile) => {
      if (error) {
        callback(error)
        return
      }

      const output = {}
      const completedRules = new Set()
      let finished = false

      const finish = (err, result) => {
        if (finished) return
        finished = true

        const done = () => callback(err || null, err ? undefined : result, zipfile.entryCount)
        zipfile.once('close', done)
        try {
          zipfile.close()
        } catch (closeError) {
          zipfile.removeListener('close', done)
          callback(err || closeError)
        }
      }

      zipfile.on('error', error => finish(error))
      zipfile.on('entry', entry => {
        const matchedRules = rules.filter(rule => {
          if (!multiple && completedRules.has(String(rule))) return false
          return matches(rule, entry.fileName)
        })

        if (!matchedRules.length) {
          zipfile.readEntry()
          return
        }

        zipfile.openReadStream(entry, (streamError, readStream) => {
          if (streamError) {
            finish(streamError)
            return
          }

          const chunks = []
          readStream.on('error', streamErr => finish(streamErr))
          readStream.on('data', chunk => chunks.push(chunk))
          readStream.on('end', () => {
            if (finished) return
            const buffer = Buffer.concat(chunks)

            matchedRules.forEach(rule => {
              const key = String(rule)
              if (multiple) {
                if (!output[key]) output[key] = []
                output[key].push({ fileName: entry.fileName, buffer })
              } else {
                output[key] = buffer
                completedRules.add(key)
              }
            })

            if (!multiple && completedRules.size >= rules.length) {
              finish(null, output)
            } else {
              zipfile.readEntry()
            }
          })
        })
      })

      zipfile.on('end', () => finish(null, output))
      zipfile.readEntry()
    })
  }
}

module.exports = NodeUnzip
