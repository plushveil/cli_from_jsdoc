/**
 * @typedef {import('./parse.mjs').CLI} CLI
 */

/**
 * @typedef {import('./parse.mjs').Export} Export
 */

/**
 * Parses the given arguments for the given CLI.
 * @param {CLI} cli - The CLI to parse arguments for.
 * @param {string[]} args - The arguments to parse.
 * @returns {Promise<any>} - The parsed arguments.
 */
export default async function parseArgv (cli, args) {
  /** @type {Export} */
  const program = cli.exports.length >= 1 ? cli.exports[0] : cli.exports.find(e => e.name === args[0])
  if (!program) throw new Error(`Invalid command line arguments: ${args.join(' ')}`)
  if (cli.exports.length > 1) args.shift()

  const parsed = []

  // required parameters
  const params = program.doc.tags.filter(t => t.tag === 'param' && t.optional === false)
  if (params.length === 1) {
    const firstParam = []
    while (args.length && !args[0].startsWith('-')) firstParam.push(args.shift())
    parsed.push(getValue(firstParam.join(' '), params[0]))
  } else if (params.length > 1) {
    for (const param of params) {
      const value = getValue(args.shift(), param)
      parsed.push(value)
    }
  }

  // parse optional parameter keywords
  const optionMap = {}
  const options = program.doc.tags.filter(t => t.tag === 'param' && t.optional === true)
  const keywords = options.reduce((keywords, option) => {
    const kws = [`--${option.name}`, `-${option.name}`, `-${option.name.slice(0, 1)}`]
    if (option.type === 'boolean') kws.push(...[`--no-${option.name}`, `-no-${option.name}`])
    keywords.push(...kws)
    for (const kw of kws) optionMap[kw] = option
    return keywords
  }, [])

  for (const kw of keywords.filter((kw, i, kws) => kws.indexOf(kw) === i)) {
    if (keywords.indexOf(kw) === keywords.lastIndexOf(kw)) continue
    while (keywords.includes(kw)) keywords.splice(keywords.indexOf(kw), 1)
  }

  // check for invalid arguments
  if (parsed.find(p => keywords.find(k => p?.startsWith?.(k)))) {
    throw new Error(`You likely passed an option before specifying all arguments. Invalid arguments: ${parsed.join(' ')}`)
  }

  // parse optional parameters
  const optionObj = {}
  const argString = args.join(' ')
  const optionMatches = keywords.length ? [...(' ' + argString).matchAll(new RegExp(` (${keywords.sort((a, b) => b.length - a.length).join('|')})`, 'g'))] : []
  if (optionMatches.length) {
    const first = optionMatches.reduce((match, m) => match.index < m.index ? match : m, { index: Infinity })
    if (first.index !== 0) throw new Error(`Unknown argument: ${argString.slice(0, first.index)}`)
  }

  for (let i = 0; i < optionMatches.length; i++) {
    const optionInput = optionMatches[i]
    const optionName = optionMatches[i][1]
    const option = optionMap[optionName]
    const optionString = argString.slice(optionInput.index, optionMatches[i + 1]?.index)
    const valueString = optionString.slice(optionString.indexOf(' ') + 1)

    const ctx = getContext(option.name, optionObj)
    const value = getValue(valueString, option)
    const key = option.name.split('.').pop()
    if (option.type.endsWith('[]') || option.type.toLowerCase().startsWith('array<')) {
      if (!ctx[key]) ctx[key] = []
      ctx[key].push(...value)
    } else {
      ctx[key] = value
    }
  }

  // sort options by function argument order (according to jsdoc, not function signature)
  for (const option of options) {
    if (option.name.includes('.')) continue
    const value = optionObj[option.name]
    parsed.push(value)
  }

  while (typeof parsed[parsed.length - 1] === 'undefined') parsed.pop()
  if (parsed.length < params.length) {
    throw new Error(`Missing required arguments: ${params.slice(parsed.length).map(p => `<${p.name}>`).join(' ')}`)
  }

  return parsed
}

/**
 * Gets the value for the given value string and option.
 * @param {string} valueString - The value string to parse.
 * @param {object} option - The option object.
 * @returns {any} - The parsed value.
 */
function getValue (valueString, option) {
  if (option.type === 'boolean') {
    if (valueString.includes('-')) {
      while (valueString.startsWith('-')) valueString = valueString.slice(1)
      return !valueString.startsWith('no-')
    } else {
      if (valueString === 'false' || valueString === '0' || valueString.toLowerCase().startsWith('n')) return false
      if (valueString === 'true' || valueString === '1' || valueString.toLowerCase().startsWith('y')) return true
      throw new Error(`Invalid boolean: ${valueString}`)
    }
  }
  if (option.type === 'number') {
    const value = (valueString.includes('.')) ? parseFloat(valueString) : Number(valueString)
    if (isNaN(value)) throw new Error(`Invalid number: ${valueString}`)
    return value
  }
  if (option.type === 'string') return String(valueString)
  if (option.type.endsWith('[]') || option.type.toLowerCase().startsWith('array<')) {
    if (valueString.startsWith('[') && valueString.endsWith(']')) return JSON.parse(valueString)
    else {
      return valueString.split(',').map(v => {
        if (option.type.endsWith('[]')) return getValue(v, { type: option.type.slice(0, -2) })
        else return getValue(v, { type: option.type.slice(6, -1) })
      })
    }
  }
  if (option.type === 'object') return valueString ? JSON.parse(valueString) : {}
  return valueString
}

/**
 * Gets the context for the given option string.
 * @param {string} optionName - The name of the option.
 * @param {object} ctx - The context object.
 * @returns {object} - The context object.
 */
function getContext (optionName, ctx) {
  const key = optionName.split(' ')[0]

  const keys = key.split('.')
  for (let i = 0; i < keys.length - 1; i++) {
    if (!ctx[keys[i]]) ctx[keys[i]] = {}
    ctx = ctx[keys[i]]
  }

  return ctx
}
