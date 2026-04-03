# ARES Agentic Auditor for ARES IDE

## Overview

This directory contains the ARES Agentic Auditor integration for ARES IDE. ARES is an AI-powered security testing platform that provides 8 integrated security tools for comprehensive security analysis.

## Directory Structure

```
.ares/
├── ares-agent.json          # Main agent configuration
├── ares-vscode-settings.json # VS Code extension settings
└── README.md               # This file
```

## Quick Setup

### 1. Install Skills

```bash
# Add curated security skills from Trail of Bits
npx skills add trailofbits/skills-curated

# Add full security skills collection
npx skills add trailofbits/skills
```

### 2. Configure ARES Agent

The agent configuration is in `ares-agent.json`. Key settings:

- **monitoring.onSave**: Enable scanning on file save
- **monitoring.onCommit**: Enable scanning on git commit
- **tools.*.enabled**: Enable/disable specific tools

### 3. Set Environment Variables

```bash
# Optional: Use local ARES instance
export ARES_API_URL=http://localhost:8889

# Required for AI features
export OPENROUTER_API_KEY=sk-or-...
```

## Tools Enabled

| Tool | Purpose | Automatically Scans |
|------|---------|-------------------|
| **Semgrep** | Static analysis | All TypeScript, Rust, Python files |
| **Trident** | Solana fuzzing | Rust files (`.rs`) |
| **Checked Math** | Overflow detection | Rust files |
| **FuzzyAI** | LLM fuzzing | AI agent code |
| **Whistleblower** | Prompt extraction | Agent/prompt code |
| **MCP Injection** | MCP security | MCP config files |

## Always-On Features

### On File Save
- Semgrep analysis of modified file
- Type-specific security checks

### On Git Commit
- Scan all staged files
- Check for secrets in commits

### On Pull Request
- Full security audit
- Dependency vulnerability check

## Usage

### Run Manual Security Scan

```bash
# Full audit
curl -X POST https://api.aressystem.dev/api/multi-agent/autonomous \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Audit the codebase for security vulnerabilities"}'
```

### Check ARES Health

```bash
curl https://api.aressystem.dev/health
```

### Run Specific Tool

```bash
# Semgrep
curl -X POST https://api.aressystem.dev/api/semgrep/analyze \
  -d '{"targets": ["src/"], "rules": ["security"]}'

# Trident (Solana)
curl -X POST https://api.aressystem.dev/api/trident/fuzz/run \
  -d '{"program": "path/to/program.so"}'

# MCP Security
curl -X POST https://api.aressystem.dev/api/mcp-injection/test \
  -d '{"target": ".cursor/mcp.json"}'
```

## CI/CD Integration

See [ares-security-auditor.yml](../../.github/workflows/ares-security-auditor.yml) for GitHub Actions integration.

## Documentation

- [ARES Integration Guide](../docs/security/ares-integration.md)
- [Security Architecture](../docs/security/architecture.md)
- [ARES API Reference](https://api.aressystem.dev)

## Support

- **ARES System**: https://ares.system
- **API**: https://api.aressystem.dev
- **Issues**: GitHub Issues
