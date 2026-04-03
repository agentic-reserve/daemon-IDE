# Agent-Authenticated Endpoints

Base URL: `https://daemon-ai-production.up.railway.app`

All endpoints in this file require:
```
Authorization: Bearer daemon_<key>
```

---

## Chat Completions

```
POST /v1/chat/completions
```

The core endpoint. OpenAI-compatible chat completions with optional streaming, MCP tool use, and agentic loop.

**Request body:**
```json
{
  "model": "openai/gpt-4o",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "What is Bitcoin?" }
  ],
  "stream": false,
  "session_id": "optional_uuid_to_continue_chat",
  "temperature": 0.7,
  "max_tokens": 2048
}
```

**Non-streaming response:**
```json
{
  "id": "chatcmpl-...",
  "model": "openai/gpt-4o",
  "choices": [{
    "message": { "role": "assistant", "content": "Bitcoin is..." },
    "finish_reason": "stop"
  }],
  "usage": { "prompt_tokens": 42, "completion_tokens": 150, "total_tokens": 192 }
}
```

**Notes:**
- Free tier agents can only use free/whitelisted models
- Tool use (MCP) is executed automatically in a loop (max 10 iterations) if tools are enabled for the agent
- Streaming format is documented in `agentic-patterns.md`
- Usage is tracked and billed atomically per request

---

## Models

```
GET /v1/models?page=1&limit=20
```

List all enabled OpenRouter models available on this platform.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "openai/gpt-4o",
      "name": "GPT-4o",
      "description": "...",
      "context_length": 128000,
      "pricing": {
        "prompt": "0.000005",
        "completion": "0.000015"
      },
      "supports_tools": true,
      "is_free": false
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 300, "pages": 15 }
}
```

---

## Agent Profile

```
GET /v1/agent/me
```

Returns the authenticated agent's full profile.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "My Agent",
    "user": { "id": "uuid", "email": "user@example.com" },
    "system_prompt": "You are a helpful assistant.",
    "default_model": "openai/gpt-4o",
    "wallet_address": "base58_solana_address",
    "subscription_plan": "pro",
    "mcp_servers": [...]
  }
}
```

`subscription_plan` is `"pro"` when balance ≥ $10 USDC, otherwise `"free"`.

---

## Agent Settings

```
PATCH /v1/agent/settings
```

Update the agent's configurable settings.

**Request body (all fields optional):**
```json
{
  "system_prompt": "You are a blockchain analyst...",
  "default_model": "anthropic/claude-3-5-sonnet",
  "wallet_address": "new_base58_address"
}
```

Note: `monthly_token_limit` can only be changed by admin, not through this endpoint.

---

## Usage Stats

```
GET /v1/agent/usage?month=2026-03
```

Monthly token usage breakdown.

**Response:**
```json
{
  "success": true,
  "data": {
    "month": "2026-03",
    "prompt_tokens": 1000000,
    "completion_tokens": 500000,
    "total_tokens": 1500000,
    "monthly_limit": 1000000,
    "requests": 200
  }
}
```

---

## Balance

```
GET /v1/agent/balance
```

Current USDC balance.

**Response:**
```json
{
  "success": true,
  "data": { "balance_usdc": "25.50", "updated_at": "2026-03-17T00:00:00Z" }
}
```

---

## Payment History

```
GET /v1/agent/payments?page=1&limit=20
```

Paginated list of USDC top-ups and deposits.

---

## Request Log

```
GET /v1/agent/requests?page=1&limit=20&start_date=2026-03-01&end_date=2026-03-31
```

Full audit log of LLM requests made by this agent.

**Response includes per-request:**
- `model`, `prompt_tokens`, `completion_tokens`, `cost_usdc`
- `mcp_tools_used` (array of tool names)
- `duration_ms`, `status`, `created_at`

---

## API Key Management

### List keys
```
GET /v1/agent/api-keys
```

Returns all API keys with prefix and metadata. Hash is never returned.

### Create key
```
POST /v1/agent/api-keys
```
```json
{ "label": "My App Key" }
```

Returns `api_key` in plaintext **once**. Store immediately.

### Delete key
```
DELETE /v1/agent/api-keys/:id
```

Permanently deletes the key. Ownership is verified before deletion.

### Regenerate key (requires Session Token, not API Key)
```
POST /v1/auth/regenerate-key
```
Deactivates all existing keys and returns a brand new one.

---

## MCP Server Management

### List available MCP servers
```
GET /v1/agent/mcp-servers
```

Returns all platform MCP servers, showing which ones are enabled for this agent.

### Enable a server
```
POST /v1/agent/mcp-servers
```
```json
{
  "mcp_server_id": "uuid",
  "config": { "key": "value" }
}
```

### Update server config
```
PATCH /v1/agent/mcp-servers/:id
```
```json
{ "config": { "key": "new_value" } }
```

### Disable a server
```
DELETE /v1/agent/mcp-servers/:id
```

---

## Chat History

### List sessions
```
GET /v1/agent/chats?page=1&limit=20
```

### Get full session
```
GET /v1/agent/chats/:id
```

### Get messages (paginated, mobile-friendly)
```
GET /v1/agent/chats/:id/messages?page=1&limit=50
```

Returns only `user` and `assistant` messages (tool calls filtered out).

### Delete session
```
DELETE /v1/agent/chats/:id
```

---

## Discover (Trending Articles)

```
GET /v1/agent/discover?category=top&page=1&limit=10
```

Trending articles powered by Exa web search.

**Categories:** `top` | `tech` | `finance` | `arts`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "title": "Article Title",
      "url": "https://...",
      "snippet": "...",
      "published_date": "2026-03-17",
      "source": "TechCrunch"
    }
  ]
}
```

---

## Finance Data

### Live market data
```
GET /v1/agent/finance
```

Returns live aggregated market data:
- **Indices:** S&P 500, NASDAQ, Dow Jones, VIX (from Yahoo Finance)
- **Crypto:** BTC, ETH, SOL prices (from Binance)
- **Market news:** latest headlines (from Exa)
- **Fear & Greed index** (from alternative.me)
- **Market status:** NYSE open/closed

### AI market analysis (1-hour cached)
```
GET /v1/agent/finance/analysis
```

GPT-generated 3–4 sentence market summary. Uses free OpenRouter models.

### Earnings calendar
```
GET /v1/agent/finance/earnings
```

Earnings calendar and recent reports. Synced from external sources every 6 hours.

### Market predictions
```
GET /v1/agent/finance/predictions
```

Market predictions. Synced every 6 hours.

### Stock screener
```
GET /v1/agent/finance/screener
```

Top 20 stocks: top gainers, top losers, most active, sector performance.
Data from Yahoo Finance, cached for 15 minutes.

---

## User Agents Management

These routes require a **User Session Token**, not an API key.

### List user's agents
```
GET /v1/agents
```

### Create a new agent
```
POST /v1/agents
```
```json
{ "name": "My Second Agent" }
```

Returns the new agent object and its `api_key` (plaintext, shown once).
Max 10 agents per user.
