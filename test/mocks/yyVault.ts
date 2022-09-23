const hre = require("hardhat")
const { ethers } = require("hardhat")
import {
    Contract,
    Signer
} from "ethers";

import { log } from "../utils/log";
import { returnSigner } from "../utils/helpers";

const BLACKHOLE = "0x0000000000000000000000000000000000000000"

export async function setupMockYYVault(
    contract_name: string, yyVault_addr: string, asset_addr: string, 
    timelockSigner: Signer,
    governanceSigner: Signer) {

    let abiPath = require('./../abis/YieldYak/VaultABI.json'); 
    let globeABI = (await ethers.getContractFactory(abiPath,yyVault_addr,governanceSigner)).interface;
    let YYVault: Contract

    if (yyVault_addr == "") {
        
        log(`yyVault_addr: ${yyVault_addr}`);

        YYVault = new ethers.Contract(yyVault_addr, globeABI, governanceSigner);
        log(`connected to yyVault at ${YYVault.address}`);

         
    } else {
        YYVault = new ethers.Contract(yyVault_addr, globeABI, governanceSigner);
        log(`connected to yyVault at ${YYVault.address}`);
    }

    return YYVault;
}
