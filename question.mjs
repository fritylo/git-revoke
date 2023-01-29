import readline from 'readline';

const rl = readline.createInterface(process.stdin, process.stdout);

export function question(message) {
    return new Promise((res, rej) => {
        rl.question(message, answer => {
            res(answer);
        });
    });
};
