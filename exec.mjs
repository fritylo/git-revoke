import { execSync } from 'child_process';

export async function exec(command, onError = undefined) {
    try {
        return execSync(command).toString();
    } catch (err) {
        if (onError) {
            const onErrorRes = await onError(err);

            if (onErrorRes !== true) {
                console.log(`\nERROR: ${err.message}`);
                process.exit();
            }
        } else {
            console.log(`\nERROR: ${err.message}`);
            process.exit();
        }
    }
}

export async function execWithLog(command, onError = undefined) {
    const input = '> ' + command;
    console.log(input);

    const res = await exec(command, onError);
    
    const output = res
        ? res
            .split('\n')
            .filter(line => line.trim())
            .map((line) => '  < ' + line)
            .join('\n')
        : '';
        
    if (output) {
        console.log(output);
    }
    console.log('');

    return res;
}
