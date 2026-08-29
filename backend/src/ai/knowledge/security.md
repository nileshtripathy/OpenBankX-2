# Security

## Is my bank data encrypted?
Yes. The access token OpenBankX stores for each linked bank account is
encrypted at rest before it's written to the database - it's never stored
in plain text. OpenBankX never stores your bank login credentials at all;
those are handled entirely by Plaid's widget and never pass through
OpenBankX's servers.

## Is my password stored securely?
Passwords are hashed with bcrypt before being stored - OpenBankX never
stores or can look up your plaintext password, including for customer
support purposes. If you forget it, the only path is a reset, not a
lookup.

## How does wallet login work?
Connecting a wallet uses a standard "sign-in with Ethereum" style flow:
OpenBankX issues a one-time message, your wallet signs it, and the
signature is verified against your public address. Your private key never
leaves your wallet or touches OpenBankX's servers.

## What happens if my account is compromised?
Contact support to have your account deactivated immediately, which
revokes every active session token. For a linked wallet, moving funds out
of the vault to a new wallet is also always available to you directly,
independent of your OpenBankX login, since the vault is a smart contract
you interact with using your own wallet signature.
