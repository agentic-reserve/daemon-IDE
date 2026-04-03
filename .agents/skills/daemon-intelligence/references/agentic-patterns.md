# Agentic Patterns — Tool Use, Streaming & MCP

This document describes how the Daemon-AI platform's agentic capabilities work:
the automatic tool execution loop, streaming event format, and the available MCP tools.

---

## How the agentic loop works

When an agent sends a chat request with tool-capable MCP servers enabled, the platform
automatically handles the full tool-execution cycle:

1. The LLM receives the user message + enabled tools
2. If the LLM responds with a `tool_call`, the platform executes it against the MCP server
3. The tool result is added to the messages and the LLM is called again
4. This loop continues until the LLM produces a final `content` response or 10 iterations are reached

You do **not** manage this loop yourself as a client — just send the request and receive the final answer (or stream the intermediate events).

---

## Streaming events

When `"stream": true` is set in the request body, the response is Server-Sent Events (SSE).

**Content-Type:** `text/event-stream`

Each event is:
```
data: <json_payload>\n\n
```

### Event types

| Event type | Description |
|---|---|
| `reasoning` | Chain-of-thought reasoning from extended thinking models |
| `tool_call` | The LLM has decided to call a tool `{ name, arguments }` |
| `tool_result` | Result returned from MCP tool execution `{ name, result }` |
| `content` | A text chunk of the final assistant response |
| `graph_data` | React Flow-compatible nodes/edges from Arkham graph tools |
| `done` | Stream is complete. Contains final `usage` stats |

### Example streaming sequence

```
data: {"type":"tool_call","name":"daemon_intel_get_solana_balance","arguments":{"address":"ABC..."}}

data: {"type":"tool_result","name":"daemon_intel_get_solana_balance","result":{"balance":2.5,"lamports":2500000000}}

data: {"type":"content","delta":"The wallet holds **2.5 SOL**"}

data: {"type":"content","delta":" as of the latest block."}

data: {"type":"done","usage":{"prompt_tokens":312,"completion_tokens":45,"total_tokens":357}}
```

### Consuming streaming in JavaScript

```js
const response = await fetch('https://daemon-ai-production.up.railway.app/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer daemon_<key>',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'openai/gpt-4o',
    messages: [{ role: 'user', content: 'Check my Solana wallet ABC123' }],
    stream: true,
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const lines = decoder.decode(value).split('\n\n');
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const event = JSON.parse(line.slice(6));
    
    if (event.type === 'content') process.stdout.write(event.delta);
    if (event.type === 'tool_call') console.log('Tool called:', event.name);
    if (event.type === 'graph_data') renderGraph(event.nodes, event.edges);
    if (event.type === 'done') console.log('Usage:', event.usage);
  }
}
```

---

## Available MCP tools

Tool names are namespaced as `<server_name>_<tool_name>` to prevent collisions.

### daemon-intel (Blockchain Intelligence)

| Tool name | Description | Key params |
|---|---|---|
| `daemon_intel_get_solana_balance` | SOL balance for a wallet | `address` (base58) |
| `daemon_intel_get_solana_tokens` | SPL token holdings | `address` |
| `daemon_intel_get_solana_transactions` | Recent transactions | `address`, `limit` |
| `daemon_intel_get_eth_balance` | ETH balance | `address` (hex) |
| `daemon_intel_get_eth_transactions` | Ethereum transactions | `address`, `limit` |
| `daemon_intel_get_evm_balance` | Any EVM chain balance | `address`, `chain` |
| `daemon_intel_analyze_with_daemon_agent` | Deep wallet analysis | `address`, `query` |
| `daemon_intel_get_address_label` | Known entity label for address | `address` |

### exa (Web Search)

| Tool name | Description | Key params |
|---|---|---|
| `exa_web_search` | General web search | `query`, `num_results` |
| `exa_code_search` | Code-specific search (GitHub, SO) | `query` |
| `exa_find_companies` | Company intelligence | `query` |

### arkham-analytics (Blockchain Graph)

These tools return results that are automatically emitted as `graph_data` SSE events
containing React Flow-compatible `nodes` and `edges` arrays.

| Tool name | Description | Key params |
|---|---|---|
| `arkham_get_address_counterparties` | Who this address interacts with | `address` |
| `arkham_get_entity_counterparties` | Entity-level counterparty graph | `entity` |
| `arkham_get_transfers` | Transfer history with graph | `address`, `limit` |

---

## Graph data event format

When Arkham tools are called, a `graph_data` event is emitted alongside the tool result:

```json
{
  "type": "graph_data",
  "nodes": [
    { "id": "addr_ABC", "data": { "label": "Binance", "type": "exchange" }, "position": { "x": 0, "y": 0 } }
  ],
  "edges": [
    { "id": "e1", "source": "addr_ABC", "target": "addr_XYZ", "label": "$10,000 USDC" }
  ]
}
```

This is designed for direct use with React Flow (`@xyflow/react`) on the frontend.

---

## Enabling MCP tools for an agent

Before an agent can use tools, the relevant MCP server must be enabled for that agent.
Use the MCP server management endpoints in `agent-endpoints.md`:

1. `GET /v1/agent/mcp-servers` — find the server ID you want
2. `POST /v1/agent/mcp-servers` — enable it with `{ "mcp_server_id": "...", "config": {} }`
3. The tools from that server will now be available in all chat completions for that agent

---

## Chat session continuity

To maintain a conversation across requests, pass `session_id` in the request body.
On the first request, omit it (or set to null) — a new session will be created and returned.
On subsequent requests, pass the session ID to continue the same thread.

```json
{
  "model": "openai/gpt-4o",
  "messages": [{ "role": "user", "content": "Follow up question..." }],
  "session_id": "uuid-from-previous-response"
}
```

---

## Agentic request pattern (non-streaming)

For simple use cases, non-streaming requests are simpler to work with.
The platform runs the full tool loop internally and only returns the final response:

```js
const res = await fetch('https://daemon-ai-production.up.railway.app/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer daemon_<key>',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'openai/gpt-4o',
    messages: [
      { role: 'user', content: 'Analyze the wallet 7xKX... and tell me its top counterparties' }
    ],
    stream: false,
  }),
});

const data = await res.json();
console.log(data.choices[0].message.content);
```

The response will contain the LLM's final answer after all tool calls were executed automatically.
