const ROPSTEN_ID = 3;

const connectContainer = document.getElementById('connect-container');
const connectedContainer = document.getElementById('connected-container');

const connectButton = connectContainer.querySelector('button');
const approveButton = document.getElementById('approve-button');
const swapButton = document.getElementById('swap-button');
const faucetButton = document.getElementById('faucet-button');

const addressLabel = document.getElementById('address-label');
const rebV1Label = document.getElementById('rebv1-label');
const rebV2Label = document.getElementById('rebv2-label');
const swapRateLabel = swapButton.querySelector('span');

let address;

const rebV1Address = '0xfF96067060626Ea33AF23Eb5b188aaA6763E88d6';
const rebV2Address = '0x9611E3336fb5c84e038a32F6Ad31A25c2D9D0820';
const swapAddress = '0x969f3129813738241E9103dbCc0f8837973CD005';
const faucetAddress = '0xC84F2c6a2d49951681236abd1A05886b8FB6380D';

const rebV1Contract = new Contract();
const rebV2Contract = new Contract();
const swapContract = new Contract();
const faucetContract = new Contract();

load();

async function load() {    
    if (window.ethereum) {
        // window.ethereum.on('chainChanged', () => {
        //   document.location.reload();
        // });
    
        // window.ethereum.on('accountsChanged', function (accounts) {
        //   setAddress(accounts[0]);
        // });

        const networkId = await window.WEB3.eth.net.getId();
        if (networkId !== ROPSTEN_ID) {
            return alert('Please connect to ropsten');
        }

        rebV1Contract.setContract({abi: await xhr('get', 'abi/erc20.abi.json'), address: rebV1Address});
        rebV2Contract.setContract({abi: await xhr('get', 'abi/erc20.abi.json'), address: rebV2Address});
        swapContract.setContract({abi: await xhr('get', 'abi/rebased-swap.abi.json'), address: swapAddress});
        faucetContract.setContract({abi: await xhr('get', 'abi/rebased-test-faucet.abi.json'), address: faucetAddress});

        connectButton.addEventListener('click', function() {
            connectWeb3();
        });

        approveButton.addEventListener('click', function() {
            approve();
        });

        swapButton.addEventListener('click', function() {
            swap();
        });

        faucetButton.addEventListener('click', function () {
            faucet();
        });
    }

    loadAccount();
}

async function connectWeb3() {
    if (!window.ethereum) {
        return alert('Please install Metamask browser extension.');
    }
    await ethereum.request({ method: 'eth_requestAccounts' });
    await loadAccount();
}

async function loadAccount() {
    const [addr] = await ethereum.request({ method: 'eth_requestAccounts' });
    setAddress(addr);
    if (address) await loadBalances();
    completeBootLoader();
}

async function loadBalances() {
    const rebV1Balance = await rebV1Contract.read('balanceOf', [address]);
    const rebV2Balance = await rebV2Contract.read('balanceOf', [address]);

    rebV1Label.innerText = Web3.utils.fromWei(rebV1Balance, 'gwei');
    rebV2Label.innerText = Web3.utils.fromWei(rebV2Balance, 'gwei');

    const allowance = new Web3.utils.BN(await rebV1Contract.read('allowance', [address, swapAddress]));
    console.log('allowance', allowance.toString());

    if (allowance.isZero()) {
        enable(approveButton);
    } else {
        const rate = await swapContract.read('getReb2OutputAmount', [rebV1Balance]);
        console.log('rate', rate);

        enable(swapButton);

        swapRateLabel.innerText = Web3.utils.fromWei(rate, 'gwei');
    }
    
}

async function setAddress(addr) {
    address = addr;
    if (address) {
        addressLabel.innerText = address;

        rebV1Contract.setAccount(address);
        rebV2Contract.setAccount(address);
        swapContract.setAccount(address);
        faucetContract.setAccount(address);
    }
    toggle(connectContainer, !address);
    toggle(connectedContainer, address);
}

async function approve() {
    const balance = new Web3.utils.BN(await rebV1Contract.read('balanceOf', [address]));
    if (balance.isZero()) {
        return alert('Your balance is zero. Request some test tokens from faucet');
    }
    console.log('approving', balance.toString());
    await waitForTxn(await rebV1Contract.write('approve', [swapAddress, balance]));
    await loadBalances();
}

async function swap() {
    const rebV1Balance = await rebV1Contract.read('balanceOf', [address]);
    await waitForTxn(await swapContract.write('swap', [rebV1Balance]));
    await loadBalances();
}

async function faucet() {
    await waitForTxn(await waitForTxn(await faucetContract.write('requestTokens')));
    await loadBalances();
}

function show(el) {
    toggle(el, true);
}

function hide(el) {
    toggle(el, false);
}

function toggle(el, show) {
    el.classList[show ? 'remove' : 'add']('hidden');
}

function enable(el) {
    attr(el, 'disabled', false);
}

function disable(el) {
    attr(el, 'disabled', 'disabled');
}

function attr(el, attribute, val) {
    if (val) {
        el.setAttribute(attribute, val);
    } else {
        el.removeAttribute(attribute);
    }
}

async function xhr(method, endpoint, data) {
    NProgress.start();
    NProgress.set(0.4);
  
    try {
        const opts = {};
        if (data) {
            opts.method = method.toUpperCase();
            opts.body = JSON.stringify(data);
            opts.headers = {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            };
        }
        const res = await fetch(endpoint, opts);
        return await res.json();
    } finally {
        NProgress.done();
    }
}

function completeBootLoader() {
    document.documentElement.classList.remove('anim-loading');
    document.getElementById('loader-container').remove();
    show(document.querySelector('main'));
  }