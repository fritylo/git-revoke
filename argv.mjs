/**
 * @param {string[]} argv 
 * @param {RegExp} regex 
 * @returns {null | string}
 */
export function getArg(argv, regex) {
    const res = argv.find(token => regex.test(token));

    if (res) {
        const value = res
            .replace(regex, '')
            .replace(/^['"]/, '')
            .replace(/['"]$/, '');

        return value;
    } else {
        return null;
    }
}
