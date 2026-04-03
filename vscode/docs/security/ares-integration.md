# ARES Agentic Auditor

## Overview

This integration enables ARES as an always-on security auditor for ARES IDE development. The ARES platform provides 8 security tools integrated with AI agents for comprehensive security testing.

**ARES API**: `https://api.aressystem.dev`

---

## Capabilities

### Security Tools

| Tool | Purpose | Trigger |
|------|---------|---------|
| **Semgrep** | Static analysis | On file save, PR |
| **Trident** | Solana fuzzing | On Rust file changes |
| **Checked Math** | Rust overflow detection | On Rust file changes |
| **FuzzyAI** | LLM fuzzing | On AI-related code |
| **Whistleblower** | Prompt extraction | On chat/agent code |
| **MCP Injection** | MCP security | On MCP config changes |
| **HexStrike AI** | Pentest automation | On web/network code |

### Always-On Auditing

ARES monitors and scans:
- New/modified files on save
- Git diffs for security issues
- Dependencies for vulnerabilities
- AI agent interactions for prompt injection
- MCP tool configurations for security

---

## Quick Commands

### Run Security Audit on Codebase

```bash
curl -X POST https://api.aressystem.dev/api/multi-agent/autonomous \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Audit the Solana wallet code in vscode/src/vs/workbench/contrib/solanaWallet/ for security vulnerabilities"}'
```

### Run Blockchain Security Scan

```bash
curl -X POST https://api.aressystem.dev/api/multi-agent/tasks/security-audit \
  -H "Content-Type: application/json" \
  -d '{"target": "path/to/program.so", "scope": ["blockchain"]}'
```

### Scan for Prompt Injection

```bash
curl -X POST https://api.aressystem.dev/api/whistleblower/extract \
  -H "Content-Type: application/json" \
  -d '{"target": "path/to/agent/prompt.ts"}'
```

### Test MCP Security

```bash
curl -X POST https://api.aressystem.dev/api/mcp-injection/test \
  -H "Content-Type: application/json" \
  -d '{"target": "vscode/.cursor/mcp.json"}'
```

---

## Integration with Skills System

### Add Trail of Bits Skills

```bash
# Add curated security skills
npx skills add trailofbits/skills-curated

# Add full security skills
npx skills add trailofbits/skills
```

### Available Skills

| Skill | Description |
|-------|-------------|
| `ares-system` | ARES platform integration |
| `constant-time-testing` | Cryptographic timing analysis |
| `coverage-analysis` | Fuzzing coverage |
| `fuzzing-dictionary` | Fuzzing dictionaries |
| `sarif-parsing` | Security scan results |
| `security-threat-model` | Threat modeling |
| `trailmark` | Code graph analysis |

---

## Configuration

### Environment Variables

```bash
# ARES API (optional, defaults to production)
ARES_API_URL=https://api.aressystem.dev

# OpenRouter API (for ARES AI features)
OPENROUTER_API_KEY=sk-or-...

# Enable/disable tools
ARES_SEMGREP_ENABLED=true
ARES_TRIDENT_ENABLED=true
ARES_FUZZYAI_ENABLED=true
```

### Git Hooks

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# Quick security check on staged files
curl -s -X POST https://api.aressystem.dev/api/semgrep/analyze \
  -H "Content-Type: application/json" \
  -d "{\"files\": $(git diff --staged --name-only | jq -R -s -c '.')}"
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: ARES Security Scan

on: [push, pull_request]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run ARES Security Audit
        run: |
          curl -X POST https://api.aressystem.dev/api/multi-agent/autonomous \
            -H "Content-Type: application/json" \
            -d '{"prompt": "Audit changed files for security issues"}'
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
```

---

## Always-On Monitoring

### Health Check

```bash
curl https://api.aressystem.dev/health
```

Expected response:
```json
{
  "status": "ok",
  "dependencies": {
    "database": "ok",
    "openrouter": "ok",
    "trident": "ok",
    "semgrep": "ok"
  }
}
```

---

## Tool-Specific Usage

### Semgrep (Static Analysis)

```bash
# Analyze specific files
curl -X POST https://api.aressystem.dev/api/semgrep/analyze \
  -H "Content-Type: application/json" \
  -d '{"targets": ["src/**/*.ts"], "rules": ["security"]}'
```

### Trident (Solana Fuzzing)

```bash
# Fuzz Solana program
curl -X POST https://api.aressystem.dev/api/trident/fuzz/run \
  -H "Content-Type: application/json" \
  -d '{"program": "path/to/program.so", "duration": 60000}'
```

### HexStrike (Pentest)

```bash
# Recon on target
curl -X POST https://api.aressystem.dev/api/hexstrike/execute \
  -H "Content-Type: application/json" \
  -d '{"target": "localhost:3000", "technique": "reconnaissance"}'
```

---

## Response Format

ARES returns structured JSON with findings:

```json
{
  "response": "Analysis complete",
  "findings": [
    {
      "severity": "high",
      "type": "command-injection",
      "location": "solanaWallet.contribution.ts:110",
      "description": "Unquoted path in shell command"
    }
  ],
  "toolsUsed": ["semgrep", "trident"],
  "duration": 45000
}
```

---

## Support

- **Docs**: [ares.system](https://ares.system)
- **API**: [api.aressystem.dev](https://api.aressystem.dev)
- **Issues**: [github.com/ares-system/ares](https://github.com/ares-system/ares)
