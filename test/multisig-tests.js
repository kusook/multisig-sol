const { expect } = require("chai");
const { ethers } = require("hardhat");
const { keccak256, encodePacked, toUtf8Bytes, parseEther, formatBytes32String } = ethers;

describe("Multisig", function () {
  let Multisig, multisig, Attacker, attackerContract;
  let owner1, owner2, owner3, recipient, attacker, other;

  beforeEach(async function () {
    [owner1, owner2, owner3, recipient, attacker, other] = await ethers.getSigners();

    const factory = await ethers.getContractFactory("Multisig");

    multisig = await factory.deploy([owner1.address, owner2.address, attacker.address], 2);
    await multisig.waitForDeployment();

    //multisig = await ethers.getContractAt("Multisig", await multisig.getAddress());
    const multisigAddress = await multisig.getAddress();

    await owner1.sendTransaction({
      to: multisigAddress,
      value: ethers.parseEther("1"),
    });
  });

  describe("Basic functionality", function () {
    it("should submit and confirm and execute a tx", async () => {
      await multisig.connect(owner1).submitTx(recipient.address, ethers.parseEther("0.1"), "0x");
      await multisig.connect(owner1).confirmTx(0);
      await multisig.connect(owner2).confirmTx(0);
      await expect(() =>
        multisig.connect(owner1).executeTx(0)
      ).to.changeEtherBalances(
        [multisig, recipient],
        [ethers.parseEther("-0.1"), ethers.parseEther("0.1")]
      );
    });

    it("should revoke confirmation", async () => {
      await multisig.connect(owner1).submitTx(recipient.address, 0, "0x");
      await multisig.connect(owner2).confirmTx(0);
      await multisig.connect(owner2).revokeConf(0);
      const tx = await multisig.getTransaction(0);
      expect(tx.numConf).to.equal(0);
    });

    it("should expire after 24h", async () => {
      await multisig.connect(owner1).submitTx(recipient.address, 0, "0x");
      await ethers.provider.send("evm_increaseTime", [2*86400]);
      await ethers.provider.send("evm_mine");
      await multisig.expireTx(0);
      const tx = await multisig.getTransaction(0);
      expect(tx.expired).to.be.true;
    });

    it("should return owners and transaction count", async () => {
      const owners = await multisig.getOwners();
      expect(owners).to.include(owner1.address);

      await multisig.connect(owner1).submitTx(recipient.address, 0, "0x");
      expect(await multisig.getTransactionCount()).to.equal(1);
    });
  });

  describe("Negative cases", function () {
    it("should reject confirmation from non-owner", async () => {
      await multisig.connect(owner1).submitTx(recipient.address, 0, "0x");
      await expect(multisig.connect(other).confirmTx(0)).to.be.revertedWith("not owner");
    });

    it("should reject double confirmation", async () => {
      await multisig.connect(owner1).submitTx(recipient.address, 0, "0x");
      await multisig.connect(owner2).confirmTx(0);
      await expect(multisig.connect(owner2).confirmTx(0)).to.be.revertedWith("tx already confirmed");
    });

    it("should reject execution before enough confirmations", async () => {
      await multisig.connect(owner1).submitTx(recipient.address, 0, "0x");
      await expect(multisig.connect(owner1).executeTx(0)).to.be.revertedWith("unable to complete tx");
    });

    it("should revert on data to EOA", async () => {
      const data = "0x1984";
      const eoaAddress = other.address;

      const code = await ethers.provider.getCode(eoaAddress);
      expect(code).to.equal("0x");

      await multisig.connect(owner1).submitTx(eoaAddress, 0, data);

      const tx = await multisig.getTransaction(0);
      expect(tx.data).to.equal(data);

      await multisig.connect(owner1).confirmTx(0);
      await multisig.connect(owner2).confirmTx(0);

      await expect(multisig.connect(owner1).executeTx(0)).to.be.revertedWith("data sent to EOU");
    });

    it("should revert on double execution", async () => {
      await multisig.connect(owner1).submitTx(recipient.address, 0, "0x");
      await multisig.connect(owner2).confirmTx(0);
      await multisig.connect(owner1).confirmTx(0);
      await multisig.connect(owner1).executeTx(0);
      await expect(multisig.connect(owner1).executeTx(0)).to.be.revertedWith("already executed");
    });

    it("should revert on hash mismatch", async () => {
      await multisig.connect(owner1).submitTx(recipient.address, 0, "0x");

      const baseSlot = "0x" + BigInt(3).toString(16).padStart(64, '0');
      const base = BigInt(ethers.keccak256(baseSlot));
      const uniqueHashSlot = "0x" + (base + 6n).toString(16).padStart(64, '0');

      await ethers.provider.send("hardhat_setStorageAt", [
        await multisig.getAddress(),
        uniqueHashSlot,
        ethers.encodeBytes32String("bad")
      ]);

      await expect(multisig.connect(owner2).confirmTx(0)).to.be.revertedWith("Transaction hash mismatch");
    });
  });

  describe("Multicall edge case", function () {
    it("should revert if any internal call is successful", async () => {
      const data = multisig.interface.encodeFunctionData("getOwners");
      await expect(multisig.connect(owner1).multicall([data])).to.be.revertedWith("Multicall failed");
    });
  });

  describe("Reentrancy attack", function () {
    it("should prevent re-entrancy on executeTx", async () => {
      const Attacker = await ethers.getContractFactory("Reentrancy");
      const attackerContract = await Attacker.deploy(ethers.ZeroAddress);
      await attackerContract.waitForDeployment();
      const attackerAddress = await attackerContract.getAddress();
  
      const factory = await ethers.getContractFactory("Multisig");
      multisig = await factory.deploy([owner1.address, owner2.address, attackerAddress], 2);
      await multisig.waitForDeployment();
      const multisigAddress = await multisig.getAddress();
  
      await attackerContract.setWallet(multisigAddress);
  
      await owner1.sendTransaction({
        to: multisigAddress,
        value: ethers.parseEther("1"),
      });
  
      await multisig.connect(owner1).submitTx(attackerAddress, ethers.parseEther("0.1"), "0x");
      await multisig.connect(owner1).confirmTx(0);
      await multisig.connect(owner2).confirmTx(0);
  
      await expect(attackerContract.attack(0)).to.be.revertedWith("tx failed");

      const tx = await multisig.getTransaction(0);
      expect(tx.executed).to.be.false;
    });
  });

  describe("Edge inputs", function () {
    it("should reject zero address as recipient", async () => {
      await expect(
        multisig.connect(owner1).submitTx(ethers.ZeroAddress, 1, "0x")
      ).to.be.revertedWith("Zero address");
    });

    it("should reject invalid tx index", async () => {
      await expect(multisig.connect(owner1).confirmTx(999)).to.be.revertedWith("tx doesn't exist.");
    });
  });
});
