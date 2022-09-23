// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

import "../lib/erc20.sol";

interface IYY is IERC20 {
    function checkReward() external view returns (uint256);

    function depositToken() external view
    returns (address);
    
    function deposit(uint256) external;

    function depositFor(address, uint256) external;

    function depositWithPermit(
        uint256 amount, 
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function withdraw(uint256) external;

    function reinvest() external;

    function decimals() external view returns (uint8);
}
