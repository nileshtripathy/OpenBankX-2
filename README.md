# OpenBankX 🌐🏦⚡

> **The Hybrid Open Banking & Decentralized Finance Bridge**
>
> A modern financial platform uniting traditional open banking (Plaid) and non-custodial Web3 protocols (EVM smart contracts) into a single, real-time unified dashboard.

---

## 📚 Technical Documentation & Architecture

Comprehensive design and product documentation are available in the [`docs/`](./docs) directory:

- 📄 **[Product Requirements Document (PRD)](./docs/PRD.md)** — Detailed problem statement, user personas, functional specifications, non-functional requirements, and future milestones.
- 🏛️ **[High-Level Design (HLD)](./docs/HLD.md)** — Architectural diagrams (Mermaid), system components, end-to-end data flows, sequence diagrams, security threat modeling (STRIDE), and scalability strategy.
- 🔧 **[Low-Level Design (LLD)](./docs/LLD.md)** — Class interfaces, MongoDB schemas & indexes, smart contract mathematical models, cryptographic routines (AES-256-GCM, EIP-191), REST API contracts, and frontend state topology.

---

## 🌟 Key Features

1. **Dual-Rail Authentication**:
   - Standard Email & Password with bcrypt hashing & JWT session rotation.
   - Web3 Wallet Nonce Challenge (EIP-191 signature verification) for passwordless Web3 login.
   - Account linking to bind self-custodial wallets to existing email profiles.

2. **Traditional Banking Rail (Fiat)**:
   - Plaid Open Banking integration for connecting real-world checking and savings accounts.
   - Built-in Mock Banking Provider sandbox for rapid offline development.
   - AES-256-GCM encryption for bank credentials at rest.
   - On-demand multi-institution balance refresh and account unlinking.

3. **Decentralized Finance Rail (Crypto)**:
   - **`OpenBankXVault.sol`**: Smart contract custody for native ETH and allowlisted ERC-20 tokens, featuring zero-gas internal P2P transfers and emergency circuit breaker.
   - **`OpenBankXSwap.sol`**: Constant-product automated market maker ($x \cdot y = k$) with 0.3% pool fee, slippage protection, and minimum liquidity locking.
   - **`MockERC20.sol`**: Test token (`OBXT`) with an open faucet for local sandbox experimentation.

4. **Real-Time Blockchain Indexer & Event Stream**:
   - Automated historical event backfill and live JSON-RPC event subscription.
   - Idempotent MongoDB log ingestion on `(txHash, logIndex)`.
   - Server-Sent Events (SSE) streaming live transactions directly to connected clients without polling.
   - A **Socket.IO** channel (JWT-authenticated, per-user/per-wallet rooms) pushes on-chain events and refreshed bank balances to the dashboard the instant they change.

5. **Performance & Reliability**:
   - **Redis** read-through caching for on-chain balance reads, blockchain config, and linked bank accounts, with active invalidation on writes (never serves stale data past its TTL).
   - **node-cron** scheduled jobs: periodic bank balance refresh across all linked accounts, and a blockchain-indexer lag health check.
   - **Docker**-based deployment: multi-stage builds for both services, `docker-compose.yml` for one-command local/prod-like startup. See [`DEPLOYMENT.md`](./DEPLOYMENT.md).

6. **AI Assistant** (`/assistant`):
   - Multi-step, tool-using agent (Claude via `@anthropic-ai/sdk`) grounded in the user's real account data - never guesses a balance, always calls a tool (`get_bank_accounts`, `get_balance_summary`, `get_vault_balance`, `get_recent_transactions`).
   - Streams its response over Server-Sent Events, including live tool-call status, so the UI shows "Checking your vault balance..." as it happens rather than a blank wait.
   - RAG: a small knowledge base answers "how does X work" questions, retrieved via cosine similarity - real Voyage AI embeddings if `VOYAGE_API_KEY` is set, a local TF-IDF fallback otherwise so it works out of the box.
   - A hand-written eval set (`npm run ai:eval <email>`) checks tool selection and RAG-grounded factual correctness.

7. **Unified Dashboard & UI**:
   - React 18 + Vite + TypeScript + TailwindCSS + Radix UI.
   - Real-time unified portfolio overview showing aggregate fiat balances and on-chain vault holdings.
   - Interactive deposit, withdraw, transfer, and swap modal flows with optimistic feedback.

---

## 🛠️ Project Structure

```
openbankx/
├── backend/       # Express.js, TypeScript, Mongoose, Ethers v6, Plaid SDK
├── contracts/     # Solidity 0.8.24, Hardhat, OpenZeppelin, Chai test fixtures
├── frontend/      # React 18, Vite, TailwindCSS, TanStack Query, Zustand
└── docs/          # Comprehensive PRD, HLD, and LLD specifications
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js >= 18.x
- MongoDB (local or MongoDB Atlas connection URI)
- MetaMask or any Web3 browser extension

### 2. Smart Contracts (Hardhat)
```bash
cd contracts
npm install
npm run compile
npm test
# Start local hardhat node and deploy contracts
npx hardhat node
# In a separate terminal:
npm run deploy:local
```

### 3. Backend API Server
```bash
cd backend
npm install
cp .env.example .env
# Update .env with MongoDB URI and deployed contract addresses
npm run dev
```

### 4. Frontend Client
```bash
cd frontend
npm install
cp .env.example .env
# Update VITE_API_BASE_URL and contract addresses
npm run dev
```

---

## 🐳 Docker Quick Start

The whole stack (MongoDB, Redis, backend API, frontend) comes up with one command once `backend/.env` is filled in (see step 3 above for the values it needs):

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000/api (health check at `/api/health`)
- Mongo: localhost:27017 · Redis: localhost:6379

Smart contracts still need to be deployed separately (`contracts/` isn't containerized) — deploy to a testnet or a Hardhat node reachable from the `backend` container, then set `VAULT_CONTRACT_ADDRESS` / `SWAP_CONTRACT_ADDRESS` in `backend/.env` before starting the stack.

Full deployment options (cloud platforms, env var reference, production hardening) are in [`DEPLOYMENT.md`](./DEPLOYMENT.md).

---

## 📄 License
MIT © OpenBankX Core Team
