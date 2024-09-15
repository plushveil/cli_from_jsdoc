import * as fs from 'node:fs'
import * as path from 'node:path'
import * as url from 'node:url'

import * as acorn from 'acorn'
import * as walk from 'acorn-walk'
import { parse as parseComment } from 'comment-parser'

/**
 * @typedef {Object} CLI
 * @property {string} name - The name of the CLI.
 * @property {string} file - The file that contains the CLI.
 * @property {Export[]} exports - The exports of the CLI.
 */

/**
 * @typedef {Object} Export
 * @property {string} name - The name of the export.
 * @property {Source} source - The file that contains the export.
 * @property {Object} doc - The JSDOC comment of the export.
 */

/**
 * @typedef {Object} Source
 * @property {string} file - The file that contains the export.
 * @property {string} name - The name of the export in the file.
 */

/**
 * Parses the given file and returns a CLI object.
 * @param {string} file - The file to parse.
 * @param {string} [test] - A test to run.
 * @returns {Promise<CLI>}
 */
export default async function parse (file) {
  if (!fs.existsSync(file)) throw new Error(`File not found: ${file}`)
  if (!fs.statSync(file).isFile()) throw new Error(`Not a file: ${file}`)

  const content = fs.readFileSync(file, 'utf-8')
  const ast = acorn.parse(content, { ecmaVersion: 'latest', sourceType: 'module' })

  /**
   * @type {CLI}
   */
  const cli = {}

  // The name of the CLI.
  cli.name = path.basename(file, path.extname(file))

  // The file that contains the CLI.
  cli.file = file

  // The exports of the CLI.
  cli.exports = []
  walk.simple(ast, {
    ExportAllDeclaration (node) {
      cli.exports.push((async () => {
        const file = import.meta.resolve(node.source.value, url.pathToFileURL(path.dirname(cli.file)))
        const nested = await parse(url.fileURLToPath(file))
        return nested.exports
      })())
    },
    ExportNamedDeclaration (node) {
      if (node.declaration) {
        cli.exports.push({
          name: node.declaration.id.name,
          source: {
            file: cli.file,
            name: node.declaration.id.name
          }
        })
      } else if (node.specifiers) {
        node.specifiers.forEach(specifier => {
          cli.exports.push({
            name: specifier.exported.name,
            source: {
              file: node.source
                ? url.fileURLToPath(import.meta.resolve(node.source.value, url.pathToFileURL(path.dirname(cli.file))))
                : cli.file,
              name: specifier.local.name,
            }
          })
        })
      }
    },
    ExportDefaultDeclaration () {
      cli.exports.push({
        name: 'default',
        source: cli.file
      })
    },
  })
  cli.exports = (await Promise.all(cli.exports)).flat()
  cli.exports = cli.exports.filter(getExportFilter(cli))

  // Find JSDOC comments for each export.
  const getExportDoc = getExportDocGetter(cli, content)
  await Promise.all(cli.exports.map(getExportDoc))

  return cli
}

/**
 * Creates a function that returns the export documentation for the given export.
 * @param {CLI} cli - Neccessary context for the export documentation function.
 * @param {string} content - The content of the file that contains the export.
 * @returns {(exp: Export) => object} - The export documentation function.
 */
function getExportDocGetter (cli, content) {
  return async (exp) => {
    const comments = []
    const code = exp.source.file === cli.file ? content : await fs.promises.readFile(exp.source.file, { encoding: 'utf-8' })
    const ast = acorn.parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      onComment: (block, text, start, end) => {
        comments.push({ block, text, start, end })
      },
    })

    const getText = (before) => {
      return comments.reduce((prev, curr) => {
        if (curr?.end < before) return curr
        else return prev
      }, null)?.text
    }

    walk.simple(ast, {
      FunctionDeclaration (node) {
        if (node.id.name === exp.name) {
          const text = getText(node.start)
          exp.doc = text ? parseComment(`/*${text}*/`, { spacing: 'preserve' })[0] : null
        }
      },
      VariableDeclaration (node) {
        for (const declaration of node.declarations) {
          if (declaration.id.name === exp.name) {
            const text = getText(node.start)
            exp.doc = text ? parseComment(`/*${text}*/`, { spacing: 'preserve' })[0] : null
          }
        }
      },
      ClassDeclaration (node) {
        if (node.id.name === exp.name) {
          const text = getText(node.start)
          exp.doc = text ? parseComment(`/*${text}*/`, { spacing: 'preserve' })[0] : null
        }
      },
    })
  }
}

/**
 * Creates a filter function that filters exports based on the given criteria.
 * @param {CLI} cli - Neccessary context for the filter function.
 * @returns {(exp: Export, i: number, exports: Export[]) => boolean} - The filter function.
 */
function getExportFilter (cli) {
  /**
   * Filters exports based on the given criteria.
   * @param {Export} exp - The current export.
   * @param {number} i - The index of the current export.
   * @param {Export[]} exports - The list of all exports.
   * @returns {boolean} - Whether to keep the export or not.
   */
  return (exp, i, exports) => {
    if (!exp) return false

    const isDuplicate = !!exports.some((other, j) => i !== j && other.name === exp.name)
    if (isDuplicate) {
      const rootExportIndex = exports.findIndex(other => other.name === exp.name && other.source.file === cli.file)
      if (rootExportIndex !== -1) {
        if (i === rootExportIndex) return true
        else return false
      } else {
        const isLastDuplicate = !(exports.some((other, j) => other.name === exp.name && i < j))
        if (isLastDuplicate) return true
        else return false
      }
    }

    return true
  }
}
