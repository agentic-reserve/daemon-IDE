# API Endpoints Reference

Complete reference for all ARES API endpoints.

**Base URL (Production):** `https://api.aressystem.dev`
**Base URL (Local):** `http://localhost:8889`

---

## Health Check

```
GET /health
```

Returns system health status including dependency states.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-19T00:00:00Z",
  "dependencies": {
    "database": "ok",
    "openrouter": "ok",
    "trident": "ok"
  }
}
```

---

## Multi-Agent System

### Health Check

```
GET /api/multi-agent/health
```

### List All Agents

```
GET /api/multi-agent/agents
```

**Response:**
```json
{
  "agents": [
    { "id": "orchestrator", "type": "orchestrator", "status": "idle" },
    { "id": "specialist-1", "type": "specialist", "domain": "security" }
  ],
  "count": 8
}
```

### Get Agent Details

```
GET /api/multi-agent/agents/:agentId
```

### System Info

```
GET /api/multi-agent/info
```

Returns model names, agent counts, and system configuration for frontend integration.

### System Status

```
GET /api/multi-agent/status
```

Returns system metrics and current load.

---

## Task Management

### Submit Task

```
POST /api/multi-agent/tasks
```

**Request body:**
```json
{
  "type": "security-scan",
  "description": "Audit Solana program for reentrancy",
  "priority": "high",
  "domain": "blockchain",
  "params": { "target": "0x123..." }
}
```

**Response:**
```json
{
  "id": "task-uuid",
  "type": "security-scan",
  "status": "pending",
  "createdAt": "2026-03-19T00:00:00Z"
}
```

### List All Tasks

```
GET /api/multi-agent/tasks
```

### Get Task Status

```
GET /api/multi-agent/tasks/:taskId
```

### Parallel Task Execution

```
POST /api/multi-agent/tasks/parallel
```

Execute multiple tasks concurrently.

**Request body:**
```json
{
  "tasks": [
    { "type": "ai-security-scan", "description": "...", "domain": "ai-security" },
    { "type": "mcp-security-scan", "description": "...", "domain": "mcp-security" }
  ]
}
```

---

## Autonomous Mode

### Non-Streaming

```
POST /api/multi-agent/autonomous
```

Send a natural language prompt for AI-powered analysis.

**Request body:**
```json
{
  "prompt": "Audit this Solana program for vulnerabilities: 0x123..."
}
```

**Response:**
```json
{
  "response": "Analysis complete. Found 3 potential issues...",
  "findings": [
    { "severity": "high", "type": "reentrancy", "location": "lib.rs:42" }
  ],
  "toolsUsed": ["trident", "semgrep"],
  "duration": 45000,
  "timestamp": "2026-03-19T00:00:00Z"
}
```

### Streaming (SSE)

```
POST /api/multi-agent/autonomous/stream
```

Real-time streaming response with per-token updates.

**Headers:** `Content-Type: application/json`

**SSE Events:**

```
event: status
data: {"phase":"init","message":"Initializing...","agent":"Orchestrator","model":""}

event: status
data: {"phase":"planning","message":"Planning analysis strategy...","agent":"Orchestrator","model":"stepfun/step-3.5-flash:free"}

event: status
data: {"phase":"executing","message":"Running Semgrep analysis...","agent":"Worker-1","model":"nvidia/nemotron-3-nano-30b-a3b:free","step":1,"totalSteps":3}

event: token
data: {"text":"Found","agent":"Worker-1","model":"nvidia/nemotron-3-nano-30b-a3b:free","phase":"executing"}

event: result
data: {"response":"Analysis complete...","findings":[...],"toolsUsed":["semgrep","trident"],"duration":45000,"timestamp":"2026-03-19T00:00:00Z"}
```

---

## Security Audit

### Comprehensive Security Audit

```
POST /api/multi-agent/tasks/security-audit
```

Runs parallel scans across all security domains.

**Request body:**
```json
{
  "target": "0x123...",
  "scope": ["blockchain", "ai-security", "mcp-security"]
}
```

**Response:**
```json
{
  "audit": "comprehensive-security-audit",
  "target": "0x123...",
  "scope": ["ai-security", "mcp-security", "general", "blockchain"],
  "tasks": [...],
  "summary": {
    "total": 4,
    "completed": 4,
    "failed": 0
  }
}
```

---

## Workflow Execution

### Sequential Workflow

```
POST /api/multi-agent/workflow
```

Execute a defined multi-step workflow.

**Request body:**
```json
{
  "name": "smart-contract-audit",
  "steps": [
    { "agent": "specialist", "task": "Static analysis with Semgrep" },
    { "agent": "worker", "task": "Fuzz with Trident" },
    { "agent": "specialist", "task": "Synthesize findings" }
  ]
}
```

---

## Security Tools

### Semgrep

```
POST /api/semgrep/analyze
GET  /api/semgrep/rules
GET  /api/semgrep/health
```

Static analysis for 30+ languages with Kudelski security rules.

### Trident

```
POST /api/trident/fuzz/run
GET  /api/trident/status
GET  /api/trident/health
```

Solana program fuzzing at 12,000 tx/s.

### FuzzyAI

```
POST /api/fuzzyai/fuzz
GET  /api/fuzzyai/attack-types
GET  /api/fuzzyai/health
```

LLM fuzzing with 18+ attack types.

### Checked Math

```
POST /api/checked-math/analyze
GET  /api/checked-math/health
```

Rust overflow detection and prevention.

### Whistleblower

```
POST /api/whistleblower/extract
GET  /api/whistleblower/health
```

System prompt extraction testing.

### MCP Injection

```
POST /api/mcp-injection/test
GET  /api/mcp-injection/health
```

MCP security testing and injection detection.

### HexStrike AI

```
POST /api/hexstrike/execute
GET  /api/hexstrike/agents
GET  /api/hexstrike/health
```

Pentest automation with 150+ Kali tools.

**Execute request:**
```json
{
  "target": "https://example.com",
  "technique": "reconnaissance",
  "agents": ["bugbounty", "cve-intel"]
}
```

**Execute response:**
```json
{
  "success": true,
  "target": "https://example.com",
  "technique": "reconnaissance",
  "agents": ["bugbounty", "cve-intel"],
  "results": [
    {
      "tool": "nmap",
      "duration": 3200,
      "output": "PORT   STATE SERVICE\n22/tcp open  ssh",
      "exitCode": 0
    }
  ],
  "timestamp": "2026-03-19T00:00:00Z"
}
```

---

## Common Error Responses

```json
{ "error": "Missing required field: prompt" }
```

```json
{ "error": "Agent not found", "status": 404 }
```

```json
{ "error": "Task execution timed out or failed", "status": 500 }
```

---

## Rate Limits

- Free tier: 60 requests/minute
- Paid tier: 300 requests/minute

---

## Caching

Tool results are cached by default with 1-hour TTL.

Disable caching:
```bash
ARES_TOOLS_CACHE_ENABLED=false
```
