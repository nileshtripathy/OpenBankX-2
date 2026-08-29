# Swaps and exchange rates

## How a swap works
The swap contract lets you exchange one supported token for another
directly from your vault balance, without withdrawing to your wallet
first. You request a quote for the amount you'd receive, review it, then
confirm the swap. The contract debits the token you're selling and credits
the token you're buying in the same transaction.

## Are there fees on swaps?
Yes. Swaps carry a small protocol fee, taken out of the output amount, to
cover the liquidity the swap contract provides. The quote you're shown
before confirming already reflects the fee, so the number displayed is
what you'll actually receive - there's no separate fee line added
afterward.

## Slippage
Because a quote is calculated at the moment you request it, the price can
move slightly by the time your transaction is mined (especially during
volatile markets). OpenBankX's swap flow re-quotes immediately before you
confirm to keep this window small, but on-chain price movement between
quote and confirmation is a normal part of how swaps work everywhere, not
specific to this app.
