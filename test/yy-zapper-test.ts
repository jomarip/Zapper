/** NOTES ABOUT THIS TEST FILE
-- Only designed for testing against LPs ***/
const { ethers } = require("hardhat");
import chai from "chai";
import { solidity } from "ethereum-waffle";
import chaiRoughly from 'chai-roughly';
import chaiAsPromised from 'chai-as-promised';
chai.use(solidity);
chai.use(chaiAsPromised);
chai.use(chaiRoughly);
import { expect } from "chai"
import {
    increaseTime, overwriteTokenAmount, increaseBlock,
    returnSigner, fastForwardAWeek, findSlot,
    getLpSlot, getPoolABI, getBalancesAvax,
    getBalances, printBals, returnBal, returnWalletBal
} from "./utils/helpers";
import {
    setupSigners,
    MAX_UINT256,
    WAVAX_ADDR
} from "./utils/static";
import { setupMockYYVault } from "./mocks/yyVault";
import { setupMockZapper } from "./mocks/Zapper";
import {
    Contract,
    Signer,
    BigNumber
} from "ethers";
import {
    zapInToken, zapOutToken
} from "./utils/itsYY";
import { log } from "./utils/log";

const txnAmt = "35000000000000000000000";
const poolTokenABI = require('./abis/PoolTokenABI.json');

export function doZapperTests(
    name: string,
    yyVault_addr: string,
    pool_type: string,
) {

    describe(`${name} Zapper Integration Tests`, () => {
        let snapshotId: string;
        let assetAddr: string;
        let zapper_addr: string;
        let walletSigner: Signer;
        let LPToken: Contract;
        let TokenA: Contract;
        let TokenB: Contract;
        let YYVault: Contract;
        let Zapper: Contract;
        let timelockSigner: Signer;
        let strategistSigner: Signer;
        let governanceSigner: Signer;

        const wallet_addr = process.env.WALLET_ADDR === undefined ? '' : process.env.WALLET_ADDR;

        //These reset the state after each test is executed 
        beforeEach(async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');
        })

        afterEach(async () => {
            await ethers.provider.send('evm_revert', [snapshotId]);
        })

        before(async () => {
            // Setup Signers
            walletSigner = await returnSigner(wallet_addr);
            [timelockSigner, strategistSigner, governanceSigner] = await setupSigners();
            
            // Deploy Snowglobe Contract
            const yyVaultName = `YYVault${name}`;
            // assumes always given a yyVault address
            YYVault = await setupMockYYVault(
                yyVaultName,
                yyVault_addr,
                "",
                timelockSigner,
                governanceSigner
            );
          
            // Derive Relevant Tokens
            let lp_token_addr = await YYVault.depositToken();
            LPToken = await ethers.getContractAt(getPoolABI(pool_type), lp_token_addr, walletSigner);
            let slot = getLpSlot(pool_type);
            await overwriteTokenAmount(lp_token_addr, wallet_addr, txnAmt, slot);

            let token_A_addr = await LPToken.token0();
            TokenA = await ethers.getContractAt("contracts/lib/erc20.sol:IERC20", token_A_addr, walletSigner);
            let slotA = findSlot(token_A_addr);
            await overwriteTokenAmount(token_A_addr, wallet_addr, txnAmt, slotA);

            let token_B_addr = await LPToken.token1();
            TokenB = await ethers.getContractAt("contracts/lib/erc20.sol:IERC20", token_B_addr, walletSigner);
            let slotB = findSlot(token_B_addr);
            await overwriteTokenAmount(token_B_addr, wallet_addr, txnAmt, slotB);

                        // Deploy Zapper
            Zapper = await setupMockZapper(pool_type);
            zapper_addr = Zapper.address;

            //Approvals
            await TokenA.approve(zapper_addr, MAX_UINT256);
            let allowanceT = await TokenA.allowance(wallet_addr,zapper_addr);
            log(`The value of allowance for TokenA is: ${allowanceT}`);
            await TokenB.approve(zapper_addr, MAX_UINT256);
            await YYVault.approve(zapper_addr, MAX_UINT256);
            await TokenA.connect(walletSigner).approve(zapper_addr, MAX_UINT256);
            await TokenB.connect(walletSigner).approve(zapper_addr, MAX_UINT256);
            await YYVault.connect(walletSigner).approve(zapper_addr, MAX_UINT256);
            
        });

        describe("When setup is completed..", async () => {
            it("..contracts are loaded", async () => {
                expect(yyVault_addr).to.not.be.empty;
                expect(zapper_addr).to.not.be.empty;
                expect(LPToken.address).to.not.be.empty;
                expect(TokenA.address).to.not.be.empty;
                expect(TokenB.address).to.not.be.empty;
                log(`\tToken Addresses are ${TokenA.address} and ${TokenB.address}`);
            })

            it("..user has positive balances for tokens and LP", async () => {
                let lpBal = ethers.utils.formatEther(await LPToken.balanceOf(wallet_addr));
                let aBal = ethers.utils.formatEther(await TokenA.balanceOf(wallet_addr));
                let bBal = ethers.utils.formatEther(await TokenB.balanceOf(wallet_addr));
                expect(Number(lpBal), "LP Balance empty").to.be.greaterThan(0);
                expect(Number(aBal), "TokenA Balance empty").to.be.greaterThan(0);
                expect(Number(bBal), "TokenB Balance empty").to.be.greaterThan(0);

            })
        })

        describe("When depositing..", async () => {
            it("..can zap in with TokenA", async () => {
                const txnAmt = "3";
                await zapInToken(txnAmt, TokenA, LPToken, YYVault, Zapper, walletSigner);
            })

            it("..can zap in with TokenB", async () => {
                const txnAmt = "6";
                await zapInToken(txnAmt, TokenB, LPToken, YYVault, Zapper, walletSigner);
            })

            it("..can zap in with AVAX", async () => {
                const txnAmt = "2";
                const amt = ethers.utils.parseEther(txnAmt);
                let [user1, globe1] = await getBalancesAvax(LPToken, walletSigner, YYVault);
                printBals("Original", globe1, user1);

                log(`The value of A before zapping in with AVAX is: ${user1}`);

                await Zapper.connect(walletSigner).zapInAVAX(yyVault_addr, 0, TokenB.address, { value: amt });
                let [user2, globe2] = await getBalancesAvax(LPToken, walletSigner, YYVault);
                printBals(`Zap ${txnAmt} AVAX`, globe2, user2);

                log(`The value of token A after zapping in with Avax is: ${user2}`);
                log(`the difference between both A's : ${user1 - user2}`);

                //commented out reinvest because the smart contract requires a minimum balance
                //await YYVault.connect(walletSigner).reinvest();
                let [user3, globe3] = await getBalancesAvax(LPToken, walletSigner, YYVault);
                printBals("Call reinvest()", globe3, user3);

                expect((user1 - user2) / Number(txnAmt)).to.be.greaterThan(0.98);
                //If I want this test I need to get the Vault Invested Balance
                //expect(globe2).to.be.greaterThan(globe1);
               // expect(globe2).to.be.greaterThan(globe3);
            })
        })

        describe("When withdrawing..", async () => {
            it("..can zap out into TokenA", async () => {
                const txnAmt = "24";
                await zapOutToken(txnAmt, TokenA, LPToken, YYVault, Zapper, walletSigner);
            })

            it("..can zap out into TokenB", async () => {
                const txnAmt = "35";
                await zapOutToken(txnAmt, TokenB, LPToken, YYVault, Zapper, walletSigner);
            })

            it("..can zap out equally", async () => {
                const txnAmt = "45";
                const amt = ethers.utils.parseEther(txnAmt);

                log(`The amount we are zapping in with is: ${amt}`);
                let balA = (TokenA.address != WAVAX_ADDR) ? await returnBal(TokenA, wallet_addr) : await returnWalletBal(wallet_addr);
                let balB = (TokenB.address != WAVAX_ADDR) ? await returnBal(TokenB, wallet_addr) : await returnWalletBal(wallet_addr);
                log(`The balance of A and B before we do anything is ${balA} and ${balB}`);

                await Zapper.connect(walletSigner).zapIn(yyVault_addr, 0, TokenA.address, amt);
                let receipt = await YYVault.balanceOf(wallet_addr);
                let balABefore = (TokenA.address != WAVAX_ADDR) ? await returnBal(TokenA, wallet_addr) : await returnWalletBal(wallet_addr);
                let balBBefore = (TokenB.address != WAVAX_ADDR) ? await returnBal(TokenB, wallet_addr) : await returnWalletBal(wallet_addr);

                log(`The balance of A before we zap out is: ${balABefore}`);
                log(`The balance of B before we zap out is: ${balBBefore}`);
                
                //Reinvest has strict requirements, thus commenting out unless we move time forward.
                //await YYVault.connect(walletSigner).reinvest();
                await Zapper.connect(walletSigner).zapOut(yyVault_addr, receipt);
                let receipt2 = await YYVault.balanceOf(wallet_addr);
                let balAAfter = (TokenA.address != WAVAX_ADDR) ? await returnBal(TokenA, wallet_addr) : await returnWalletBal(wallet_addr);
                let balBAfter = (TokenB.address != WAVAX_ADDR) ? await returnBal(TokenB, wallet_addr) : await returnWalletBal(wallet_addr);
                log(`The balance of A after we zap out is: ${balAAfter}`);
                log(`The balance of B after we zap out is: ${balBAfter}`);

                log(`The difference of A before and after is: ${balAAfter - balABefore}`);
                log(`The difference of B before and after is: ${balBAfter - balBBefore}`);

                log(`The thing we want our balance to be near to is: ${Number(txnAmt) / 2}`);

                (TokenA.address != WAVAX_ADDR) ?
                    expect(balAAfter - balABefore, "Incorrect TokenA").to.roughly(0.1).deep.equal(Number(txnAmt) / 2) :
                    expect(balAAfter).to.be.greaterThan(balABefore);
                (TokenB.address != WAVAX_ADDR) ?
                    expect(balBAfter - balBBefore, "Incorrect TokenB").to.roughly(0.1).deep.equal(Number(txnAmt) / 2) :
                    expect(balBAfter).to.be.greaterThan(balBBefore);
                expect(receipt2).to.be.equals(0);
            })
        })

        describe("When minimum amounts unmet..", async () => {
            it("..reverts on zap in token", async () => {
                const txnAmt = "100";
                const amt = ethers.utils.parseEther(txnAmt);

                expect(Zapper.connect(walletSigner).zapIn(yyVault_addr, amt, TokenA.address, amt)).to.be.reverted;
            })
            it("..reverts on zap in avax", async () => {
                const txnAmt = "1";
                const txnAmt2 = "5";
                const amt = ethers.utils.parseEther(txnAmt);
                const amt2 = ethers.utils.parseEther(txnAmt2);

                //amt was too large that it succeeds when reaching line 60 of the zapper contract. However, we want it to fail
                log(`the token A address is ${TokenA.address}`);
                log(`the token B address is ${TokenB.address}`);

                await expect(Zapper.connect(walletSigner).zapInAVAX(yyVault_addr, amt2, TokenA.address, { value: txnAmt })).to.be.reverted;
            })

            it("..reverts on zap out token", async () => {
                const txnAmt = "35";
                const amt = ethers.utils.parseEther(txnAmt);

                await Zapper.connect(walletSigner).zapIn(yyVault_addr, 0, TokenB.address, amt);
                let receipt = await YYVault.balanceOf(wallet_addr);

                //comment out reinvest
                //await YYVault.connect(walletSigner).reinvest();

                await YYVault.connect(walletSigner).withdraw(receipt);
                await expect(Zapper.connect(walletSigner).zapOutAndSwap(yyVault_addr, receipt, TokenB.address, amt)).to.be.reverted;
            })

            //missing
            it("..reverts on zap out avax", async () => {
            })
        })
    })
}
