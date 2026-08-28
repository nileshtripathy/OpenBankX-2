# OpenBankX — High-Level Design Document (HLD)

---

## 1. System Overview & Architectural Principles

**OpenBankX** is designed as a modular, decoupled, event-driven hybrid fintech architecture. The platform seamlessly bridges the **Fiat Rail** (traditional banking infrastructure via Plaid and Open Banking protocols) and the **Crypto Rail** (decentralized smart contracts on EVM-compatible blockchains).

```
                      +----------------------------------------+
                      |         OpenBankX Architecture         |
                      +----------------------------------------+
                                          |
         +--------------------------------+--------------------------------+
         |                                                                 |
         v                                                                 v
+------------------+                                             +--------------------+
|    FIAT RAIL     |                                             |    CRYPTO RAIL     |
| (Traditional)    |                                             |   (Decentralized)  |
+------------------+                                             +--------------------+
| • Plaid OpenBank |                                             | • EVM Contracts    |
| • Mock Sandbox   |                                             | • OpenBankXVault   |
| • AES-256-GCM    |                                             | • OpenBankXSwap    |
| • Balance Sync   |                                             | • Real-Time SSE    |
+------------------+                                             +--------------------+
```

### 1.1 Core Architectural Principles
1. **Separation of Concerns**: Strict boundary between off-chain accounting (read caches, user identity, aggregated views) and on-chain authority (funds custody, AMM liquidity, state transitions).
2. **On-Chain Financial Truth**: All crypto fund movements, balances, and liquidity math exist exclusively on-chain (`OpenBankXVault` and `OpenBankXSwap`). The backend indexes smart contract logs into MongoDB solely for fast queries and real-time frontend streaming.
3. **Zero-Knowledge Credential Handling**: Third-party bank access tokens are never exposed to the client or stored in plaintext; they are encrypted at rest with AES-256-GCM.
4. **Event-Driven Reactivity**: Real-time contract events are ingested via WebSocket/JSON-RPC listeners and pushed to clients via Server-Sent Events (SSE) without client polling.
5. **Idempotency & Reorg Resilience**: Every indexed blockchain event is uniquely identified by `(txHash, logIndex)` with deterministic state updates.

---

## 2. High-Level System Architecture

### 2.1 System Context & Container Diagram

```mermaid
graph TB
    subgraph Client Tier ["Client Application Tier (SPA)"]
        UI["React 18 + Vite + TS Single Page App"]
        MM["MetaMask / Web3 Provider"]
        UI <--> MM
    end

    subgraph Gateway Tier ["Application / API Gateway Tier"]
        API["Node.js / Express TypeScript API Server"]
        AUTH_MOD["Auth & JWT Service"]
        BANK_MOD["Bank Service (Plaid / Mock)"]
        CHAIN_MOD["Blockchain Service"]
        SYNC_MOD["Blockchain Event Indexer & SSE"]
        
        API --> AUTH_MOD
        API --> BANK_MOD
        API --> CHAIN_MOD
        API --> SYNC_MOD
    end

    subgraph Database Tier ["Data Persistence Tier"]
        MONGO[("MongoDB Cluster\n- users\n- bank_accounts\n- blockchain_transactions\n- sync_states")]
        MEM_STORE["In-Memory Nonce Challenge Store (TTL)"]
    end

    subgraph Blockchain Tier ["Blockchain & Smart Contract Tier"]
        RPC["EVM JSON-RPC Node (Hardhat / Ethereum / L2)"]
        VAULT_C["OpenBankXVault.sol"]
        SWAP_C["OpenBankXSwap.sol"]
        ERC20_C["MockERC20 / Tokens"]
        
        RPC --- VAULT_C
        RPC --- SWAP_C
        RPC --- ERC20_C
    end

    subgraph External Providers ["External Banking Providers"]
        PLAID["Plaid Banking API (Sandbox / Production)"]
        MOCK_P["Mock Bank Provider Engine"]
    end

    UI -- "HTTPS REST (JWT Auth)" --> API
    UI -- "SSE EventStream (/stream)" --> SYNC_MOD
    MM -- "EIP-1193 RPC Transactions" --> RPC

    AUTH_MOD <--> MONGO
    AUTH_MOD <--> MEM_STORE
    BANK_MOD <--> MONGO
    BANK_MOD <--> PLAID
    BANK_MOD <--> MOCK_P
    
    CHAIN_MOD <--> MONGO
    CHAIN_MOD -- "eth_call / getBalance" --> RPC
    SYNC_MOD -- "eth_getLogs / Live Filters" --> RPC
    SYNC_MOD --> MONGO
```

---

## 3. Core Subsystem Breakdown

### 3.1 Client Tier (Frontend Single Page Application)
- **Framework**: React 18, Vite, TypeScript, TailwindCSS, Radix UI primitives.
- **State Management**:
  - **Zustand**: Client authentication state, linked wallet address, active tokens.
  - **TanStack React Query**: Server state caching, optimistic updates, automatic invalidation for bank accounts, balances, transaction history, and quotes.
- **Web3 Interaction**: `ethers.js` (v6) BrowserProvider for communicating with MetaMask, requesting signatures, approving tokens, and invoking smart contract write methods (`depositETH`, `depositToken`, `withdrawETH`, `withdrawToken`, `transfer`, `swap`).
- **Real-Time Integration**: Native `EventSource` connection for receiving live transaction events over SSE.

### 3.2 Backend API Tier (Node.js & Express)
- **Runtime & Language**: Node.js, Express.js, TypeScript with strict type checking.
- **Security Middleware**: CORS origin verification, Helmet HTTP headers, IP-based rate limiting (`express-rate-limit`), cookie parser for HTTP-only refresh tokens, global async error handler.
- **Authentication Subsystem**:
  - Email/Password login: bcrypt password hashing ($\ge 12$ salt rounds), dual JWT model (15-minute access token + 7-day refresh token in HTTP-only cookie with reuse revocation).
  - Web3 Nonce Challenge: In-memory store with automatic TTL cleanup; cryptographic message verification with `ethers.verifyMessage`.
- **Bank Provider Interface Subsystem**:
  - Plaid Provider: Integrates with official Plaid SDK for link token creation, public token exchange, and balance fetching.
  - Mock Provider: In-memory deterministic simulator for offline local development and rapid testing.
  - Cryptography Engine: AES-256-GCM cipher for protecting `accessTokenEncrypted` at rest.

### 3.3 Blockchain Indexer & Real-Time Sync Subsystem
- **Historical Event Backfill**: Scans past blocks starting from `SyncState.lastProcessedBlock` up to current chain head for `Deposited`, `Withdrawn`, `Transferred`, and `Swapped` events.
- **Live Event Subscription**: Subscribes to smart contract event filters on the JSON-RPC provider. On new mined block logs:
  1. Parses raw log arguments into structured domain events.
  2. Fetches block timestamps (with caching).
  3. Upserts transaction into MongoDB with unique key `(txHash, logIndex)`.
  4. Emits internal event via `txEvents` (`EventEmitter`).
  5. Updates `SyncState.lastProcessedBlock`.
- **Server-Sent Events (SSE)**: Streams filtered transaction payloads directly to clients matching either `walletAddress` or `counterpartyAddress` with a 25-second heartbeat ping.

### 3.4 Smart Contract Tier (Solidity 0.8.24)
- **`OpenBankXVault.sol`**:
  - Central ledger for native ETH (`address(0)`) and approved ERC-20 tokens.
  - Non-custodial deposit & withdrawal functions using OpenZeppelin `ReentrancyGuard` and `SafeERC20`.
  - Internal P2P transfer method (`transfer`) allowing instant off-chain/on-chain settlement between registered addresses without external token transfers.
  - Emergency `Pausable` control by contract owner.
- **`OpenBankXSwap.sol`**:
  - Automated Market Maker based on constant-product invariant $x \cdot y = k$.
  - 0.3% fixed swap fee retained in liquidity pool.
  - Permanent lock of `MINIMUM_LIQUIDITY` (1000 wei) on initial deposit to defend against first-depositor inflation attacks.
  - Slippage control via `minAmountOut` parameter.
  - Permissioned pool creation by contract owner.
- **`MockERC20.sol`**:
  - 18-decimal test token (`OBXT`) with public faucet function for local development.

---

## 4. End-to-End Sequence & Data Flow Diagrams

### 4.1 Dual-Rail Authentication & Web3 Nonce Challenge Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Frontend as React Client
    participant MetaMask as MetaMask Wallet
    participant Backend as Express API
    participant Store as Nonce Challenge Store
    participant DB as MongoDB (User)

    Note over User, DB: Web3 Sign-In Flow (EIP-191)
    User->>Frontend: Click "Sign in with Ethereum"
    Frontend->>MetaMask: Request Connected Accounts (eth_requestAccounts)
    MetaMask-->>Frontend: Return wallet address (0x123...)
    Frontend->>Backend: POST /api/wallet/nonce { walletAddress: "0x123..." }
    Backend->>Store: Generate & Store Nonce + Timestamp (5 min TTL)
    Backend-->>Frontend: Return formatted EIP-191 sign message
    Frontend->>MetaMask: personal_sign(message, walletAddress)
    MetaMask-->>Frontend: Return ECDSA Signature (0xabc...)
    Frontend->>Backend: POST /api/wallet/verify { walletAddress, signature }
    Backend->>Store: Consume & Invalidate Nonce
    Backend->>Backend: Recover signer via ethers.verifyMessage()
    alt Signer Matches Address
        Backend->>DB: Find or Create User by walletAddress
        Backend->>DB: Issue & Store Refresh Token
        Backend-->>Frontend: HTTP 200 OK + JWT Access Token + Set-Cookie (Refresh)
        Frontend-->>User: Navigate to /dashboard
    else Signature Invalid
        Backend-->>Frontend: HTTP 401 Unauthorized
    end
```

---

### 4.2 Fiat Rail Account Linking & Balance Sync Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Frontend as React Client
    participant PlaidWidget as Plaid Link SDK
    participant Backend as Express API
    participant PlaidAPI as Plaid External API
    participant Crypto as AES-256-GCM Engine
    participant DB as MongoDB (BankAccount)

    User->>Frontend: Click "Connect Bank Account"
    Frontend->>Backend: POST /api/bank/link-token (Bearer JWT)
    Backend->>PlaidAPI: client.linkTokenCreate({ userId, products: ['auth', 'transactions'] })
    PlaidAPI-->>Backend: Return link_token
    Backend-->>Frontend: Return { linkToken }
    Frontend->>PlaidWidget: Initialize Plaid Link with linkToken
    User->>PlaidWidget: Select Bank & Authenticate Credentials
    PlaidWidget-->>Frontend: onSuccess(public_token, metadata)
    Frontend->>Backend: POST /api/bank/exchange-token { publicToken }
    Backend->>PlaidAPI: itemPublicTokenExchange(public_token)
    PlaidAPI-->>Backend: Return { access_token, item_id }
    Backend->>PlaidAPI: accountsGet({ access_token })
    PlaidAPI-->>Backend: Return institution metadata & accounts list
    Backend->>Crypto: encrypt(access_token) -> IV + Tag + Ciphertext
    Backend->>DB: Upsert BankAccount records with accessTokenEncrypted
    Backend->>PlaidAPI: accountsBalanceGet({ access_token })
    PlaidAPI-->>Backend: Return live checking/savings balances
    Backend->>DB: Update currentBalance & availableBalance
    Backend-->>Frontend: HTTP 201 Created + Sanitize Bank Accounts List
    Frontend-->>User: Render Connected Bank Cards with Live Balances
```

---

### 4.3 Web3 Vault Operations (Deposit, Internal Transfer, Withdraw)

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Frontend as React Client
    participant MetaMask as MetaMask / Provider
    participant VaultContract as OpenBankXVault.sol
    participant Indexer as Backend Sync Indexer
    participant DB as MongoDB (BlockchainTx)
    participant ClientSSE as Frontend SSE Listener

    Note over User, ClientSSE: Vault Deposit & Real-time Indexing
    User->>Frontend: Enter Deposit: 1.0 ETH
    Frontend->>MetaMask: vault.depositETH(refId, { value: 1.0 ETH })
    MetaMask->>VaultContract: Execute transaction
    VaultContract->>VaultContract: balances[address(0)][msg.sender] += 1.0 ETH
    VaultContract-->>VaultContract: emit Deposited(user, address(0), 1.0 ETH, refId)
    VaultContract-->>MetaMask: Transaction Mined (txHash)
    MetaMask-->>Frontend: Receipt Confirmed
    
    par Blockchain Indexer Processing
        Indexer->>VaultContract: Detects 'Deposited' Event Log
        Indexer->>DB: Upsert BlockchainTransaction { txHash, logIndex, eventType: 'deposit', amountIn: 1.0 ETH }
        Indexer->>ClientSSE: Push SSE Event { eventType: 'deposit', amountIn: 1.0 ETH, ... }
        ClientSSE-->>Frontend: Invalidate TanStack Query Cache & Play Toast Notification
    end
```

---

### 4.4 Automated Market Maker (AMM) Swap Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Frontend as React Client
    participant SwapContract as OpenBankXSwap.sol
    participant TokenContract as MockERC20.sol
    participant Indexer as Blockchain Indexer
    participant DB as MongoDB

    User->>Frontend: Select Pair (ETH -> OBXT), Enter 0.5 ETH
    Frontend->>SwapContract: call getAmountOut(address(0), OBXT, 0.5 ETH)
    SwapContract-->>Frontend: Returns quote (e.g. 498.5 OBXT)
    Frontend->>Frontend: Calculate minAmountOut with 0.5% slippage
    User->>Frontend: Click "Confirm Swap"
    
    Frontend->>SwapContract: swap(address(0), OBXT, 0.5 ETH, minAmountOut, refId, { value: 0.5 ETH })
    SwapContract->>SwapContract: Validate pool, fee (0.3%), and slippage >= minAmountOut
    SwapContract->>SwapContract: Update pool reserves (reserveA += 0.5 ETH, reserveB -= 498.5 OBXT)
    SwapContract->>TokenContract: SafeERC20.safeTransfer(user, 498.5 OBXT)
    SwapContract-->>SwapContract: emit Swapped(user, address(0), OBXT, 0.5 ETH, 498.5 OBXT, refId)
    
    Indexer->>SwapContract: Ingest 'Swapped' Event
    Indexer->>DB: Save BlockchainTransaction { eventType: 'swap' }
    Indexer-->>Frontend: Stream SSE 'swap' event to user
```

---

### 4.5 Real-Time Blockchain Sync & SSE Ingestion Pipeline

```mermaid
graph TD
    A[Smart Contracts on EVM Chain] -->|Mined Logs| B(JSON-RPC WebSocket / Poll Provider)
    B -->|Event Filters: Deposited, Withdrawn, Transferred, Swapped| C[BlockchainSyncService.ts]
    
    subgraph Ingestion Engine
        C --> D{Is Startup?}
        D -- Yes --> E[backfillContract: queryFilter from lastProcessedBlock to currentBlock]
        D -- No --> F[subscribeLive: Real-time contract.on listeners]
        E --> G[Log Parser: parseVaultLog / parseSwapLog]
        F --> G
        G --> H[Block Timestamp Cache / Resolver]
        H --> I[upsertLog: MongoDB findOneAndUpdate with unique txHash + logIndex]
        I --> J[Update SyncState.lastProcessedBlock]
        I --> K[txEvents.emit 'tx', doc]
    end
    
    subgraph SSE Distribution Engine
        K --> L[blockchain.controller.ts: streamTransactions]
        L --> M{Does tx match user's walletAddress or counterparty?}
        M -- Yes --> N[Write Event Payload: data: JSON]
        M -- No --> O[Discard Event]
        N --> P[Frontend useTransactionStream Hook]
        P --> Q[Query Client Cache Invalidation & UI Update]
    end
```

---

## 5. Technology Stack & Component Justification

| Layer | Selected Technology | Version | Rationale & Trade-Offs |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React + Vite | React 18.3, Vite 5.x | Ultra-fast HMR build times, rich TypeScript support, native React 18 concurrency and hooks. |
| **Styling & Design System** | TailwindCSS + Radix UI | Tailwind 3.4, Radix Primitives | Headless, accessible primitives with zero runtime CSS overhead, dark/light banking theme. |
| **State & Data Fetching** | TanStack React Query + Zustand | React Query 5.x, Zustand 4.x | React Query handles automatic caching, refetching, and deduplication; Zustand provides tiny, boilerplate-free client state. |
| **Web3 Client SDK** | Ethers.js | 6.13.x | Lightweight, modern JavaScript/TypeScript EVM library with native BigInt support and robust contract abstractions. |
| **Backend Runtime** | Node.js + Express | Node 20 LTS, Express 4.x | Battle-tested asynchronous I/O model well suited for real-time SSE streams and event-driven architectures. |
| **Database** | MongoDB + Mongoose | MongoDB 7.x, Mongoose 8.x | Flexible document schema for heterogeneous bank/blockchain logs; native unique compound index constraints and high write throughput. |
| **Smart Contracts** | Solidity + Hardhat + OpenZeppelin | Solidity 0.8.24, Hardhat 2.22 | Industry standard smart contract toolchain; OpenZeppelin contracts provide battle-tested security primitives (`ReentrancyGuard`, `SafeERC20`, `Ownable`, `Pausable`). |
| **Security & Ciphers** | Node.js `crypto` (AES-256-GCM) + bcryptjs | Built-in crypto, bcryptjs 2.4 | Authenticated encryption (AEAD) prevents tampering with banking credentials; bcrypt ensures robust password hashing. |

---

## 6. Security Architecture & Threat Modeling (STRIDE)

```
+-----------------------------------------------------------------------------------+
| STRIDE THREAT MODEL & MITIGATION MATRIX                                           |
+-------------------+--------------------------------+------------------------------+
| Threat Category   | Potential Vector               | OpenBankX Mitigation         |
+-------------------+--------------------------------+------------------------------+
| Spoofing          | Impersonating wallet address   | EIP-191 Nonce Challenge with |
|                   | or user session                | 5m TTL + ECDSA recover       |
+-------------------+--------------------------------+------------------------------+
| Tampering         | Modifying banking access token | AES-256-GCM authenticated tag|
|                   | or on-chain balance            | Smart contract immutable CEI |
+-------------------+--------------------------------+------------------------------+
| Repudiation       | Denying on-chain transfer      | Cryptographic tx receipt     |
|                   | or swap operation              | indexed from EVM logs        |
+-------------------+--------------------------------+------------------------------+
| Information       | Exposing bank credentials      | Encrypted at rest; fields    |
| Disclosure        | or password hashes             | set with `select: false`     |
+-------------------+--------------------------------+------------------------------+
| Denial of         | API flooding or spamming       | Express rate limiting +      |
| Service (DoS)     | SSE stream connections         | heartbeat keep-alive timeout |
+-------------------+--------------------------------+------------------------------+
| Elevation of      | Non-admin executing admin      | Role-Based Access Control    |
| Privilege         | endpoints or contract pause    | (RBAC) + Ownable modifier    |
+-------------------+--------------------------------+------------------------------+
```

---

## 7. Scalability & High Availability Architecture

1. **Stateless API Gateway**: Express instances maintain no session state in memory (JWT tokens & cookies used for auth). API servers can horizontally scale behind an AWS ALB or NGINX reverse proxy.
2. **Dedicated Indexer Worker**: In production, the `BlockchainSyncService` is decoupled into a dedicated single-instance background worker to avoid redundant RPC event polling across multiple API instances.
3. **Database Read Replicas**: MongoDB replica set enables offloading heavy transaction history queries from the primary write node.
4. **WebSocket / RPC Node Failover**: Ethers.js JSON-RPC provider configured with fallback endpoints (e.g., Alchemy / Infura / QuickNode) to maintain zero sync downtime.
