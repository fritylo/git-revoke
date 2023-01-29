export async function checkMergeChanges() {
    const mergeChanges = (await exec('git diff --name-only --diff-filter=U --relative'))
        .split('\n')
        .map(line => line.trim())
        .filter(line => line);

    return mergeChanges.length > 0;
}

/**
 * 
 * @param {{
 *   warning: string,
 *   onComplete: () => Promise<void>,
 *   onAbort: () => Promise<void>,
 * }} config 
 * @returns 
 */
export async function whileMergeChanges({
    warning,
    onComplete,
    onAbort,
}) {
    let hasMergeChanges = true;

    while (hasMergeChanges) {
        console.log(warning);            

        const answer = (await question('Y / N: ')).toLowerCase();
        console.log('');

        if (answer === 'y') {
            hasMergeChanges = await checkMergeChanges();

            if (hasMergeChanges)
                continue;

            await onComplete();
            return true; // continue script
        } else {
            await onAbort();
            return false; // abort script
        }
    }
}
