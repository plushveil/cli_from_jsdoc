import parseArgv from './parseArgv.mjs'

export { default as parse } from './parse.mjs'

const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

/**
 * @typedef {import('./parse.mjs').CLI} CLI
 */

/**
 * Executes the given CLI with the given arguments.
 * @param {CLI} cli - The CLI to execute.
 * @param {string[]} args - The arguments to pass to the CLI.
 * @returns {Promise<any>} - The result of the CLI execution.
 */
export async function execute (cli, args = process.argv.slice(2)) {
  if (cli.exports.length === 0) throw new Error(`${cli.name} does not provide any executable exports.`)
  if (['-h', '--help'].includes(args[0])) return manual(cli)
  if (cli.exports.find(e => e.name === args[0]) && args.slice(1).find(a => ['-h', '--help'].includes(a))) return manualForExport(cli, args[0])

  const task = cli.exports.length === 1 ? cli.exports[0] : cli.exports.find(e => e.name === args[0])
  if (!task) {
    if (args[0]) console.error(`Unknown task: ${args[0]}`)
    manual(cli)
    process.exit(1)
  }

  let params
  try {
    params = await parseArgv(cli, args)
  } catch (err) {
    console.error(err.message)
    manualForExport(cli, task.name)
    process.exit(1)
  }

  const api = await import(task.source.file)
  const result = await api[task.source.name](...params)
  if (typeof result !== 'undefined') console.log(result)

  const timeout = setTimeout(() => {
    console.error('Side-effects are keeping the process running. Exiting...')
    process.exit(1)
  }, 10000)
  timeout.unref()
}

/**
 * Prints the manual for the given CLI.
 * @param {CLI} cli - The CLI to print the manual for.
 */
function manual (cli) {
  if (cli.exports.length === 1) return manualForExport(cli, cli.exports[0].name)

  console.log(`Usage: ${BOLD}${cli.name}${RESET}${cli.exports.length > 1 ? ' <task>' : ''} [options]`)
  console.log('')

  const whitespace = cli.exports.reduce((max, { name }) => Math.max(max, name.length + 4), 24)
  if (cli.exports.length > 1) {
    console.log('Tasks:')
    for (const { name, doc } of cli.exports) {
      console.log(`  ${name.padEnd(whitespace)} ${doc?.description.trim().replaceAll('\n', '\n'.padEnd(whitespace + 4)) || ''}`)
    }
    console.log('')
  }

  console.log('Options:')
  console.log(`  ${'-h, --help'.padEnd(whitespace)} Display this manual.`)
}

/**
 * Prints the manual for the given CLI for a specific export.
 * @param {CLI} cli - The CLI to print the manual for.
 * @param {string} name - The task to print the manual for.
 */
function manualForExport (cli, name) {
  const task = cli.exports.find(e => e.name === name)
  const taskName = cli.exports.length > 1 ? ` ${task.name}` : ''
  const args = task.doc?.tags.filter(t => t.tag === 'param' && t.optional === false) || []
  const options = task.doc?.tags.filter(t => t.tag === 'param' && t.optional === true) || []
  const whitespace = Math.max(
    args.reduce((max, { name }) => Math.max(max, name.length + 4), 0),
    options.reduce((max, { name, type }) => Math.max(max, `-X, --${name} ${type === 'boolean' ? '' : ` <${type}>`}`.length + 4), 0),
    24
  )

  console.log(`Usage: ${BOLD}${cli.name}${RESET}${taskName}${args.length ? ' ' + args.map(arg => `<${arg.name}>`).join(' ') : ''} [options]`)
  console.log('')
  console.log(task.doc.description.trim())
  console.log('')

  if (args.length) {
    console.log('Arguments:')
    for (const arg of args) {
      console.log(`  ${`<${arg.name}>`.padEnd(whitespace)} ${arg.description.replace(/^[ -]*/, '').trim()}`)
    }
    console.log('')
  }

  console.log('Options:')
  console.log(`  ${'-h, --help'.padEnd(whitespace)} Display this manual.`)
  if (options.length) {
    for (const option of options) {
      const shortcutConfilct = options.find(o => o.name.slice(0, 1) === option.name.slice(0, 1) && o !== option)
      const shortcut = shortcutConfilct ? '' : `-${option.name.slice(0, 1)}, `
      const param = option.type === 'boolean' ? '' : ` <${option.type}>`
      const defaultValue = option.default ? ` Defaults to ${option.default}.` : ''
      console.log(`  ${`${shortcut}--${option.name}${param}`.padEnd(whitespace)} ${option.description.replace(/^[ -]*/, '').trim()}${defaultValue}`)
    }
  }
}
