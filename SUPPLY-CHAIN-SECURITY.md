# Supply Chain Security Policy for daemon-IDE

## Overview

This document outlines supply chain security requirements for daemon-IDE development. Given the Solana ecosystem's history of supply chain attacks (notably @solana/web3.js compromises and Glassworm campaign), rigorous dependency management is essential.

## Threat Context

### Known Attack Vectors

| Attack | Target | Impact |
|--------|--------|--------|
| **Drift Protocol hack** (April 2026) | Admin keys via durable nonces | $286M stolen, DPRK linked |
| **@solana/web3.js compromise** (Dec 2024) | npm account phishing | Private key exfiltration, $160K+ stolen |
| **Glassworm campaign** | React Native packages | Multi-stage malware via Solana C2 |
| **Axios npm supply chain** (April 2026) | npm maintainer | DPRK-linked, Google attributed |
| **Fake audit/job offers** | Developers | Credential harvesting |
| **Signing utility compromise** | Off-chain signers | Silent key exfiltration |

### Why Solana Tooling Is High-Risk

- Signing utilities are **trusted choke-points** - every transaction passes through them
- Immutability of on-chain programs doesn't protect off-chain tooling
- Solana accepts any valid signature, whether from legitimate owner or attacker with stolen key
- **DPRK has stolen $6.5B+ in crypto** - they actively target developers and protocols

---

## Dependency Management Requirements

### 1. Version Pinning (Critical for Signing/Crypto)

**Rule: Never use `^` or `~` for critical dependencies**

```toml
# ❌ DANGEROUS - allows automatic upgrades
solana-sdk = "^1.18"
solana-sign-utils = "~0.1"

# ✅ SAFE - exact version lock
solana-sdk = "=1.18.3"
solana-sign-utils = "=0.1.0"
```

### 2. Cargo.lock Commitment

- Commit `Cargo.lock` to version control
- Review changes before merging
- Never use `--locked` flag in CI (hides lockfile changes)

### 3. Vendor Critical Dependencies

For signing utilities and cryptographic code:

```bash
cargo vendor --versioned-dirs ./vendor
```

Build in isolated environments using vendored code.

---

## CI/CD Security Requirements

### Dependency Scanning

Add to CI pipeline:

```yaml
# GitHub Actions example
- name: Audit Rust dependencies
  run: |
    cargo install cargo-audit
    cargo audit

- name: Scan npm dependencies
  run: |
    npm audit --audit-level=high
    # Or use Socket.dev API
    npx @socketsecurity/npm
```

### Package Verification

```bash
# Verify package integrity
shasum -a 256 package.tar.gz
gh api repos/:owner/:repo/actions/secrets/public-key
```

---

## Development Workflow Security

### 1. Audit Requests - Verify First

Before reviewing any repository for "audit" requests:

1. **Verify the requestor** - Check social media, official channels
2. **Clone in isolation** - Use VM or container
3. **Scan before install** - `npm audit`, `cargo audit`
4. **No credentials in test env** - Never have real keys in dev

### 2. IDE Security Practices

When using daemon-IDE:

1. **Never paste secret keys into chat** - Use wallet UI instead
2. **Verify RPC endpoints** - Check URL before transactions
3. **Review tool permissions** - Approve only necessary tools
4. **Use devnet for testing** - Mainnet requires extra verification
5. **Hardware wallets for production** - Never store admin keys in software wallets
6. **Verify all transaction details** - Especially for multi-sig or delegated transactions

### 2a. DPRK Social Engineering Awareness

DPRK actors actively target Solana developers. Red flags:

- **Unsolicited audit requests** - Verify through official channels
- **Fake job offers** - Often from LinkedIn with too-good-to-be-true offers
- **GitHub collaborations** - From accounts with low activity or copied profiles
- **Zoom/Telegram calls** - Attackers use video calls to build trust
- **Never run code** from untrusted sources, even "for review"
- **Isolate audit environments** - Use VM/container, no real keys

Recent incidents:
- [Fortune: DPRK targeted reporter via Telegram](https://fortune.com/2026/04/02/north-korea-dprk-zoom-phishing-social-engineering-attack-telegram/)
- [Elliptic: Drift Protocol $286M hack](https://www.elliptic.co/blog/drift-protocol-exploited-for-286-million-in-suspected-dprk-linked-attack)

### 3. Postinstall Script Auditing

Review all `postinstall`, `preinstall`, `prepare` scripts:

```bash
# Extract and review npm scripts
npm show <package> scripts
npm pack <package> --dry-run
```

Red flags:
- Base64-encoded scripts
- Network calls in install hooks
- Obfuscated JavaScript
- Solana RPC interactions

---

## Monitoring and Response

### 1. Dependency Monitoring

- Subscribe to GitHub Advisories for critical packages
- Use [Socket.dev](https://socket.dev) for npm monitoring
- Set up alerts for unusual package publishes

### 2. Incident Response

If compromise is suspected:

1. **Revoke affected credentials immediately**
2. **Audit logs for suspicious activity**
3. **Rotate all keys** - Assume all were compromised
4. **Report to package registry** (npm, crates.io)

---

## References

- [Sonatype: Hijacked npm packages (Glassworm)](https://www.sonatype.com/blog/hijacked-npm-packages-deliver-malware-via-solana-linked-to-glassworm)
- [Adevar Labs: Supply Chain Attacks in Solana](https://www.adevarlabs.com/blog/supply-chain-attacks-in-the-solana-ecosystem)
- [Socket.dev: @solana/web3.js Attack Analysis](https://socket.dev/blog/supply-chain-attack-solana-web3-js-library)
- [CISA: Software Supply Chain Security](https://www.cisa.gov/software-supply-chain-security)

---

## Quick Reference Checklist

- [ ] Dependencies pinned with exact versions (`=x.y.z`)
- [ ] Cargo.lock committed and reviewed
- [ ] CI runs `cargo audit` and `npm audit`
- [ ] Postinstall scripts reviewed before npm install
- [ ] No real keys in development environment
- [ ] Devnet used for testing by default
- [ ] 2FA enabled on npm/crates.io accounts
