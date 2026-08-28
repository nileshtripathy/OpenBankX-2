import { ethers } from 'ethers';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { createChallenge, consumeChallenge } from '../utils/walletChallengeStore';
import { buildSignMessage } from '../utils/walletMessage';
import { issueTokens, sanitize } from './auth.service';

function normalize(address: string): string {
  return address.toLowerCase();
}

/** Throws if the address is malformed; returns the EIP-55 checksummed form. */
function checksum(address: string): string {
  try {
    return ethers.getAddress(address);
  } catch {
    throw ApiError.badRequest('Invalid Ethereum address');
  }
}

export const WalletService = {
  /** Step 1: issue a nonce-bearing message for the client to sign in MetaMask. */
  requestNonce(walletAddress: string) {
    const address = checksum(walletAddress);
    const challenge = createChallenge(address);
    const message = buildSignMessage(address, challenge.nonce, challenge.issuedAt);
    return { message };
  },

  /** Step 2: verify the signature and log in (creating the user if new). */
  async verifyAndLogin(walletAddress: string, signature: string) {
    const address = checksum(walletAddress);
    const challenge = consumeChallenge(address);
    if (!challenge) {
      throw ApiError.unauthorized(
        'No pending sign-in request for this wallet, or it expired. Request a new nonce.'
      );
    }

    const message = buildSignMessage(address, challenge.nonce, challenge.issuedAt);

    let recovered: string;
    try {
      recovered = ethers.verifyMessage(message, signature);
    } catch {
      throw ApiError.unauthorized('Malformed signature');
    }

    if (normalize(recovered) !== normalize(address)) {
      throw ApiError.unauthorized('Signature does not match wallet address');
    }

    let user = await User.findOne({ walletAddress: normalize(address) }).select(
      '+refreshTokens'
    );

    if (!user) {
      user = await User.create({
        name: `Wallet ${address.slice(0, 6)}...${address.slice(-4)}`,
        walletAddress: normalize(address),
      });
    }

    if (!user.isActive) {
      throw ApiError.forbidden('This account has been deactivated');
    }

    const tokens = issueTokens(user);
    user.refreshTokens = [...user.refreshTokens.slice(-4), tokens.refreshToken];
    await user.save();

    return { user: sanitize(user), ...tokens };
  },

  /** Attaches a verified wallet to an already-authenticated (e.g. email) account. */
  async linkWallet(userId: string, walletAddress: string, signature: string) {
    const address = checksum(walletAddress);
    const challenge = consumeChallenge(address);
    if (!challenge) {
      throw ApiError.unauthorized(
        'No pending sign-in request for this wallet, or it expired. Request a new nonce.'
      );
    }

    const message = buildSignMessage(address, challenge.nonce, challenge.issuedAt);

    let recovered: string;
    try {
      recovered = ethers.verifyMessage(message, signature);
    } catch {
      throw ApiError.unauthorized('Malformed signature');
    }

    if (normalize(recovered) !== normalize(address)) {
      throw ApiError.unauthorized('Signature does not match wallet address');
    }

    const existingOwner = await User.findOne({ walletAddress: normalize(address) });
    if (existingOwner && existingOwner._id.toString() !== userId) {
      throw ApiError.conflict('This wallet is already linked to another account');
    }

    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound('User not found');

    user.walletAddress = normalize(address);
    await user.save();

    return sanitize(user);
  },
};
