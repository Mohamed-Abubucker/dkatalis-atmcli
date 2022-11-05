const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const { login, logout, deposit, transfer, clear } = require('./operations');

const argv = yargs(hideBin(process.argv)).argv;

console.log(argv);

switch (argv._[0]) {
    case 'login':
        login(argv._[1]).catch(err => console.error(err, 'login failed'));
        break;
    case 'logout':
        logout().catch(err => console.error(err, 'logout failed'));
        break;
    case 'deposit':
        deposit(argv._[1]).catch(err => console.error(err, 'deposit failed'));
        break;
    case 'transfer':
        transfer(argv._[1], argv._[2]).catch(err => console.error(err, 'transfer failed'));
        break;
    case 'clear':
        clear().then(() => console.log('database flushed!')).catch(err => console.error(err, 'transfer failed'));
        break;
}