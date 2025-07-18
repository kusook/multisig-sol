# Multisig Wallet - Secure Multi-Signature Ethereum Contract
[!https://img.shields.io/badge/Solidity-%5E0.8.0-blue]
[!https://img.shields.io/badge/Hardhat-Tests-green]
[!https://img.shields.io/badge/License-MIT-yellow]

A secure multi-signature wallet implementation for Ethereum that requires multiple confirmations for transaction execution. This contract features robust security measures including reentrancy protection, transaction expiration, and strict validation rules.

Features
🛡️ Multi-signature transactions - Requires multiple confirmations for execution

⏳ Transaction expiration - Transactions expire after 24 hours

🔒 Reentrancy protection - Prevents reentrancy attacks

📝 Data validation - Prevents sending data to EOA addresses

🔍 Transaction integrity - Hash verification for submitted transactions

🔄 Multicall support - Batch multiple operations in a single transaction

## Getting Started
Prerequisites
- Node.js (v18+)

- npm or yarn

- Hardhat

## Installation
Clone the repository:

``` bash
git clone https://github.com/your-username/multisig-wallet.git
cd multisig-wallet
```
Install dependencies:
```bash
npm install
```
Compile contracts:
```bash
npx hardhat compile
```
## Contract Structure
### Main Contracts
`contracts/Multisig.sol` - Core multi-signature wallet implementation

`contracts/Reentrancy.sol` - Test contract for reentrancy attack simulation

### Key Functionality
``` solidity
// Submit a new transaction
function submitTx(address _to, uint256 _value, bytes memory _data) public

// Confirm a transaction
function confirmTx(uint256 _index) public

// Execute a confirmed transaction
function executeTx(uint256 _index) public

// Revoke confirmation
function revokeConf(uint256 _index) public

// Expire an old transaction
function expireTx(uint256 _index) external
```
## Running Tests
To run the comprehensive test suite:

``` bash
npx hardhat test
```

Expiration Mechanism:

Transactions automatically expire after 24 hours

Prevents stale transactions from being executed
