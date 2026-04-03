# Public Endpoints — No Auth Required

Base URL: `https://daemon-ai-production.up.railway.app`

---

## Health Check

```
GET /health
```

Pings Supabase and OpenRouter to confirm all dependencies are up.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-17T00:00:00Z",
  "dependencies": {
    "database": "ok",
    "openrouter": "ok"
  }
}
```

---

## Auth: Register

```
POST /v1/auth/register
```

Create a new user account. Rate-limited to **1 registration per IP per 24 hours**.
On success, sends a verification email. The account is not usable until email is verified.

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "min8chars",
  "wallet_address": "optional_solana_base58_address",
  "name": "optional display name"
}
```

**Response (202):**
```json
{
  "success": true,
  "message": "Verification email sent",
  "status": "pending_verification"
}
```

---

## Auth: Verify Email (POST — from app/API)

```
POST /v1/auth/verify-email
```

Verifies the email token received in the verification email. Creates a session and agent on success.

**Request body:**
```json
{ "token": "<token_from_email_link>" }
```

**Response (200):**
```json
{
  "success": true,
  "session_token": "<hex_session_token>",
  "agent": { "id": "...", "name": "..." },
  "api_key": "daemon_<plaintext_key>"
}
```

The `api_key` is returned **once** at verification. Store it immediately.

---

## Auth: Verify Email (GET — browser deep link)

```
GET /v1/auth/verify-email?token=<token>
```

Browser-friendly version — same logic, but returns an HTML page with a deep-link:

```
daemonai://verified?email=<user@example.com>
```

Used for mobile app email verification flows.

---

## Auth: Wallet Nonce

```
GET /v1/auth/wallet/nonce?wallet=<base58_address>
```

Returns a one-time nonce for Solana wallet-based authentication.
The nonce expires in **5 minutes**.

**Response:**
```json
{
  "success": true,
  "nonce": "daemon_auth_<uuid>",
  "expires_at": "2026-03-17T00:05:00Z"
}
```

---

## Auth: Login

```
POST /v1/auth/login
```

Supports two login methods:

### Method 1: Email + Password
```json
{
  "email": "user@example.com",
  "password": "yourpassword"
}
```

### Method 2: Solana Wallet Signature
```json
{
  "wallet_address": "base58_solana_address",
  "signature": "base58_ed25519_signature",
  "nonce": "daemon_auth_<uuid>"
}
```

The signature must be an Ed25519 signature of the nonce string using the wallet's private key.

**Response (200):**
```json
{
  "success": true,
  "session_token": "<hex_session_token>",
  "agent": {
    "id": "uuid",
    "name": "My Agent",
    "default_model": "openai/gpt-4o"
  },
  "api_key": "daemon_<plaintext_key>"
}
```

`api_key` is only included on **first login** after email verification. On subsequent logins it is omitted.

---

## Billing: Payment Webhook

```
POST /v1/billing/webhook
```

Receives USDC payment confirmation from x402/Kora. Verified via HMAC-SHA256 signature.

This endpoint is for the payment infrastructure only — typically not called by client apps directly.

**Headers required:**
```
x-kora-signature: <hmac_sha256_hex>
```

**Behavior:**
- Idempotent — duplicate `tx_signature` values are silently ignored
- Atomically credits the agent's USDC balance on success

---

## Notes

- All endpoints return `Content-Type: application/json` unless otherwise noted
- The email verification GET endpoint returns `Content-Type: text/html`
- Errors follow the standard format: `{ "success": false, "error": "...", "code": "..." }`
