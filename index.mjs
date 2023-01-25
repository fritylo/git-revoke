import process from 'process';
import { execSync } from 'child_process';

function exec(command) {
    try {
        return execSync(command).toString();
    } catch (err) {
        console.log(`ERROR: ${err.message}`);
        process.exit();
    }
}

function execWithLog(command) {
    const input = '> ' + command;
    console.log(input);

    const res = exec(command);
    
    const output = res
        .split('\n')
        .filter(line => line.trim())
        .map((line) => '  < ' + line)
        .join('\n');
        
    if (output) {
        console.log(output);
    }
    console.log('');

    return res;
}

function main() {
    const argv = process.argv.slice(2);

    if (argv.length === 0) {
        console.log('No hash provided. Exit...');
        return;
    }

    const [mergeHash] = argv;
    const mergeMessage = exec(`git log -n 1 --pretty=format:%s ${mergeHash}`);
    
    if (/^Merge branch '/.test(mergeMessage)) {
        const currentBranch = exec('git rev-parse --abbrev-ref HEAD').trim();

        const branchName = mergeMessage.match(/^Merge branch '(.*?)'/)[1];
        
        const branchList = exec('git branch --all').split('\n').map(l => l.replace(/\*?\s+/, ''));
        
        const existsLocal = branchList.findIndex(b => b === branchName) >= 0;
        const existsRemote = branchList.findIndex(b => b === `origin/${branchName}`) >= 0;
        
        if (existsLocal) {
            execWithLog(`git branch -d ${branchName}`);
            
            if (existsRemote) {
                execWithLog(`git push -d origin ${branchName}`);
            }
        }

        execWithLog(`git revert -m 1 ${mergeHash}`);

        execWithLog(`git checkout -b ${branchName}`);

        const cherryPickOutput = execWithLog(`git cherry-pick -n -m 1 ${mergeHash}`);
        if (cherryPickOutput !== '') {
            console.log(
                'ERROR: Problems while cherry-pick:' + '\n' + 
                '   1) Fix conflicts' + '\n' + 
                '   2) Run:' + '\n' + 
                `       git commit -m "Revive '${branchName}' changes"` + '\n' + 
                '   3) Success!!! Run:`' + '\n' +
                `       git push -u origin ${branchName} && git checkout ${currentBranch} && git push`
            );
            return;
        }

        execWithLog(`git commit -m "Revive '${branchName}' changes"`);
        
        console.log('Success!!! Do the following');
        console.log(`git push -u origin ${branchName} && git checkout ${currentBranch} && git push`);
    } else {
        console.log('ERROR: Cannot revoke usual commit. Provide hash for MERGE commit!\nP.S.: Merge commit - when message in format `Merge branch \'...\'`');
    }
}

main();