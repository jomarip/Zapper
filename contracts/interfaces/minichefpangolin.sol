// SPDX-License-Identifier: MIT
pragma solidity ^0.6.7;

import "./minichef-rewarder.sol";

// interface for MiniChef contract
interface IMiniChef {

    /* Reads */
    function userInfo(uint256, address) external view returns (
        uint256 amount,
        uint256 rewardDebt

    );

    function poolInfo(uint256 pid) external view returns (
        IERC20 lpToken, // Address of LP token contract.
        uint256 allocPoint, // How many allocation points assigned to this poolInfo. SUSHI to distribute per block.
        uint256 lastRewardTimestamp, // Last block timestamp that SUSHI distribution occurs.
        uint256 accJoePerShare, // Accumulated SUSHI per share, times 1e12. See below.
        address rewarder
    );

    function totalAllocPoint() external view returns (uint256);

    function poolLength() external view returns (uint256);


    function pendingReward(uint256 _pid, address _user)
        external
        view
        returns (
            uint256 pending
        );

    /* Writes */

    function add(
        uint256 _allocPoint,
        address _lpToken,
        address _rewarder
    ) external;

    function set(
        uint256 _pid,
        uint256 _allocPoint,
        IMiniChefRewarder _rewarder,
        bool overwrite
    ) external;

    function updatePool(uint256 _pid) external;

    function deposit(
        uint256 _pid,
        uint256 _amount,
        address to
    ) external;

    function withdraw(
        uint256 _pid,
        uint256 _amount,
        address to
    ) external;

    function withdrawAndHarvest(
        uint256 _pid,
        uint256 _amount,
        address to
    ) external;

     function harvest(
        uint256 _pid,
        address to
    ) external;
}

