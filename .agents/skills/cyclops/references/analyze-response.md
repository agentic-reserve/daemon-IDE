# Cyclops-BE Analyze Response Reference

Complete field reference for the `/api/v1/analyze` response.

---

## Top-Level Response

```typescript
interface AnalyzeResponse {
  success: boolean;
  data: {
    address: string;           // Analyzed address (lowercase)
    chain: ChainType;
    entity: string | null;      // Entity name if known
    riskScore: number;           // 0-100
    riskLevel: RiskLevel;
    riskLevelDescription: string;
    sanctions: SanctionsInfo;
    labels: LabelsInfo;
    graph: GraphData;
    metadata: AnalysisMetadata;
  }
}
```

---

## Chain Types

```typescript
type ChainType = 'ETHEREUM' | 'SOLANA' | 'BITCOIN' | 'TRC' | 'OTHER';
```

---

## Sanctions Info

```typescript
interface SanctionsInfo {
  isSanctioned: boolean;
  programs: string[];           // e.g., ["DPRK3", "IRAN", "RUSSIAN"]
  matchedEntities: MatchedEntity[];
}

interface MatchedEntity {
  id: string;                   // e.g., "sdn-27307"
  name: string;                 // e.g., "LAZARUS GROUP"
  type: 'person' | 'organization' | 'vessel' | 'aircraft';
  source: 'SDN' | 'EU' | 'UK' | 'OFAC';
  aliases?: string[];           // e.g., ["HIDDEN COBRA", "APT38"]
  listedDate?: string;
  programNotes?: string;
}
```

---

## Labels Info

```typescript
interface LabelsInfo {
  categories: Category[];       // See categories below
  attributes: Attribute[];     // See attributes below
  riskIndicators: string[];    // e.g., ["SANCTIONED", "SCAM"]
  riskType: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL' | null;
  sources: Source[];            // Which sources contributed
}

type Category = 
  | 'EXCHANGE' | 'MIXER' | 'SCAM' | 'HACKER' | 'TERRORIST'
  | 'DARK_MARKET' | 'RANSOMWARE' | 'GAMBLING' | 'NFT'
  | 'DEFI' | 'CEX' | 'DAO' | 'GAMEFI' | 'BRIDGE';

type Attribute = 
  | 'HOT_WALLET' | 'COLD_WALLET' | 'SANCTIONED' | 'ATTACKER'
  | 'LAUNDERING' | 'EXPLOIT' | 'RUGPULL' | 'BLOCKED'
  | 'SUSPICIOUS' | 'VERIFIED' | 'MULTISIG' | 'TREZOR'
  | 'LEDGER' | 'CONTRACT' | 'PROXY';

type Source = 'labeller' | 'ofac' | 'riskEngine' | 'etherscan' | 'helius';
```

---

## Graph Data

```typescript
interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface GraphNode {
  id: string;                   // e.g., "wallet:0x..." or "entity:binance"
  type: 'WALLET' | 'ENTITY' | 'TOKEN' | 'SANCTION';
  label: string;               // Display name
  address?: string;            // Wallet address if applicable
  riskScore: number;
  properties: {
    chain?: ChainType;
    categories?: Category[];
    attributes?: Attribute[];
    firstSeen?: string;        // ISO date
    lastSeen?: string;         // ISO date
    totalReceived?: number;    // In base units
    totalSent?: number;
    txCount?: number;
  };
  position?: { x: number; y: number };  // For visualization
}

interface GraphEdge {
  id: string;                   // Unique edge ID
  source: string;               // Node ID
  target: string;               // Node ID
  type: 'TRANSFER' | 'OWNS' | 'INTERACTS' | 'SANCTIONED_BY' | 'MINED';
  weight: number;              // Transaction value in base units
  properties: {
    totalValue: number;
    txCount: number;
    direction: 'incoming' | 'outgoing' | 'bidirectional';
    firstTx?: string;          // ISO date
    lastTx?: string;           // ISO date
    asset?: string;             // Token symbol if applicable
  };
}
```

---

## Metadata

```typescript
interface AnalysisMetadata {
  analyzedAt: string;           // ISO timestamp
  depth: number;               // maxDepth used
  sourcesQueried: Source[];    // Data sources consulted
  incomplete: boolean;          // true if some sources failed
  failedSources: string[];     // Failed source names
  processingTimeMs: number;    // Total processing time
  cacheHit: boolean;           // true if from cache
}
```

---

## Common Patterns

### High-Risk Wallet Detection

```typescript
function isHighRisk(data: AnalyzeResponse['data']): boolean {
  return (
    data.riskLevel === 'CRITICAL' ||
    data.riskLevel === 'HIGH' ||
    data.sanctions.isSanctioned === true ||
    data.labels.categories.some(c => 
      ['SCAM', 'HACKER', 'TERRORIST', 'DARK_MARKET', 'RANSOMWARE'].includes(c)
    )
  );
}
```

### Exchange Detection

```typescript
function isExchange(labels: LabelsInfo): boolean {
  return (
    labels.categories.includes('EXCHANGE') ||
    labels.categories.includes('CEX')
  );
}
```

### Transaction Counterparty Analysis

```typescript
function getTopCounterparties(
  graph: GraphData, 
  address: string, 
  limit = 10
): { entity: string; volume: number; txCount: number }[] {
  return graph.edges
    .filter(e => e.source === `wallet:${address}` || e.target === `wallet:${address}`)
    .map(e => {
      const counterparty = e.source === `wallet:${address}` ? e.target : e.source;
      return {
        entity: counterparty,
        volume: e.properties.totalValue,
        txCount: e.properties.txCount
      };
    })
    .sort((a, b) => b.volume - a.volume)
    .slice(0, limit);
}
```
