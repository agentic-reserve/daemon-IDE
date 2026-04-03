# ARES IDE Security Architecture

## Overview

ARES IDE is a VS Code fork for Solana blockchain development with integrated AI agent capabilities. This document describes the security architecture, threat mitigations, and security best practices.

## Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Space                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Terminal   │  │    Wallet    │  │    MCP Tools         │  │
│  │  (Commands)  │  │   (Keys)    │  │  (AI Agent Access)  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                  │                     │              │
│         ▼                  ▼                     ▼              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              ARES IDE Security Layer                      │  │
│  │  • Shell escaping      • Secret storage    • Risk tiers   │  │
│  │  • Path validation     • Key validation    • Allowlists   │  │
│  │  • RPC validation      • DPRK warnings     • Replay prot  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      External Services                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Solana RPC   │  │  LLM APIs   │  │    MCP Servers       │  │
│  │ (Data only)  │  │ (AI Models) │  │   (Tool providers)   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Security Layers

### 1. AI Agent Security (MCP Tools)

**Component**: `vscode/src/vs/workbench/services/aiProvider/common/mcpToolRouter.ts`

#### Risk Classification

Tools are classified into 4 risk tiers:

| Risk Level | Patterns | Action Required |
|------------|----------|----------------|
| **Critical** | `transfer.*all`, `delete.*account`, `export.*key`, `chmod.*777` | Two-button mandatory approval |
| **High** | `exec`, `delete`, `sudo`, `key`, `secret`, `shell` | Single confirmation |
| **Medium** | `write`, `create`, `update`, `modify` | Single confirmation |
| **Low** | Everything else | Silent execution |

#### Allowlist Enforcement

```typescript
// Default: DENY ALL
McpAllowedTools: []

// Server allowlist
McpAllowedServers: []  // Must explicitly add servers
```

#### Secret Redaction

Before sending tool output to LLM:
- API keys (`ak-*`, `sk-*`) → `[REDACTED]`
- Ethereum addresses (`0x...`) → `[REDACTED]`
- JWTs (`eyJ...`) → `[REDACTED]`
- Solana keys (`solana_*`) → `[REDACTED]`

**File**: `vscode/src/vs/workbench/services/aiProvider/common/aiProviderService.ts:23-43`

---

### 2. Wallet Security

**Component**: `vscode/src/vs/workbench/contrib/solanaWallet/`

#### Secret Key Storage

- Keys stored via `ISecretStorageService` (OS keychain)
- Pattern: `solide.wallet.{alias}`
- Public keys in `IStorageService` (non-sensitive)

#### Shell Command Escaping

All terminal commands use single-quote escaping:

```typescript
function escapeShellArg(value: string): string {
    return `'${value.replace(/'/g, "'\\''")}'`;
}
```

**Files**:
- `solanaWallet.contribution.ts:69-76`
- `anchor.contribution.ts:38-46`

#### Security Warnings

Wallet operations display security alerts:

```
⚠️ SECURITY WARNING: Never paste your secret key into chat.
⚠️ SECURITY: Your secret key is stored securely.
```

**DPRK Alert** (April 2026):
```
⚠️ DPRK-linked actors stole $286M via durable nonces.
Use hardware wallets, verify all transactions.
```

**File**: `vscode/src/vs/workbench/contrib/solanaWallet/browser/solanaWalletView.ts:59-64`

---

### 3. RPC Security

**Component**: `vscode/src/vs/workbench/contrib/solana/common/solanaConfiguration.ts`

#### Allowed Endpoints

```typescript
const DEFAULT_RPC_ALLOWLIST = [
    'https://api.devnet.solana.com',
    'https://api.testnet.solana.com',
    'https://mainnet.helius-rpc.com',
    'https://rpc.helius.xyz',
    'https://api.mainnet-beta.solana.com',
];
```

#### Security Checks

| Check | Action |
|-------|--------|
| Not in allowlist | Warning notification |
| Non-HTTPS URL | Warning notification |

**File**: `vscode/src/vs/workbench/contrib/solanaExplorer/browser/solanaExplorer.contribution.ts:40-68`

---

### 4. x402 Payment Security

**Component**: `vscode/src/vs/workbench/services/aiProvider/common/aiProviderService.ts`

#### Replay Protection

```typescript
const REPLAY_WINDOW_MS = 60_000;
const _recentSignatures = new Map<string, number>();

// Check for replay
if (_recentSignatures.has(signature)) {
    throw new Error('Payment signature was recently used');
}
_recentSignatures.set(signature, Date.now());
```

#### Signature Binding

Signatures bound to: `URL + requirement + header-hash`

**File**: `aiProviderService.ts:338-355`

---

### 5. Plugin Security

**Component**: `vscode/src/vs/platform/agentHost/node/agentPluginManager.ts`

#### Content Hash Tracking

```typescript
// Track SHA-256 of plugin content
const contentHash = await this._computeContentHash(destDir);

if (trustedHash.contentHash !== contentHash) {
    this._logService.warn(
        `SECURITY: Plugin hash changed for ${ref.uri}`
    );
}
```

**File**: `agentPluginManager.ts:119-177`

---

### 6. Path Traversal Protection

**Component**: `vscode/src/vs/workbench/contrib/solanaEbpf/browser/solanaEbpf.contribution.ts`

```typescript
function isSafeProjectPath(p: string, allowedPrefix?: string): { safe: boolean } {
    const normalized = p.replace(/\\/g, '/');
    
    // Block path traversal
    if (normalized.includes('..')) {
        return { safe: false, reason: 'Path traversal not allowed' };
    }
    
    // Enforce prefix
    if (allowedPrefix && !normalized.startsWith(allowedPrefix)) {
        return { safe: false, reason: 'Path outside allowed directory' };
    }
    
    return { safe: true };
}
```

**File**: `solanaEbpf.contribution.ts:69-92`

---

## Threat Mitigations

| Threat ID | Description | Mitigation | Status |
|-----------|-------------|------------|--------|
| TM-001 | Prompt injection | Per-tool risk tiers | ✅ Done |
| TM-002 | Malicious MCP server | Deny-all allowlist | ✅ Done |
| TM-003 | x402 phishing/replay | Signature binding + replay protection | ✅ Done |
| TM-004 | Tool output exfil | Secret redaction | ✅ Done |
| TM-101 | Key exfil | Wallet UI warnings | ✅ Done |
| TM-102 | Terminal injection | Shell escaping | ✅ Done |
| TM-103 | Malicious RPC | Allowlist + HTTPS warnings | ✅ Done |
| TM-201 | Plugin injection | Content hash tracking | ✅ Done |
| TM-202 | postinstall patch | Security documentation | ✅ Done |
| TM-203 | Path traversal | Path validation | ✅ Done |

Full threat model: `../../../daemon-IDE-threat-model.md`

---

## Security Configuration

### VS Code Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `solide.ai.mcp.allowedServers` | `[]` | Allowed MCP server IDs |
| `solide.ai.mcp.allowedTools` | `[]` | Allowed tool patterns |
| `solide.solana.allowedRpcEndpoints` | Default list | Allowed RPC URLs |
| `solide.ebpf.ghidraInstallDir` | `""` | Ghidra installation path |
| `solide.ebpf.projectDir` | `~/.solide/ghidra-projects` | eBPF project root |

---

## Development Security Guidelines

### 1. Secret Handling

```typescript
// ✅ CORRECT: Use SecretStorageService
await secretStorageService.set(`solide.wallet.${alias}`, secretKey);

// ❌ WRONG: Log or expose secrets
console.log(secretKey);  // Never do this
```

### 2. Shell Commands

```typescript
// ✅ CORRECT: Escape arguments
runTerminalCommand(`solana-keygen new -o ${escapeShellArg(path)}`);

// ❌ WRONG: Unquoted interpolation
runTerminalCommand(`solana-keygen new -o "${path}"`);  // Risky
```

### 3. RPC URLs

```typescript
// ✅ CORRECT: Validate before use
if (!isRpcUrlAllowed(config, rpcUrl)) {
    notify.warning('Untrusted RPC endpoint');
}

// ❌ WRONG: Blind trust
const result = await fetch(rpcUrl);  // Risky
```

### 4. User Input

```typescript
// ✅ CORRECT: Validate paths
const validation = isSafeProjectPath(userPath);
if (!validation.safe) {
    throw new Error(validation.reason);
}

// ❌ WRONG: Accept any path
const file = URI.file(userPath);  // Could contain ..
```

---

## CI/CD Security

### Required Checks

| Check | Purpose | Fail on |
|-------|---------|---------|
| `cargo audit` | Rust vulnerability scan | Any finding |
| `npm audit --audit-level=critical` | npm vulnerability scan | Critical/High |
| `postinstall-audit` | Supply chain script review | Dangerous patterns |
| TypeScript compile | Catch type errors | Any error |

**File**: `.github/workflows/ares-solana-ci.yml`

### Dependency Pinning

Critical dependencies must use exact versions:

```json
// ❌ DANGEROUS
"@github/copilot": "^1.0.11"

// ✅ SAFE
"@github/copilot": "1.0.11"
```

See: `../../../SUPPLY-CHAIN-SECURITY.md`

---

## Security Incident Response

If you suspect a security incident:

1. **Revoke affected credentials** immediately
2. **Audit logs** for suspicious activity:
   ```bash
   # Check recent commits
   git log --since="24 hours ago"
   
   # Check for unexpected plugin changes
   grep "Plugin hash changed" ~/.ares-ide/logs/
   ```
3. **Rotate all keys** - assume compromise
4. **Report to team** via secure channel

---

## References

- [daemon-IDE Threat Model](../../daemon-IDE-threat-model.md)
- [Supply Chain Security Policy](../../SUPPLY-CHAIN-SECURITY.md)
- [sRFC-35 Domain Association](../solana/sbpf-asm-abort.md)
