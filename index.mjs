import process from 'process';
import { execSync } from 'child_process';
import readline from 'readline';

var rl = readline.createInterface(process.stdin, process.stdout);
var question = function (q) {
    return new Promise((res, rej) => {
        rl.question(q, answer => {
            res(answer);
        });
    });
};

async function exec(command, onError = undefined) {
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

async function execWithLog(command, onError = undefined) {
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

async function checkMergeChanges() {
    const mergeChanges = (await exec('git diff --name-only --diff-filter=U --relative'))
        .split('\n')
        .map(line => line.trim())
        .filter(line => line);

    return mergeChanges.length > 0;
}

function help() {
    console.log(`
================================================
Git command to revert merge commits without pain
================================================

Usage:
    revoke <merge_commit_hash>
    revoke 928e58ad
        
Before usage:
    Checkout branch with merge commit

How it works:
    1) Delete local branch of merge (if present)
    2) Delete remote branch of merge (if present)
    3) Revert merge commit
    4) Create copy of merge branch
    5) Cherry-pick merge changes to the copy
    6) Print suggestions for changes pushing

© fritylo 2023, license MIT
    `);
}

async function main() {
    const argv = process.argv.slice(2);

    if (argv.length === 0) {
        console.log('No hash provided. Exit...');
        help();
        return;
    }

    if (argv[0] === '--help') {
        help();
        return;
    }

    const [mergeHash] = argv;
    const mergeMessage = await exec(`git log -n 1 --pretty=format:%s ${mergeHash}`);
    
    if (/^Merge branch '/.test(mergeMessage)) {
        const currentBranch = (await exec('git rev-parse --abbrev-ref HEAD')).trim();

        const branchName = mergeMessage.match(/^Merge branch '(.*?)'/)[1];
        
        const branchList = (await exec('git branch --all')).split('\n').map(l => l.replace(/\*?\s+/, ''));
        
        const existsLocal = branchList.findIndex(b => b === branchName) >= 0;
        const existsRemote = branchList.findIndex(b => b === `origin/${branchName}`) >= 0;
        
        if (existsLocal) {
            await execWithLog(`git branch -d ${branchName}`);
            
            if (existsRemote) {
                await execWithLog(`git push -d origin ${branchName}`);
            }
        }

        await execWithLog(`git revert -m 1 ${mergeHash}`, async err => {
            let hasMergeChanges = true;

            while (hasMergeChanges) {
                console.log(
                    '\n' +
                    'WARN: Revert conflicts:' + '\n' + 
                    '   Y - I have fixed conflicts, continue' + '\n' +
                    '   N - Abort revoke command' + '\n'
                );            

                const answer = (await question('Y / N: ')).toLowerCase();
                console.log('');

                if (answer === 'y') {
                    hasMergeChanges = await checkMergeChanges();

                    if (hasMergeChanges)
                        continue;

                    await execWithLog('git revert --continue', async err => {
                        await execWithLog('git revert --skip');
                        return true;
                    });
                    return true; // continue script
                } else {
                    await execWithLog('git revert --abort');
                    return false; // abort script
                }
            }
        });

        await execWithLog(`git checkout -b ${branchName}`);

        await execWithLog(`git cherry-pick -n -m 1 ${mergeHash}`, async err => {
            let hasMergeChanges = true;

            while (hasMergeChanges) {
                console.log(
                    '\n' +
                    'WARN: Cherry-pick conflicts:' + '\n' + 
                    '   Y - I have fixed conflicts, continue' + '\n' +
                    '   N - Abort cherry-pick command' + '\n'
                );

                const answer = (await question('Y / N: ')).toLowerCase();
                console.log('');

                if (answer === 'y') {
                    hasMergeChanges = await checkMergeChanges();

                    if (hasMergeChanges)
                        continue;
                    
                    return true; // continue script
                } else {
                    await execWithLog('git cherry-pick --abort');
                    return false; // abort script
                }
            }
        });

        await execWithLog(`git commit --allow-empty -m "Revive '${branchName}' changes"`);
        
        console.log('Success!!!');
        
        console.log(
            '\n' +
            'Do you want to push changes?' + '\n' +
            `   git push -u origin ${branchName} && git checkout ${currentBranch} && git push`
        );
        
        const answer = (await question('Y (push) / N (finish): ')).toLowerCase();
        console.log('');

        if (answer === 'y') {
            await execWithLog(`git push -u origin ${branchName}`);
            await execWithLog(`git checkout ${currentBranch}`);
            await execWithLog(`git push`);
        } else {
            console.log('Good bye!!!');
        }
    } else {
        console.log('ERROR: Cannot revoke usual commit. Provide hash for MERGE commit!\nP.S.: Merge commit - when message in format `Merge branch \'...\'`');
    }
}

main()
    .then(() => process.exit())
    .catch(err => {
        throw err;
    })