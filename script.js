const rootContainer = document.getElementById('root-container');
const loaderContainer = document.getElementById('loader-container');
const connectContainer = document.getElementById('connect-container');
const connectedContainer = document.getElementById('connected-container');
const headerActions = document.getElementById('header-actions');

const connectButton = connectContainer.querySelector('button');
const approveButton = document.getElementById('approve-button');
const swapButton = document.getElementById('swap-button');
const faucetButton = document.getElementById('faucet-button');

const networkLabel = document.getElementById('network-label');
const addressLabel = document.getElementById('address-label');
const rebV1Label = document.getElementById('rebv1-label');
const rebV2Label = document.getElementById('rebv2-label');
const swapRateLabel = document.getElementById('swap-rate-label');

let address;
let config;

const rebV1Contract = new Contract();
const rebV2Contract = new Contract();
const swapContract = new Contract();
const faucetContract = new Contract();

load();

async function load() {    
    if (window.ethereum) {
        registerWeb3();

        // window.ethereum.on('chainChanged', () => {
        //   document.location.reload();
        // });
    
        window.ethereum.on('accountsChanged', function ([account]) {
          setAddress(account);
          loadBalances();
        });

        const networkId = await window.WEB3.eth.net.getId();
        if (!(networkId in CONFIG)) {
            // return sl('error', 'Please connect to mainnet or ropsten testnet.');
            return sl('error', 'Unsupported network.');
        }

        config = CONFIG[networkId];

        networkLabel.innerText = await window.WEB3.eth.net.getNetworkType();

        rebV1Contract.setContract({abi: await xhr('get', 'abis/erc20.abi.json'), address: config.rebV1Address});
        rebV2Contract.setContract({abi: await xhr('get', 'abis/erc20.abi.json'), address: config.rebV2Address});
        swapContract.setContract({abi: await xhr('get', 'abis/rebased-swap.abi.json'), address: config.swapAddress});
        faucetContract.setContract({abi: await xhr('get', 'abis/rebased-test-faucet.abi.json'), address: config.faucetAddress});

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

    connectButton.addEventListener('click', function() {
        connectWeb3();
    });

    loadAccount();
}

async function connectWeb3() {
    if (!window.ethereum) {
        return sl('error', 'Please install Metamask browser extension.');
    }
    await ethereum.request({ method: 'eth_requestAccounts' });
    await loadAccount();
}

async function loadAccount() {
    if (window.ethereum) {
        const [addr] = await ethereum.request({ method: 'eth_requestAccounts' });
        setAddress(addr);
        if (address) await loadBalances();
    } else {
        setAddress();
    }
    completeBootLoader();
}

async function loadBalances() {
    const rebV1Balance = await rebV1Contract.read('balanceOf', [address]);
    const rebV2Balance = await rebV2Contract.read('balanceOf', [address]);

    rebV1Label.innerText = toHumanizedCurrency(Web3.utils.fromWei(rebV1Balance, 'gwei'));
    rebV2Label.innerText = toHumanizedCurrency(Web3.utils.fromWei(rebV2Balance, 'gwei'));

    const rate = await swapContract.read('getReb2OutputAmount', [rebV1Balance]);
    console.log('rate', rate);
    swapRateLabel.innerText = toHumanizedCurrency(Web3.utils.fromWei(rate, 'gwei'));

    const allowance = new Web3.utils.BN(await rebV1Contract.read('allowance', [address, config.swapAddress]));
    console.log('allowance', allowance.toString());
    
    if (allowance.lt(new Web3.utils.BN(rebV1Balance))) {
        enable(approveButton);
    } else {
        enable(swapButton);
    }
    
}

async function setAddress(addr) {
    address = addr;
    if (address) {
        addressLabel.innerText = `${address.substring(0, 6)}...${address.substring(address.length-4, address.length)}`;

        rebV1Contract.setAccount(address);
        rebV2Contract.setAccount(address);
        swapContract.setAccount(address);
        faucetContract.setAccount(address);
    }
    toggle(connectContainer, !address);
    toggle(connectedContainer, address);
    toggle(headerActions, address);
}

async function approve() {
    const balance = new Web3.utils.BN(await rebV1Contract.read('balanceOf', [address]));
    if (balance.isZero()) {
        return sl('error', 'Your balance is zero. Request some test tokens from faucet.');
    }
    console.log('approving', balance.toString());
    await waitForTxn(await rebV1Contract.write('approve', [config.swapAddress, balance]));
    await loadBalances();
}

async function swap() {
    const rebV1Balance = await rebV1Contract.read('balanceOf', [address]);
    await waitForTxn(await swapContract.write('swap', [rebV1Balance]));
    await loadBalances();
}

async function faucet() {
    await waitForTxn(await faucetContract.write('requestTokens'));
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
    loaderContainer.remove();
    show(rootContainer);
}

function sl(type, msg) {
    Swal.fire({
        icon: type,
        text: msg
    })
}

function toHumanizedCurrency(val) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val).replace('$', '');
}