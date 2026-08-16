import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptsRoot = dirname(fileURLToPath(import.meta.url))
const packageRoot = dirname(scriptsRoot)
const clientBundlePath = join(packageRoot, 'lib', 'client.js')
const clientBundle = await readFile(clientBundlePath, 'utf8')

const platformPrefix = `\\0dsh-css:${packageRoot}\\src\\client\\`
const portableBundle = clientBundle.split(platformPrefix).join('\\0dsh-css:src/client/')

if (portableBundle.includes(packageRoot)) {
  throw new Error('compiled client bundle still contains the local package path')
}

await writeFile(clientBundlePath, portableBundle, 'utf8')
