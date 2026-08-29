# Deposits and withdrawals

## How a deposit works
Depositing moves funds from your connected wallet into the OpenBankX vault
smart contract. You approve the token (skipped automatically for ETH), then
call deposit. The vault credits your internal balance for that token. This
is recorded on-chain as a `Deposit` event and appears in your transaction
history within a few seconds once the block confirms.

## How a withdrawal works
Withdrawing moves funds from your vault balance back to your connected
wallet. You can withdraw any amount up to your current vault balance for
that token. There is no lock-up period or withdrawal delay in the current
version of OpenBankX - withdrawals settle as soon as the transaction is
mined.

## Are there fees?
The vault contract itself does not charge a protocol fee on deposits or
withdrawals. You still pay the underlying network's gas fee to submit the
transaction, which varies with network congestion and is unrelated to
OpenBankX. Token swaps (see the swap knowledge doc) do carry a small
protocol fee.
