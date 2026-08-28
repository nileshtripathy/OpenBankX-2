import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

describe('OpenBankXVault', function () {
  async function deployVaultFixture() {
    const [owner, alice, bob] = await ethers.getSigners();
    const Vault = await ethers.getContractFactory('OpenBankXVault');
    const vault = await Vault.deploy(owner.address);

    const Token = await ethers.getContractFactory('MockERC20');
    const token = await Token.deploy('Test Token', 'TT', 18, ethers.parseEther('1000000'));
    await vault.connect(owner).setTokenSupported(await token.getAddress(), true);
    await token.transfer(alice.address, ethers.parseEther('1000'));

    return { vault, token, owner, alice, bob };
  }

  it('accepts ETH deposits and tracks balance', async function () {
    const { vault, alice } = await loadFixture(deployVaultFixture);
    const refId = ethers.encodeBytes32String('dep-1');

    await expect(
      vault.connect(alice).depositETH(refId, { value: ethers.parseEther('1') })
    ).to.emit(vault, 'Deposited');

    expect(await vault.balanceOf(ethers.ZeroAddress, alice.address)).to.equal(
      ethers.parseEther('1')
    );
  });

  it('rejects withdrawals beyond balance', async function () {
    const { vault, alice } = await loadFixture(deployVaultFixture);
    const refId = ethers.encodeBytes32String('wd-1');
    await expect(
      vault.connect(alice).withdrawETH(ethers.parseEther('1'), refId)
    ).to.be.revertedWithCustomError(vault, 'InsufficientBalance');
  });

  it('handles ERC-20 deposit, internal transfer, and withdrawal', async function () {
    const { vault, token, alice, bob } = await loadFixture(deployVaultFixture);
    const tokenAddress = await token.getAddress();
    const vaultAddress = await vault.getAddress();
    const refId = ethers.encodeBytes32String('erc20-1');

    await token.connect(alice).approve(vaultAddress, ethers.parseEther('100'));
    await vault.connect(alice).depositToken(tokenAddress, ethers.parseEther('100'), refId);
    expect(await vault.balanceOf(tokenAddress, alice.address)).to.equal(ethers.parseEther('100'));

    await vault.connect(alice).transfer(bob.address, tokenAddress, ethers.parseEther('40'), refId);
    expect(await vault.balanceOf(tokenAddress, alice.address)).to.equal(ethers.parseEther('60'));
    expect(await vault.balanceOf(tokenAddress, bob.address)).to.equal(ethers.parseEther('40'));

    await vault.connect(bob).withdrawToken(tokenAddress, ethers.parseEther('40'), refId);
    expect(await token.balanceOf(bob.address)).to.equal(ethers.parseEther('40'));
  });

  it('blocks deposits of unsupported tokens', async function () {
    const { vault, owner } = await loadFixture(deployVaultFixture);
    const Token = await ethers.getContractFactory('MockERC20');
    const rogueToken = await Token.deploy('Rogue', 'RG', 18, ethers.parseEther('1000'));
    const refId = ethers.encodeBytes32String('rogue-1');

    await rogueToken.approve(await vault.getAddress(), ethers.parseEther('10'));
    await expect(
      vault.connect(owner).depositToken(await rogueToken.getAddress(), ethers.parseEther('10'), refId)
    ).to.be.revertedWithCustomError(vault, 'UnsupportedToken');
  });
});

describe('OpenBankXSwap', function () {
  async function deploySwapFixture() {
    const [owner, alice] = await ethers.getSigners();
    const Swap = await ethers.getContractFactory('OpenBankXSwap');
    const swap = await Swap.deploy(owner.address);

    const Token = await ethers.getContractFactory('MockERC20');
    const token = await Token.deploy('Test Token', 'TT', 18, ethers.parseEther('1000000'));

    await swap.createPool(ethers.ZeroAddress, await token.getAddress());
    await token.approve(await swap.getAddress(), ethers.parseEther('10000'));
    await swap.addLiquidity(
      ethers.ZeroAddress,
      await token.getAddress(),
      ethers.parseEther('10'),
      ethers.parseEther('10000'),
      { value: ethers.parseEther('10') }
    );

    await token.transfer(alice.address, ethers.parseEther('1000'));

    return { swap, token, owner, alice };
  }

  it('quotes and executes an ETH -> token swap', async function () {
    const { swap, token, alice } = await loadFixture(deploySwapFixture);
    const tokenAddress = await token.getAddress();
    const refId = ethers.encodeBytes32String('swap-1');

    const quoted = await swap.getAmountOut(ethers.ZeroAddress, tokenAddress, ethers.parseEther('1'));
    expect(quoted).to.be.gt(0);

    const balanceBefore = await token.balanceOf(alice.address);
    await expect(
      swap
        .connect(alice)
        .swap(ethers.ZeroAddress, tokenAddress, ethers.parseEther('1'), 0, refId, {
          value: ethers.parseEther('1'),
        })
    ).to.emit(swap, 'Swapped');
    const balanceAfter = await token.balanceOf(alice.address);

    expect(balanceAfter - balanceBefore).to.equal(quoted);
  });

  it('reverts when slippage tolerance is not met', async function () {
    const { swap, token, alice } = await loadFixture(deploySwapFixture);
    const tokenAddress = await token.getAddress();
    const refId = ethers.encodeBytes32String('swap-2');

    await expect(
      swap
        .connect(alice)
        .swap(ethers.ZeroAddress, tokenAddress, ethers.parseEther('1'), ethers.parseEther('999999'), refId, {
          value: ethers.parseEther('1'),
        })
    ).to.be.revertedWithCustomError(swap, 'SlippageExceeded');
  });
});
