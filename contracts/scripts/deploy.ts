import { ethers, network } from 'hardhat';
import fs from 'fs';
import path from 'path';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying to "${network.name}" as ${deployer.address}`);

  const Vault = await ethers.getContractFactory('OpenBankXVault');
  const vault = await Vault.deploy(deployer.address);
  await vault.waitForDeployment();
  console.log('OpenBankXVault deployed to:', await vault.getAddress());

  const Swap = await ethers.getContractFactory('OpenBankXSwap');
  const swap = await Swap.deploy(deployer.address);
  await swap.waitForDeployment();
  console.log('OpenBankXSwap deployed to:', await swap.getAddress());

  const deployment: Record<string, unknown> = {
    network: network.name,
    vault: await vault.getAddress(),
    swap: await swap.getAddress(),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  // Local-only: deploy a mock token, allowlist it in the vault, and seed a
  // ETH<->TOKEN pool so the frontend has something to interact with immediately.
  if (network.name === 'hardhat' || network.name === 'localhost') {
    const MockToken = await ethers.getContractFactory('MockERC20');
    const token = await MockToken.deploy(
      'OpenBankX Test Token',
      'OBXT',
      18,
      ethers.parseEther('1000000')
    );
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    console.log('MockERC20 (OBXT) deployed to:', tokenAddress);

    await (await vault.setTokenSupported(tokenAddress, true)).wait();
    console.log('Vault: OBXT allowlisted');

    await (await swap.createPool(ethers.ZeroAddress, tokenAddress)).wait();
    console.log('Swap: ETH/OBXT pool created');

    await (await token.approve(await swap.getAddress(), ethers.parseEther('10000'))).wait();
    await (
      await swap.addLiquidity(
        ethers.ZeroAddress,
        tokenAddress,
        ethers.parseEther('10'),
        ethers.parseEther('10000'),
        { value: ethers.parseEther('10') }
      )
    ).wait();
    console.log('Swap: seeded ETH/OBXT pool with 10 ETH / 10,000 OBXT');

    deployment.mockToken = tokenAddress;
  }

  const outDir = path.join(__dirname, '..', 'deployments');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${network.name}.json`);
  fs.writeFileSync(outFile, JSON.stringify(deployment, null, 2));
  console.log(`\nDeployment info written to ${outFile}`);
  console.log('\nCopy these into backend/.env and frontend/.env:');
  console.log(`VAULT_CONTRACT_ADDRESS=${deployment.vault}`);
  console.log(`SWAP_CONTRACT_ADDRESS=${deployment.swap}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
