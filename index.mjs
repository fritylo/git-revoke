import process from 'process';

import { help } from './help.mjs';
import { exec, execWithLog } from './exec.mjs';
import { question } from './question.mjs';
import { whileMergeChanges } from './merge-changes.mjs';
import { getArg } from './argv.mjs';

async function main() {
    const argv = process.argv.slice(2);

    const reviveAt = getArg(argv, /^--revive-at=/);

    if (argv.length === 0) {
        console.log('No hash provided. Exit...');
        help();
        return;
    }

    if (argv[0] === '--help') {
        help();
        return;
    }

    const mergeHash = getArg(argv, /^(?!--)/);
    const mergeMessage = await exec(`git log -n 1 --pretty=format:%s ${mergeHash}`);
    
    const isMergeCommit = /^Merge branch '/.test(mergeMessage);
    
    if (!isMergeCommit) {
        console.log(
            'ERROR: Cannot revoke usual commit. Provide hash for MERGE commit!' + '\n' + 
            'P.S.: Merge commit - when message in format `Merge branch \'...\'`'
        );
        return;
    }
    
    const currentBranch = (await exec('git rev-parse --abbrev-ref HEAD')).trim();
    
    const branchName = mergeMessage.match(/^Merge branch '(.*?)'/)[1];
    const branchList = (await exec('git branch --all'))
        .split('\n')
        .map(l => l.replace(/\*?\s+/, ''));

    const existsLocal = branchList.findIndex(b => b === branchName) >= 0;
    const existsRemote = branchList.findIndex(b => b === `origin/${branchName}`) >= 0;
    
    if (existsLocal) {
        await execWithLog(`git branch -d ${branchName}`);
        
        if (existsRemote) {
            await execWithLog(`git push -d origin ${branchName}`);
        }
    }

    await execWithLog(`git revert -n -m 1 ${mergeHash}`, async () => {
        return await whileMergeChanges({
            warning: '\n' +
                'WARN: Revert conflicts:' + '\n' + 
                '   Y - I have fixed conflicts, continue' + '\n' +
                '   N - Abort revoke command' + '\n',
            onComplete: async () => {
                await execWithLog('git revert --continue', async err => {
                    await execWithLog('git revert --skip');
                    return true;
                });
            },
            onAbort: async () => {
                await execWithLog('git revert --abort');
            },
        })
    });

    await execWithLog(`git commit --allow-empty -m "Revoke \\"${mergeMessage}\\""`);
    
    if (reviveAt) {
        await execWithLog(`git checkout ${reviveAt}`);
        await execWithLog(`git pull`);
    }

    await execWithLog(`git checkout -b ${branchName}`);

    await execWithLog(`git cherry-pick -n -m 1 ${mergeHash}`, async () => {
        return await whileMergeChanges({
            warning: '\n' +
                'WARN: Cherry-pick conflicts:' + '\n' + 
                '   Y - I have fixed conflicts, continue' + '\n' +
                '   N - Abort cherry-pick command' + '\n',
            onComplete: async () => {},
            onAbort: async () => {
                await execWithLog('git cherry-pick --abort');
            },
        });
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
}

main()
    .then(() => process.exit())
    .catch(err => {
        throw err;
    })