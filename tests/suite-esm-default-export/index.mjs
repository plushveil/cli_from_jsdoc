/**
 * The description of the default export.
 * @param {number} arg1 - The first argument.
 * @param {number} [arg2=0] - The second argument.
 * @param {object} [arg3={}] - The third argument.
 */
export default async function main (arg1, arg2 = 0, arg3 = {}) {
  return [arg1, arg2, arg3]
}
