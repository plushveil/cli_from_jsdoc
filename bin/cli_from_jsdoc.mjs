import * as path from 'node:path'
import * as fs from 'node:fs'
import * as url from 'node:url'

import * as cli from '../src/cli_from_jsdoc.mjs'

const __filename = url.fileURLToPath(import.meta.url)
const __init = path.resolve(process.argv[1])

if (__init === __filename) {
  try {
    await main(process.cwd())
  } catch (err) {
    console.log(`> cli_from_jsdoc ${process.cwd()} -- ${process.argv.slice(2).join(' ')}`)
    console.error(err)
    process.exit(1)
  }
}

/**
 * Looks for a package.json in the given directory and generates a CLI based on the JSDoc comments in the `main` file.
 * @param {string} cwd - The directory to search for a package.json file.
 */
export default async function main (cwd = process.cwd()) {
  cwd = path.resolve(cwd)

  if (!fs.existsSync(cwd)) throw new Error(`Directory not found: ${cwd}`)
  if (!fs.statSync(cwd).isDirectory()) throw new Error(`Not a directory: ${cwd}`)
  if (!fs.existsSync(path.join(cwd, 'package.json'))) throw new Error(`No package.json found in ${cwd}`)

  const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), { encoding: 'utf-8' }))
  const userProvidedFile = path.resolve(cwd, ...pkg.main.split('/'))

  return await cli.execute(await cli.parse(userProvidedFile), process.argv.slice(2))
}
