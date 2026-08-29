# Linking a bank account

## How linking works
OpenBankX connects to your bank through Plaid (or a mock provider in
development). You choose your institution, log in through Plaid's secure
widget - OpenBankX never sees your bank password - and Plaid returns a
token OpenBankX exchanges for read-only access to your account balances.

## What OpenBankX can and can't do with a linked account
A linked account is read-only: OpenBankX can see the account's name,
type, and balance, and refresh that balance periodically. It cannot move
money, view your full transaction history from the bank, or make changes
to the account itself. Everything money-related that OpenBankX can
actually move happens through the crypto vault, not the bank connection.

## Refreshing balances
Balances refresh automatically on a schedule (a background job checks
every few hours) and any time you tap "refresh" on an account manually.
You'll see an update in real time on the dashboard the moment a refresh
completes, without needing to reload the page.

## Unlinking
You can unlink a bank account at any time from the Bank Accounts page.
Unlinking revokes OpenBankX's access token with the provider and removes
the account from your dashboard - it does not affect your actual bank
account in any way.
