const bluebird = require("bluebird");
const Datastore = require('nedb');
const db = new Datastore({ filename: 'local.db', autoload: true });

const dbPromise = bluebird.promisifyAll(db);

const printLoanAmount = async (currentUser) => {
    currentUser.loans.filter(loan => loan.amount > 0 && currentUser.balance > 0).forEach(loan => {
        console.log(`Owed $${loan.amount} from ${loan.username}`);
    });
}

const printDueAmount = async (currentUser) => {
    currentUser.dues.filter(due => due.amount > 0 && currentUser.balance < 0).forEach(due => {
        console.log(`Owed $${due.amount} to ${due.username}`);
    });
}

const payDues = async (amount, currentUser) => {
    const dues = currentUser.dues;
    let remainingBalace = amount;
    return await Promise.all(dues.map(async due => {
        if (remainingBalace > 0) {
            let payable = due.amount > remainingBalace ? remainingBalace : due.amount;
            await dbPromise.updateAsync({ username: due.username }, { $inc: { amount: -payable } });
            remainingBalace -= payable;
            due.amount -= payable;
            console.log(`Transferred $${payable} to ${due.username}`);
            const targetAccount = await dbPromise.findOneAsync({ username: due.username });
            const loan = targetAccount.loans.filter(loan => loan.username == currentUser.username)[0];
            if (loan) {
                loan.amount -= payable;
                await dbPromise.updateAsync({ _id: targetAccount._id }, targetAccount);
                console.log(`Transferred $${payable} to ${ due.username}`);
            }
        }
        return due;
    }));
}

const login = async username => {
    let isExists = await dbPromise.findOneAsync({ username });
    if (!isExists) {
        isExists = await dbPromise.insertAsync({ username, loggedIn: true, loginAt: new Date(), loans: [], dues: [] });
    } else {
        isExists.loggedIn = true;
        isExists.loginAt = new Date();
        await dbPromise.updateAsync({ username }, isExists);
    }
    console.log(`Hello, ${username}!`);
    const currentUser = await dbPromise.findOneAsync({ username });
    const dueAmount = currentUser.dues.reduce((acc, cur) => acc + cur.amount, 0);
    const balance = currentUser && currentUser.balance ?
        currentUser.balance - dueAmount > 0 ?
            currentUser.balance - dueAmount : 0 : 0
    console.log(`Your balance is $${balance}`);
    await printLoanAmount(currentUser);
    await printDueAmount(currentUser);
}

const logout = async () => {
    const currentUser = await dbPromise.findOneAsync({ loggedIn: true });
    currentUser.loggedIn = false;
    currentUser.loginAt = null;
    await dbPromise.updateAsync({ _id: currentUser._id }, currentUser,)
    console.log(`Goodbye, ${currentUser.username}!`);
}

const deposit = async amount => {
    await dbPromise.updateAsync({ loggedIn: true }, { $inc: { balance: amount } });
    const currentUser = await dbPromise.findOneAsync({ loggedIn: true });
    const balance = currentUser.balance > 0 ? currentUser.balance : 0;
    console.log(`Your balance is $${balance}`);
    if (currentUser.dues && currentUser.dues.length > 0) {
        currentUser.dues = await payDues(amount, currentUser);
        await dbPromise.updateAsync({ username: currentUser.username }, { ...currentUser });
    }
    await printLoanAmount(currentUser);
    await printDueAmount(currentUser);
}

const transfer = async (target, amount) => {
    let targetAccount = await dbPromise.findOneAsync({ username: target });
    if (!targetAccount) throw Error(`target account does not exists`);
    let currentUser = await dbPromise.findOneAsync({ loggedIn: true });
    const transferAmount = currentUser.balance > amount ? amount : +currentUser.balance;
    await dbPromise.updateAsync({ loggedIn: true }, { $inc: { balance: -amount } });
    await dbPromise.updateAsync({ username: target }, { $inc: { balance: amount } });
    currentUser = await dbPromise.findOneAsync({ loggedIn: true });
    targetAccount = await dbPromise.findOneAsync({ username: target });
    console.log(`Transferred $${transferAmount} to ${target}`);

    if (currentUser.balance <= 0) {
        if (currentUser.dues && currentUser.dues.find(due => due.username === target)) {
            due = currentUser.dues.filter(due => due.username === target)[0];
            due.amount += (amount - transferAmount);
        } else {
            currentUser.dues.push({ username: target, amount: (amount - transferAmount) });
        }

        if (targetAccount.loans && targetAccount.loans.find(loan => loan.username === target)) {
            loan = targetAccount.loans.filter(loan => loan.username === target)[0];
            loan.amount += (amount - transferAmount);
        } else {
            targetAccount.loans.push({ username: target, amount: (amount - transferAmount) });
        }
        await dbPromise.updateAsync({ _id: currentUser._id }, currentUser);
        await dbPromise.updateAsync({ _id: targetAccount._id }, targetAccount);
    }

    const balance = currentUser.balance > 0 ? currentUser.balance : 0;
    console.log(`Your balance is $${balance}`);
    await printLoanAmount(currentUser);
    await printDueAmount(currentUser);
}

const clear = () => dbPromise.removeAsync({}, { multi: true });

module.exports = {
    login,
    logout,
    deposit,
    transfer,
    clear
}