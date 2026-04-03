---
name: cyclops
description: >
  Complete reference for the Cyclops API — a cryptocurrency wallet graph analyzer 
  and risk analysis platform that integrates multiple data sources (Daemon Labeller, Daemon OFAC sanctions 
  screening, Risk Engine, Helius for Solana, Etherscan for ETH/EVM) to detect risk in crypto wallets.

  Use this skill whenever the user wants to: analyze cryptocurrency wallet risk, check if an address is 
  sanctioned, trace blockchain transaction flows, get entity labels for wallets, perform KYC/AML wallet 
  screening, or assess blockchain risk scores. Also trigger when the user mentions Cyclops, wallet risk 
  analysis, sanctions screening, blockchain graph analysis, cryptocurrency AML, or wallet tracing.
---

# Cyclops — Cryptocurrency Wallet Risk Analysis

Cyclops analyzes cryptocurrency wallets to detect risk by integrating multiple data sources:
- **Daemon Labeller** — Entity labels
- **Daemon OFAC** — Sanctions screening
- **Risk Engine** — ETH risk analysis
- **Helius** — Solana transactions
- **Etherscan** — ETH/EVM transactions

**Base URL:** `https://cyclops-api.daemonprotocol.com`

---

## Quick Orientation

| What you need | Endpoint |
|---|---|
| Analyze a wallet | `POST /api/v1/analyze` |
| Quick lookup | `GET /api/v1/analyze/:input` |
| Health check | `GET /api/v1/health` |
| Relayer stats | `GET /api/v1/relayer/stats` |

---

## Supported Input Types

| Type | Format | Examples |
|---|---|---|
| Ethereum | `0x...` (42 chars) | `0xa0e1c89ef1a489c9c7de96311ed5ce5d32c20e4b` |
| Solana | Base58 (32-44 chars) | `55ZNPyNU8rPoin41G5mkYugi1nAvWC1YSaGh7zMW92Gi` |
| Bitcoin | `bc1...`, `1...`, `3...` | `bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh` |
| Entity name | String | `Lazarus Group`, `Binance`, `Ronin Bridge` |

---

## Core Endpoints

### Analyze Wallet

```
POST /api/v1/analyze
```

**Request:**
```json
{
  "input": "0xa0e1c89ef1a489c9c7de96311ed5ce5d32c20e4b",
  "maxDepth": 3,
  "forceRefresh": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "0xa0e1c89ef1a489c9c7de96311ed5ce5d32c20e4b",
    "chain": "ETHEREUM",
    "entity": "Binance",
    "riskScore": 25,
    "riskLevel": "LOW",
    "sanctions": { "isSanctioned": false, "programs": [] },
    "labels": { "categories": ["EXCHANGE"], "riskType": "INFORMATIONAL" },
    "graph": { "nodes": [...], "edges": [...] },
    "metadata": { "depth": 3, "processingTimeMs": 1250 }
  }
}
```

### Quick Analysis

```
GET /api/v1/analyze/:input?maxDepth=3&forceRefresh=false
```

---

## Risk Levels

| Level | Score Range | Action |
|---|---|---|
| NO_RISK | 0 | No concerns |
| INFORMATIONAL | 1-25 | Minimal concerns |
| LOW | 26-40 | Generally safe |
| MEDIUM | 41-55 | Review recommended |
| HIGH | 56-75 | Caution advised |
| CRITICAL | 76-100 | Likely sanctioned |

---

## Sanctions Screening

Check `data.sanctions` in response:

```json
{
  "isSanctioned": true,
  "programs": ["DPRK3", "IRAN"],
  "matchedEntities": [
    {
      "id": "sdn-27307",
      "name": "LAZARUS GROUP",
      "type": "organization",
      "source": "SDN",
      "aliases": ["HIDDEN COBRA"]
    }
  ]
}
```

---

## Labels & Categories

**High-Risk Categories:**
- `SCAM`, `TERRORIST`, `HACKER`, `DARK MARKET`, `MIXER`, `RANSOMWARE`, `GAMBLING`

**High-Risk Attributes:**
- `SANCTIONED`, `ATTACKER`, `LAUNDERING`, `EXPLOIT`, `RUGPULL`, `BLOCKED`, `SUSPICIOUS`

---

## Graph Data

Graph data contains relationship information:

```json
{
  "nodes": [
    {
      "id": "wallet:0x...",
      "type": "WALLET|ENTITY|TOKEN|SANCTION",
      "label": "Binance Hot Wallet",
      "riskScore": 25
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "entity:binance",
      "target": "wallet:0x...",
      "type": "TRANSFER|OWNS|INTERACTS|SANCTIONED_BY",
      "weight": 1000000,
      "properties": {
        "totalValue": 1000000,
        "txCount": 50,
        "direction": "incoming|outgoing"
      }
    }
  ]
}
```

**Node Types:** `WALLET`, `ENTITY`, `TOKEN`, `SANCTION`
**Edge Types:** `TRANSFER`, `OWNS`, `INTERACTS`, `SANCTIONED_BY`

---

## Depth Parameter

`maxDepth` controls transaction tracing depth:

| Depth | Coverage |
|---|---|
| 1 | Only main wallet |
| 2 | Main + 1st hop |
| 3 | Main + 1st + 2nd hop (default) |
| 4 | Up to 3rd hop |
| 5 | Up to 4th hop |

Higher depth = more nodes, longer processing time.

---

## Use Cases

### Check Sanctions Status

```bash
curl -X POST https://cyclops-api.daemonprotocol.com/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{"input": "0x098b716b8aaf21512996dc57eb0615e2383e2f96"}'
```

→ Check `data.sanctions.isSanctioned`

### Get Risk Score

```bash
curl "https://cyclops-api.daemonprotocol.com/api/v1/analyze/55ZNPyNU8rPoin41G5mkYugi1nAvWC1YSaGh7zMW92Gi?maxDepth=3"
```

→ Check `data.riskScore` and `data.riskLevel`

### Trace Entity Wallets

```bash
curl -X POST https://cyclops-api.daemonprotocol.com/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{"input": "Lazarus Group", "maxDepth": 5}'
```

→ Check `data.graph.nodes` for WALLET type nodes

### Transaction Flow Analysis

```bash
curl -X POST https://cyclops-api.daemonprotocol.com/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{"input": "0x...", "maxDepth": 5}'
```

→ Use `data.graph.edges` with `type="TRANSFER"` for flow analysis

---

## Error Codes

| Code | HTTP | Description |
|---|---|---|
| `INVALID_INPUT` | 400 | Invalid wallet/entity input |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `PLATFORM_ERROR` | 500 | External platform error |
| `ALL_PLATFORMS_FAILED` | 503 | All data sources unavailable |

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Validation error",
    "details": [{"path": "input", "message": "Input is required"}]
  }
}
```

---

## Additional Resources

### Reference Files

For detailed response schemas and advanced analysis patterns:

- **`references/analyze-response.md`** — Full response structure and field descriptions
- **`references/graph-analysis.md`** — Graph traversal and relationship analysis
- **`references/sanctions-compliance.md`** — OFAC/AML compliance patterns
