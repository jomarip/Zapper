// SPDX-License-Identifier: MIT
pragma solidity ^0.6.7;

interface IGaugeV3 {
    function balanceOf(address account) external view returns (uint256);

    function depositAll() external;

    function deposit(uint256 amount) external;

    function depositFor(uint256 amount, address account) external;

    function withdrawAll() external;

    function withdraw(uint256 amount) external;

    function exit() external;

    function getReward(uint256 tokenIndex) external;

    function earned(address account,address token) external view returns (uint256);
}

interface IGaugeProxyV3 {
    function tokens() external view returns (address[] memory);

    function getGauge(address _token) external view returns (address);
}