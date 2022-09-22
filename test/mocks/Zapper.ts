const hre = require("hardhat")
const { ethers } = require("hardhat")
import {
    Contract,
    ContractFactory,
    Signer
} from "ethers";
import { getContractName , returnSigner } from "../utils/helpers";

const treasury = "0xc9a51fB9057380494262fd291aED74317332C0a2"

export async function setupMockZapper(pool_type: string) {
    let contractType = getContractName(pool_type);
    const zapperFactory: ContractFactory = await ethers.getContractFactory(contractType);
    let Zapper: Contract = await zapperFactory.deploy(treasury,treasury,treasury);
    return Zapper;
}
