# OpenBankX — Technical Documentation & Architecture Suite

Welcome to the technical documentation repository for **OpenBankX** — the next-generation hybrid fintech platform integrating traditional Open Banking (fiat rail) and decentralized EVM protocols (crypto rail).

---

## 📑 Documentation Index

| Document | File Link | Focus & Content Overview |
| :--- | :--- | :--- |
| **Product Requirements Document (PRD)** | [PRD.md](./PRD.md) | Product vision, target personas, functional requirements (FR), non-functional requirements (NFR), feature matrix, compliance tiers, success KPIs, and future roadmap. |
| **High-Level Design (HLD)** | [HLD.md](./HLD.md) | High-level system topology, container diagrams, core subsystem breakdown, end-to-end Mermaid sequence diagrams, technology justifications, STRIDE threat modeling, and scaling strategy. |
| **Low-Level Design (LLD)** | [LLD.md](./LLD.md) | Codebase file map, Mongoose schemas & compound indexes, Solidity contract math & invariants, AES-256-GCM / EIP-191 cryptographic algorithms, full REST & SSE API contracts, frontend state architecture, and testing matrices. |

---

## 🏗️ Architecture at a Glance

```
                                  +-----------------------+
                                  |    React 18 + Vite    |
                                  |   (Single Page App)   |
                                  +-----------+-----------+
                                              |
                     +------------------------+------------------------+
                     | HTTPS / SSE (JWT Auth)                          | Web3 (EIP-1193)
                     v                                                 v
         +-----------------------+                         +-----------------------+
         |  Express API Gateway  |                         |  EVM Blockchain Node  |
         | (Node.js, TypeScript) |                         |  (Hardhat / L1 / L2)  |
         +---+---------------+---+                         +-----------+-----------+
             |               |                                         |
     +-------+-------+   +---+-------------------+                     |
     | MongoDB Store |   | Plaid / Mock Provider |                     |
     | (Collections) |   | (Open Banking API)    |                     |
     +---------------+   +-----------------------+                     |
             ^                                                         |
             |============= Event Indexer (eth_getLogs) ===============+
                                [OpenBankXVault & OpenBankXSwap]
```

---

## 🚀 Key Technical Highlights

1. **Dual-Rail Authentication**:
   - Web2 Email & Password with bcrypt hashing ($\ge 12$ rounds) & rotating HTTP-only refresh tokens.
   - Web3 Nonce Challenge (EIP-191 personal sign) with 5-minute TTL challenge consumption.
   - 1-to-1 account binding between traditional accounts and self-custodial wallets.

2. **Fiat Rail Security**:
   - Zero-knowledge credential storage: Bank access tokens are encrypted with **AES-256-GCM** authenticated cipher at rest.
   - Plaid Link integration + offline deterministic Mock Bank Provider for sandboxed developer testing.

3. **Non-Custodial Smart Contract Vault (`OpenBankXVault.sol`)**:
   - Multi-asset custody supporting native ETH (`address(0)`) and approved ERC-20 tokens.
   - Internal zero-gas peer-to-peer balance settlement.
   - Protected with OpenZeppelin `ReentrancyGuard`, `SafeERC20`, and `Pausable` emergency stop.

4. **Constant-Product AMM DEX (`OpenBankXSwap.sol`)**:
   - $x \cdot y = k$ pricing algorithm with a fixed 0.3% liquidity fee and user slippage controls.
   - Initial deposit locks $1,000\text{ wei}$ of liquidity permanently to defeat share-inflation attacks.

5. **Sub-Second Real-Time Indexing (SSE)**:
   - Synchronizer backfills historical logs idempotently on `(txHash, logIndex)`.
   - Live smart contract event subscriptions broadcast over Server-Sent Events (`/api/blockchain/transactions/stream`).

---

## 📖 Recommended Reading Order

1. Start with the **[Product Requirements Document (PRD)](./PRD.md)** to understand the business goals, user personas, problem space, and functional scope.
2. Proceed to the **[High-Level Design (HLD)](./HLD.md)** for system diagrams, component interactions, and architectural patterns.
3. Dive into the **[Low-Level Design (LLD)](./LLD.md)** for schema definitions, smart contract math, cryptographic implementations, and API endpoint references.
