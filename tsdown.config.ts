import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const harnessRoot = process.env.DSH_SOURCE_ROOT
if (!harnessRoot) {
  throw new Error('DSH_SOURCE_ROOT must point to a DeepSeek Harness source checkout')
}
const { clientBundle } = await import(
  pathToFileURL(resolve(harnessRoot, 'packages/client/tsdown.client.ts')).href
)

export default clientBundle('dsh-external-trajectory-importer', ['lib/types/index.js'])
