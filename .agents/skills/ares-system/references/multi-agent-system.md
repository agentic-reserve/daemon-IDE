# Multi-Agent System

Hierarchical AI agent system for orchestrating ARES security tools.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR                          │
│              stepfun/step-3.5-flash:free               │
│              256K context, fast reasoning                │
│                                                         │
│  - Analyzes user prompt                                  │
│  - Plans task decomposition                              │
│  - Delegates to specialists                              │
│  - Synthesizes final response                            │
└──────────────────────┬──────────────────────────────────┘
                       │ plans tasks
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│  SPECIALIST   │ │  SPECIALIST   │ │  SPECIALIST   │
│   (nemotron)  │ │   (nemotron)  │ │   (nemotron)  │
│               │ │               │ │               │
│ Domain:       │ │ Domain:       │ │ Domain:       │
│ blockchain    │ │ ai-security   │ │ mcp-security  │
└───────┬───────┘ └───────┬───────┘ └───────┬───────┘
        │ tasks            │ tasks           │ tasks
        ▼                  ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│    WORKER     │ │    WORKER     │ │    WORKER     │
│   (glm nano)  │ │   (glm nano)  │ │   (glm nano)  │
│               │ │               │ │               │
│ Executes:     │ │ Executes:     │ │ Executes:     │
│ - Trident     │ │ - FuzzyAI     │ │ - MCP Inject  │
│ - Semgrep     │ │ - Whistleblow  │ │ - HexStrike   │
└───────────────┘ └───────────────┘ └───────────────┘
```

---

## Models

| Role | Model ID | Context | Best For |
|---|---|---|---|
| **Orchestrator** | `stepfun/step-3.5-flash:free` | 256K | Fast reasoning, task coordination |
| **Specialist** | `nvidia/nemotron-3-super-120b-a12b:free` | 128K | Complex domain analysis |
| **Worker** | `nvidia/nemotron-3-nano-30b-a3b:free` | 131K | Quick execution, code review |

**Model Selection Strategy:**
```typescript
orchestrator: stepfun/step-3.5-flash:free  // Fast + large context
specialist:   nvidia/nemotron-3-super-120b-a12b:free  // Complex analysis
worker:       nvidia/nemotron-3-nano-30b-a3b:free  // Speed
quickTask:    stepfun/step-3.5-flash:free  // Speed priority
default:      stepfun/step-3.5-flash:free  // Fallback
```

---

## Agent Domains

| Domain | Specialist | Tools Used |
|---|---|---|
| `security` | General security | Semgrep, Checked Math |
| `blockchain` | Smart contract | Trident, Semgrep |
| `ai-security` | LLM fuzzing | FuzzyAI, Whistleblower |
| `mcp-security` | MCP testing | MCP Injection |
| `pentest` | Offensive security | HexStrike |

---

## Task Types

| Type | Description | Domains |
|---|---|---|
| `security-scan` | General vulnerability scan | security, blockchain |
| `ai-security-scan` | LLM security testing | ai-security |
| `mcp-security-scan` | MCP vulnerability audit | mcp-security |
| `blockchain-audit` | Smart contract audit | blockchain |
| `pentest` | Penetration testing | pentest |
| `autonomous` | AI-decides-all | all |

---

## Streaming Events

### Event: status

Phase change and progress updates.

```typescript
{
  type: 'status',
  phase: 'planning' | 'executing' | 'synthesizing' | 'finalizing',
  message: 'Planning analysis strategy...',
  agent: 'Orchestrator' | 'Specialist-1' | 'Worker-1',
  model: 'stepfun/step-3.5-flash:free',
  step?: number,      // Current step (1-indexed)
  totalSteps?: number // Total steps
}
```

### Event: token

Single LLM token chunks for real-time streaming.

```typescript
{
  type: 'token',
  text: 'Found potential ',
  agent: 'Specialist-1',
  model: 'nvidia/nemotron-3-super-120b-a12b:free',
  phase: 'executing'
}
```

### Event: result

Final output when task completes.

```typescript
{
  type: 'result',
  response: 'Analysis complete. Found 3 critical issues...',
  findings: [
    {
      severity: 'critical',
      type: 'reentrancy',
      location: 'lib.rs:156',
      description: 'Missing reentrancy guard'
    }
  ],
  toolsUsed: ['semgrep', 'trident'],
  duration: 45000,
  timestamp: '2026-03-19T00:00:00Z'
}
```

### Event: error

Failure notification.

```typescript
{
  type: 'error',
  message: 'Trident binary not found'
}
```

---

## Processing Pipeline

### Phase 1: Planning (Orchestrator)

1. Analyze user prompt
2. Determine task type and domain
3. Select appropriate specialists
4. Plan execution steps
5. Emit `status` with `phase: 'planning'`

### Phase 2: Executing (Specialists + Workers)

1. Specialist analyzes in detail
2. Delegate tasks to workers
3. Workers execute security tools
4. Emit `status` with `phase: 'executing'`
5. Emit `token` for streaming results

### Phase 3: Synthesizing (Orchestrator)

1. Collect all tool outputs
2. Correlate findings
3. Assess severity
4. Generate recommendations

### Phase 4: Finalizing (Orchestrator)

1. Format final response
2. Include all findings
3. Emit `result` event
4. Log execution metrics

---

## Workflows

### Sequential Workflow

Execute tasks in order with dependencies.

```json
{
  "name": "smart-contract-audit",
  "steps": [
    {
      "agent": "specialist",
      "task": "Plan audit strategy for this Solana program"
    },
    {
      "agent": "worker",
      "task": "Run Semgrep static analysis"
    },
    {
      "agent": "worker",
      "task": "Run Trident fuzzing"
    },
    {
      "agent": "specialist",
      "task": "Synthesize findings and provide report"
    }
  ]
}
```

### Parallel Workflow

Execute independent tasks concurrently.

```json
{
  "tasks": [
    { "type": "ai-security-scan", "domain": "ai-security" },
    { "type": "mcp-security-scan", "domain": "mcp-security" },
    { "type": "blockchain-audit", "domain": "blockchain" }
  ]
}
```

---

## Security Audit Workflow

Comprehensive scan across all domains.

```bash
curl -X POST https://api.aressystem.dev/api/multi-agent/tasks/security-audit \
  -H "Content-Type: application/json" \
  -d '{
    "target": "0x742d35Cc6634C0532925a3b844Bc9e7595f",
    "scope": ["blockchain", "ai-security", "mcp-security"]
  }'
```

This automatically creates parallel tasks:
1. AI security scan (FuzzyAI + Whistleblower)
2. MCP security scan (MCP Injection)
3. General vulnerability scan (Semgrep + Checked Math)
4. Blockchain audit (Trident) — if scope includes `blockchain`

---

## Code Example: Streaming Client

```javascript
const response = await fetch(
  'https://api.aressystem.dev/api/multi-agent/autonomous/stream',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'Audit this Solana program for vulnerabilities'
    })
  }
);

const reader = response.body.getReader();
const decoder = new TextDecoder();

let fullResponse = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const lines = decoder.decode(value).split('\n\n');
  for (const line of lines) {
    if (!line.startsWith('event: ') && !line.startsWith('data: ')) continue;
    
    const match = line.match(/^(\w+): (.+)$/);
    if (!match) continue;

    const [, type, data] = match;
    if (type === 'status') {
      const status = JSON.parse(data);
      console.log(`[${status.phase}] ${status.message}`);
    }
    if (type === 'token') {
      const token = JSON.parse(data);
      process.stdout.write(token.text);
      fullResponse += token.text;
    }
    if (type === 'result') {
      const result = JSON.parse(data);
      console.log('\n\n--- Findings ---');
      result.findings.forEach(f => console.log(f));
    }
  }
}
```

---

## System Status

```bash
curl https://api.aressystem.dev/api/multi-agent/status
```

```json
{
  "status": "healthy",
  "uptime": 86400000,
  "models": {
    "orchestrator": "stepfun/step-3.5-flash:free",
    "specialist": "nvidia/nemotron-3-super-120b-a12b:free",
    "worker": "nvidia/nemotron-3-nano-30b-a3b:free"
  },
  "agents": {
    "total": 8,
    "active": 2,
    "idle": 6
  },
  "tasks": {
    "completed": 150,
    "pending": 0,
    "failed": 3
  }
}
```

---

## Configuration

Environment variables for multi-agent system:

| Variable | Default | Description |
|---|---|---|
| `ARES_OPENROUTER_MODEL` | stepfun/step-3.5-flash:free | Default model |
| `ARES_TOOLS_TIMEOUT` | 300000 | Tool execution timeout (ms) |
| `ARES_TOOLS_CACHE_ENABLED` | true | Enable result caching |
| `ARES_TOOLS_CACHE_TTL` | 3600 | Cache TTL (seconds) |
