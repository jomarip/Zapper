const { ethers, network } = require("hardhat");
import chai from "chai";
import { expect } from "chai";
import {
    Contract,
    ContractFactory,
    Signer,
    BigNumber
} from "ethers";
import {
    snowball_addr, treasury_addr,
    WAVAX_ADDR
} from "./static";
import { log } from "./log";
import {
    overwriteTokenAmount,
    increaseTime,
    increaseBlock,
    fastForwardAWeek,
    returnWalletBal,
    returnBal,
    printBals,
    getBalances,
} from "./helpers";


export async function userWalletAssetBalance(txnAmt: string, assetContract: Contract, walletSigner: Signer) {
    let BNBal = await assetContract.balanceOf(await walletSigner.getAddress());
    log(`The balance of BNBal is ${BNBal}`);

    const BN = ethers.BigNumber.from(txnAmt)._hex.toString();
    log(`The balance of BN is ${BN}`);

    expect(BNBal).to.be.equals(BN);
}

export async function vaultHasBalance(YYVault: Contract, walletSigner: Signer) {
    let BNBal = await YYVault.balanceOf(await walletSigner.getAddress());
    expect(BNBal).to.be.equals(BigNumber.from("0x0"));
}

export async function controllerGlobeConfigure(Controller: Contract, asset_addr: string, yyVault_addr: string) {
    expect(await Controller.vaults(asset_addr)).to.contains(yyVault_addr);
}

export async function controllerStrategyConfigure(Controller: Contract, asset_addr: string, strategy_addr: string) {
    expect(await Controller.strategies(asset_addr)).to.be.equals(strategy_addr);
}

export async function harvestsMakeMoney(Strategy: Contract, harvester: Function) {
    let initialBalance;
    [, initialBalance] = await harvester();

    let newBalance = await Strategy.balanceOf();
    log(`initial balance: ${initialBalance}`);
    log(`new balance: ${newBalance}`);
    expect(newBalance).to.be.gt(initialBalance);
}

export async function vaultDepositWithdraw(assetContract: Contract, YYVault: Contract, walletSigner: Signer, txnAmt = "250000000000000000000000000") {
    let yyVault_addr = YYVault.address;
    let wallet_addr = await walletSigner.getAddress();
    await assetContract.approve(yyVault_addr, txnAmt);
    let balBefore = await assetContract.connect(walletSigner).balanceOf(yyVault_addr);
    await YYVault.connect(walletSigner).depositAll();

    let userBal = await assetContract.connect(walletSigner).balanceOf(wallet_addr);
    expect(userBal).to.be.equals(BigNumber.from("0x0"));

    let balAfter = await assetContract.connect(walletSigner).balanceOf(yyVault_addr);
    expect(balBefore).to.be.lt(balAfter);

    await YYVault.connect(walletSigner).withdrawAll();

    userBal = await assetContract.connect(walletSigner).balanceOf(wallet_addr);
    expect(userBal).to.be.gt(BigNumber.from("0x0"));
}

export async function strategyLoadedWithBalance(assetContract: Contract, YYVault: Contract, Strategy: Contract, walletSigner: Signer, txnAmt = "250000000000000000000000000") {

    let yyVault_addr = YYVault.address;
    await assetContract.approve(yyVault_addr, txnAmt);
    await YYVault.connect(walletSigner).depositAll();

    await YYVault.connect(walletSigner).reinvest();

    let strategyBalance = await Strategy.balanceOf();
    expect(strategyBalance).to.not.be.equals(BigNumber.from("0x0"));
}

export async function changeFeeDistributor(Strategy: Contract, governanceSigner: Signer, wallet_addr: string) {
    await Strategy.connect(governanceSigner).setFeeDistributor(wallet_addr);
    const feeDistributor = await Strategy.feeDistributor();
    expect(feeDistributor).to.be.equals(wallet_addr);
}

export async function changeKeepAmountForFees(Strategy: Contract, timelockSigner: Signer) {
    await Strategy.connect(timelockSigner).setKeep(10);
    let keep = await Strategy.keep();
    expect(keep).to.be.equals(10);
}

export async function usersEarnMoney(assetContract: Contract, YYVault: Contract, Strategy: Contract, walletSigner: Signer, txnAmt: string, slot: number) {
    let asset_addr = assetContract.address
    let yyVault_addr = YYVault.address
    let wallet_addr = await walletSigner.getAddress()

    await overwriteTokenAmount(asset_addr, wallet_addr, txnAmt, slot);
    let amt = await assetContract.connect(walletSigner).balanceOf(wallet_addr);

    await assetContract.connect(walletSigner).approve(yyVault_addr, amt);
    await YYVault.connect(walletSigner).deposit(amt);
    await YYVault.connect(walletSigner).reinvest();

    await fastForwardAWeek();

    await Strategy.connect(walletSigner).harvest();
    await increaseBlock(1);

    await YYVault.connect(walletSigner).withdrawAll();
    let newAmt = await assetContract.connect(walletSigner).balanceOf(wallet_addr);

    expect(amt).to.be.lt(newAmt);
}

export async function takeNoFees(assetContract: Contract, YYVault: Contract, Strategy: Contract, walletSigner: Signer, timelockSigner: Signer, txnAmt: string, slot: number) {
    let asset_addr = assetContract.address
    let yyVault_addr = YYVault.address
    let wallet_addr = await walletSigner.getAddress()

    await overwriteTokenAmount(asset_addr, wallet_addr, txnAmt, slot);
    let amt = await assetContract.connect(walletSigner).balanceOf(wallet_addr);

    await assetContract.connect(walletSigner).approve(yyVault_addr, amt);
    await YYVault.connect(walletSigner).deposit(amt);
    
    await fastForwardAWeek();

    // Set PerformanceTreasuryFee
    await Strategy.connect(timelockSigner).setPerformanceTreasuryFee(0);

    // Set KeepPNG
    await Strategy.connect(timelockSigner).setKeep(0);
    let snobContract = await ethers.getContractAt("ERC20", snowball_addr, walletSigner);

    const vaultBefore = await YYVault.balance();
    const treasuryBefore = await assetContract.connect(walletSigner).balanceOf(treasury_addr);
    const snobBefore = await snobContract.balanceOf(treasury_addr);

    await Strategy.connect(walletSigner).reinvest();
    await increaseBlock(1);

    const vaultAfter = await YYVault.balance();
    const treasuryAfter = await assetContract.connect(walletSigner).balanceOf(treasury_addr);
    const snobAfter = await snobContract.balanceOf(treasury_addr);
    const reinvestt = vaultAfter.sub(vaultBefore);
    const reinvesttTTreasury = treasuryAfter.sub(treasuryBefore);
    const snobAccrued = snobAfter.sub(snobBefore);
    log(`\t💸YYVault profit after harvest: ${reinvestt.toString()}`);
    log(`\t💸Treasury profit after harvest:  ${reinvesttTTreasury.toString()}`);
    log(`\t💸Snowball token accrued : ${snobAccrued}`);
    expect(snobAccrued).to.be.lt(1);
    expect(reinvesttTTreasury).to.be.lt(1);
}

export async function takeSomeFees(harvester: Function, assetContract: Contract, YYVault: Contract, Strategy: Contract, walletSigner: Signer, timelockSigner: Signer, txnAmt: string, slot: number) {
    let asset_addr = assetContract.address
    let yyVault_addr = YYVault.address
    let wallet_addr = await walletSigner.getAddress()

    // Set PerformanceTreasuryFee
    await Strategy.connect(timelockSigner).setPerformanceTreasuryFee(0);
    // Set KeepPNG
    await Strategy.connect(timelockSigner).setKeep(1000);

    let snobContract = await ethers.getContractAt("ERC20", snowball_addr, walletSigner);

    const vaultBefore = await YYVault.balance();
    const treasuryBefore = await assetContract.connect(walletSigner).balanceOf(treasury_addr);
    const snobBefore = await snobContract.balanceOf(treasury_addr);
    log(`snobBefore: ${snobBefore.toString()}`);
    log(`vaultBefore: ${vaultBefore.toString()}`);

    let initialBalance;
    [, initialBalance] = await harvester();

    let newBalance = await Strategy.balanceOf();
    log(`initial balance: ${initialBalance}`);
    log(`new balance: ${newBalance}`);

    const vaultAfter = await YYVault.balance();
    const treasuryAfter = await assetContract.connect(walletSigner).balanceOf(treasury_addr);
    const snobAfter = await snobContract.balanceOf(treasury_addr);
    log(`snobAfter: ${snobAfter.toString()}`);
    log(`vaultAfter: ${vaultAfter.toString()}`);
    const reinvestt = vaultAfter.sub(vaultBefore);
    const reinvesttTTreasury = treasuryAfter.sub(treasuryBefore);
    const snobAccrued = snobAfter.sub(snobBefore);
    log(`\t💸YYVault profit after harvest: ${reinvestt.toString()}`);
    log(`\t💸Treasury profit after harvest:  ${reinvesttTTreasury.toString()}`);
    log(`\t💸Snowball token accrued : ${snobAccrued}`);
    expect(snobAccrued).to.be.gt(1);
    // expect(reinvesttTTreasury).to.be.gt(BigNumber.from(1));
}


export async function zapInToken(txnAmt: string, token: Contract, lp_token: Contract, YYVault: Contract, Zapper: Contract, walletSigner: Signer) {
    const wallet_addr = await walletSigner.getAddress();
    const yyVault_addr = YYVault.address;
    const amt = ethers.utils.parseEther(txnAmt);
    let [user1, vault1] = await getBalances(token, lp_token, wallet_addr, YYVault);
    const symbol = await token.symbol;
    let allowanceTest = await token.allowance(wallet_addr,Zapper.address);

    let floatAllowance = allowanceTest - 1001;

    log(`The value of ${symbol} before doing anything is: ${user1}`);
    log(`The address of the tokenIn is ${token.address} and the amount is ${amt}`);

    await Zapper.connect(walletSigner).zapIn(yyVault_addr, 1001, token.address, amt);
    let [user2, vault2] = await getBalances(token, lp_token, wallet_addr, YYVault);
    printBals(`Zap ${txnAmt}`, vault2, user2);

    log(`The value of token ${symbol} after zapping in is: ${user2}`);
    log(`the difference between both ${symbol}'s : ${user1 - user2}`);

    //await YYVault.connect(walletSigner).reinvest();
    let [user3, vault3] = await getBalances(token, lp_token, wallet_addr, YYVault);
    printBals("Call reinvest()", vault3, user3);

    expect((user1 - user2) / Number(txnAmt)).to.be.greaterThan(0.98);
   //No time has passed so the reinvest is commented out becaue it requires a minimum
    // expect(vault2).to.be.greaterThan(vault1);
   // expect(vault2).to.be.greaterThan(vault3);
}

export async function zapOutToken(txnAmt: string, token: Contract, lp_token: Contract, YYVault: Contract, Zapper: Contract, walletSigner: Signer) {
    const wallet_addr = await walletSigner.getAddress();
    const yyVault_addr = YYVault.address;
    const amt = ethers.utils.parseEther(txnAmt);
    let symbol = await token.symbol;

    log(`The amount we are zapping in with is: ${amt}`);
    //let receipt = await Gauge.balanceOf(wallet_addr);
    let balA = (token.address != WAVAX_ADDR) ? await returnBal(token, wallet_addr) : await returnWalletBal(wallet_addr);

    log(`The balance of ${symbol} before anything is done to it: ${balA}`);

    await Zapper.connect(walletSigner).zapIn(yyVault_addr, 1001, token.address, amt);

    //get receipt token balance
    let receipt = await YYVault.balanceOf(wallet_addr);
    let balABefore = (token.address != WAVAX_ADDR) ? await returnBal(token, wallet_addr) : await returnWalletBal(wallet_addr);

    log(`The balance of ${symbol} before we zap out is: ${balABefore}`);

   // await YYVault.connect(walletSigner).reinvest();
    await Zapper.connect(walletSigner).zapOutAndSwap(yyVault_addr, receipt, token.address, 0);

    let balAAfter = (token.address != WAVAX_ADDR) ? await returnBal(token, wallet_addr) : await returnWalletBal(wallet_addr);
    let receipt2 = await YYVault.balanceOf(wallet_addr);

    log(`The balance of ${symbol} after we zap out is: ${balAAfter}`);
    log(`The difference of ${symbol} before and after is: ${balAAfter - balABefore}`);

    expect(receipt2).to.be.equals(0);
    (token.address != WAVAX_ADDR) ?
        expect(balAAfter - balABefore).to.roughly(0.1).deep.equal(Number(txnAmt)) :
        expect(balAAfter).to.be.greaterThan(balABefore);

}


