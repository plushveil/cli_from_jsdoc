/**
 * The description of the main export.
 * @param {number} arg1 - The first argument.
 * @param {number} [arg2=0] - The second argument.
 * @param {object} [arg3={}] - The third argument.
 */
export async function main (arg1, arg2 = 0, arg3 = {}) {
  return [arg1, arg2, arg3]
}

/**
 * The description of the test export.
 * @param {number} arg1 - The first argument.
 * @param {number} [arg2=0] - The second argument.
 * @param {object} [arg3={}] - The third argument.
 */
export async function test (arg1, arg2 = 0, arg3 = {}) {
  return [arg1, arg2, arg3]
}
