const ABI_ORDER = [
  'armeabi',
  'armeabi-v7a',
  'arm64-v8a',
  'x86',
  'x86_64',
  'mips',
  'mips64',
  'riscv64'
]

function findApkAbis (entryNames) {
  const found = new Set()

  for (const name of entryNames || []) {
    const match = /^lib\/([^/]+)\/[^/]+\.so$/i.exec(name)
    if (!match) continue
    found.add(match[1])
  }

  const ordered = ABI_ORDER.filter(abi => found.has(abi))
  Array.from(found)
    .filter(abi => ABI_ORDER.indexOf(abi) === -1)
    .sort()
    .forEach(abi => ordered.push(abi))

  return ordered
}

module.exports = {
  findApkAbis
}
