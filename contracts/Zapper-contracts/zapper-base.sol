// SPDX-License-Identifier: MIT
pragma solidity ^0.6.7;

import "../lib/safe-math.sol";
import "../lib/erc20.sol";
import "../interfaces/pangolin.sol";
import "../interfaces/joe.sol";
import "../lib/square-root.sol";
import "../interfaces/wavax.sol";
import "../interfaces/globe.sol";
import "../interfaces/uniAmm.sol";

abstract contract ZapperBase {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;
    using SafeERC20 for IGlobe;

    address public router;

    address public constant wavax = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;

    uint256 public constant minimumAmount = 1000;

    // Utilization fees - start with 10%
    uint256 public useTreasuryFee = 100;
    uint256 public constant useTreasuryMax = 10000;

    // Dev fees - start with 10%
    uint256 public useDevFee = 0;
    uint256 public constant useDevMax = 10000;

    // User accounts
    address public timelock;
    address public treasury;
    address public devFund;

    //Set the Accounts
    function setTimelock(address _timelock) external {
        require(msg.sender == timelock, "!timelock");
        timelock = _timelock;
    }

    function setTreasury(address _treasury) external {
        require(msg.sender == timelock, "!timelock");
        treasury = _treasury;
    }

    function setDevFund(address _devFund) external {
        require(msg.sender == timelock, "!timelock");
        devFund = _devFund;
    }

    //set the fees
    function setUseTreasuryFee(uint256 _useTreasuryFee) external {
        require(msg.sender == timelock, "!timelock");
        useTreasuryFee = _useTreasuryFee;
    }
        
    function setUseDevFee(uint256 _useDevFee) external {
        require(msg.sender == timelock, "!timelock");
        useDevFee = _useDevFee;
    }

        
    constructor(
        address _router,
        address _timelock,
        address _treasury,
        address _devFund
        ) public {
            require(_timelock != address(0));
            require(_treasury != address(0));
            require(_devFund != address(0));

            timelock = _timelock;
            treasury = _treasury;
            devFund = _devFund;

            // Safety checks to ensure WAVAX token address
            WAVAX(wavax).deposit{value: 0}();
            WAVAX(wavax).withdraw(0);
            router = _router;
    }

    receive() external payable {
        assert(msg.sender == wavax);
    }

    function _getSwapAmount(uint256 investmentA, uint256 reserveA, uint256 reserveB) public view virtual returns (uint256 swapAmount);

    //returns DUST
    function _returnAssets(address[] memory tokens) internal {
        uint256 balance;
        for (uint256 i; i < tokens.length; i++) {
            balance = IERC20(tokens[i]).balanceOf(address(this));
            if (balance > 0) {
                if (tokens[i] == wavax) {
                    WAVAX(wavax).withdraw(balance);
                    (bool success, ) = msg.sender.call{value: balance}(
                        new bytes(0)
                    );
                    require(success, "AVAX transfer failed");
                } else {
                    IERC20(tokens[i]).safeTransfer(msg.sender, balance);
                }
            }
        }
    }

    function _swapAndStake(address snowglobe, uint256 tokenAmountOutMin, address tokenIn) public virtual;

    function zapInAVAX(address snowglobe, uint256 tokenAmountOutMin, address tokenIn) external payable{
        require(msg.value >= minimumAmount, "Insignificant input amount");

        WAVAX(wavax).deposit{value: msg.value}();

        uint256 _wavax = WAVAX(wavax).balanceOf(address(this));

        //take dev fee and transfer
        uint256 _feeDev = _wavax.mul(useDevFee).div(useDevMax);
        WAVAX(wavax).transfer(devFund, _feeDev);

        //take treasury fee and transfer
        uint256 _feeTreasury = _wavax.mul(useTreasuryFee).div(useTreasuryMax);
        WAVAX(wavax).transfer(treasury,_feeTreasury);

        // allows us to zapIn if avax isn't part of the original pair
        if (tokenIn != wavax){
            uint256 _amount = IERC20(wavax).balanceOf(address(this));

            (, IUniPair pair) = _getVaultPair(snowglobe);

            (uint256 reserveA, uint256 reserveB, ) = pair.getReserves();
            require(reserveA > minimumAmount && reserveB > minimumAmount, "Liquidity pair reserves too low");

            bool isInputA = pair.token0() == tokenIn;
            require(isInputA || pair.token1() == tokenIn, "Input token not present in liquidity pair");

            address[] memory path = new address[](2);
            path[0] = wavax;
            path[1] = tokenIn;

            uint256 swapAmountIn;
        
            swapAmountIn = _getSwapAmount(_amount, reserveA, reserveB);
       
            _approveTokenIfNeeded(path[0], address(router));
            IUniAmmRouter(router).swapExactTokensForTokens(
                swapAmountIn,
                tokenAmountOutMin,
                path,
                address(this),
                block.timestamp
            );
            _swapAndStake(snowglobe, tokenAmountOutMin, tokenIn);
        }else{
            _swapAndStake(snowglobe, tokenAmountOutMin, tokenIn);
        }
    }

    // transfers tokens from msg.sender to this contract 
    function zapIn(address snowglobe, uint256 tokenAmountOutMin, address tokenIn, uint256 tokenInAmount) external {
        require(tokenInAmount >= minimumAmount, "Insignificant input amount");
        require(IERC20(tokenIn).allowance(msg.sender, address(this)) >= tokenInAmount, "Input token is not approved");

        // transfer token 
        IERC20(tokenIn).safeTransferFrom(
            msg.sender,
            address(this),
            tokenInAmount
        );

        uint256 _amt = IERC20(tokenIn).balanceOf(address(this));

        //take dev fee and transfer
        uint256 _feeDev = _amt.mul(useDevFee).div(useDevMax);
        IERC20(tokenIn).safeTransfer(devFund, _feeDev);

        //take treasury fee and transfer
        uint256 _feeTreasury = _amt.mul(useTreasuryFee).div(useTreasuryMax);
        IERC20(tokenIn).safeTransfer(treasury,_feeTreasury);

        //Swap and Stake
        _swapAndStake(snowglobe, tokenAmountOutMin, tokenIn);
    }

    function zapOutAndSwap(address snowglobe, uint256 withdrawAmount, address desiredToken, uint256 desiredTokenOutMin) public virtual;

    function _removeLiquidity(address pair, address to) internal {
        IERC20(pair).safeTransfer(pair, IERC20(pair).balanceOf(address(this)));
        (uint256 amount0, uint256 amount1) = IUniPair(pair).burn(to);

        require(amount0 >= minimumAmount, "Router: INSUFFICIENT_A_AMOUNT");
        require(amount1 >= minimumAmount, "Router: INSUFFICIENT_B_AMOUNT");
    }

    function _getVaultPair(address snowglobe) internal view returns (IGlobe vault, IUniPair pair){

        vault = IGlobe(snowglobe);
        pair = IUniPair(vault.token());



        require(pair.factory() == IUniPair(router).factory(), "Incompatible liquidity pair factory");
    }

    function _approveTokenIfNeeded(address token, address spender) internal {
        if (IERC20(token).allowance(address(this), spender) == 0) {
            IERC20(token).safeApprove(spender, uint256(~0));
        }
    }

    function zapOut(address snowglobe, uint256 withdrawAmount) external {
        (IGlobe vault, IUniPair pair) = _getVaultPair(snowglobe);

        IERC20(snowglobe).safeTransferFrom(msg.sender, address(this), withdrawAmount);
        vault.withdraw(withdrawAmount);

        uint256 _amt = IERC20(snowglobe).balanceOf(address(this));

        //take dev fee and transfer
        uint256 _feeDev = _amt.mul(useDevFee).div(useDevMax);
        IERC20(snowglobe).safeTransfer(devFund, _feeDev);

        //take treasury fee and transfer
        uint256 _feeTreasury = _amt.mul(useTreasuryFee).div(useTreasuryMax);
        IERC20(snowglobe).safeTransfer(treasury,_feeTreasury);

        //remove liquidity
        if (pair.token0() != wavax && pair.token1() != wavax) {
            return _removeLiquidity(address(pair), msg.sender);
        }

        _removeLiquidity(address(pair), address(this));

        address[] memory tokens = new address[](2);
        tokens[0] = pair.token0();
        tokens[1] = pair.token1();

        _returnAssets(tokens);
    }
}