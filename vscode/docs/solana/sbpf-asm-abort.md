# sbpf-asm-abort — emergency program stub (reference)

This note summarizes how to build and deploy the upstream **[sbpf-asm-abort](https://github.com/deanmlittle/sbpf-asm-abort)** project and how it fits a Solana **upgradable** program workflow in ARES IDE. It is **not** a substitute for reading the upstream README and [sRFC](https://forum.solana.com/t/srfc-35-address-domain-association-specification/3155)-style domain claims; it is operational tooling context only.

## What it is

- A tiny (~352 byte) **sBPF assembly** program that **returns a non-success** path so **invokes fail** until the program is replaced again.
- Intended for **emergency “circuit breaker”** behavior on **program-upgradeable** deployments: you swap the on-chain program buffer to this stub so **no successful transaction** can invoke your program until you ship a fix.
- Built with the **[sbpf](https://github.com/deanmlittle/sbpf)** scaffold ecosystem; the **CLI installer** referenced in the upstream **sbpf** README is:

  ```sh
  cargo install --git https://github.com/blueshift-gg/sbpf.git
  ```

  Then run `sbpf help` for `build`, `deploy`, `test`, and `e2e`.

## (A) Build and deploy — upstream workflow

### 1. Clone

```sh
git clone https://github.com/deanmlittle/sbpf-asm-abort.git
cd sbpf-asm-abort
```

### 2. Build

From the project root (after `sbpf` is on your `PATH`):

```sh
sbpf build
```

This should produce deploy artifacts under `deploy/` (for example `deploy/sbpf-asm-abort.so`). Upstream may also ship Rust tests using **Mollusk** (`cargo test`); tests may expect files under `deploy/` such as a built `.so` and optionally a keypair — see upstream `src/lib.rs` and `.gitignore` for what is generated locally vs committed.

### 3. Deploy (single-transaction path)

Use the **Solana CLI** with the same **program id** as your existing **upgradeable** program and your **upgrade authority**:

```sh
solana program deploy deploy/sbpf-asm-abort.so \
  --program-id /path/to/your-program-keypair.json \
  --upgrade-authority /path/to/upgrade-authority.json
```

Exact flags depend on your Solana CLI version and whether you use buffer-based upgrades; the intent is: **replace the program’s executable with the stub** so all invocations fail until you deploy a proper `.so` again.

Alternatively, from the **sbpf** toolchain:

```sh
sbpf deploy
```

…if your local `sbpf` project is configured for deploy (see `sbpf deploy --help`).

### 4. Recover

Deploy your **fixed** program **to the same program id** again using the same upgrade authority, replacing the stub.

## (B) Reference in this repo

- This file: `vscode/docs/solana/sbpf-asm-abort.md`
- Related Solana tooling in-tree: `vscode/src/vs/workbench/contrib/solanaEbpf/README.md` (eBPF / Ghidra — complementary to on-chain deploy, not the same as `sbpf` deploy).

## (C) Integration sketch for your deploy workflow

1. **Preparation (non-emergency)**  
   - Document program id, upgrade authority path, and cluster (`mainnet-beta` / `devnet` / `testnet`).  
   - Keep **offline** or **hardware** backup of upgrade authority where policy allows.

2. **Build artifact**  
   - CI or local: `sbpf build` in a pinned clone of `sbpf-asm-abort` (commit SHA in lockfile or comment).  
   - Store `deploy/*.so` as a **release artifact** labeled `emergency-abort` with checksum.

3. **Emergency runbook**  
   - Confirm cluster and program id.  
   - Run `solana program deploy …` (or `sbpf deploy`) with the stub `.so`.  
   - Verify: transactions that invoke the program **fail** as expected.  
   - Communicate outage; deploy fixed binary when ready.

4. **ARES IDE**  
   - Use the integrated terminal from the workspace root; run Solana CLI commands **against the correct RPC** (`solana config set --url …`).  
   - Optional: add a **task** in `.vscode/tasks.json` that runs `sbpf build` in a sibling repo path (do not commit secrets or keypair paths).

5. **Complementary trust (optional)**  
   - For **domain ↔ address** association signals, use the IDE’s **sRFC-35** verification flow (CLI `verify-domain` / Solana Explorer action) — see implementation in the codebase; that does **not** prove bytecode correctness, only DNS/well-known association per [sRFC-35](https://forum.solana.com/t/srfc-35-address-domain-association-specification/3155).

## Security notes

- Treat **upgrade authority** as **critical**: anyone who controls it can replace the program, including with this stub or with malicious code.  
- This stub is **not** a cryptographic proof that source matches on-chain; use **verified builds** and audits for that.  
- Enable **DNSSEC** and follow sRFC-35 guidance for association records if you rely on DNS for branding checks.

## Upstream links

- [deanmlittle/sbpf-asm-abort](https://github.com/deanmlittle/sbpf-asm-abort)  
- [sbpf scaffold / CLI](https://github.com/deanmlittle/sbpf) (see also [blueshift-gg/sbpf](https://github.com/blueshift-gg/sbpf) for `cargo install` in upstream docs)

## Devnet drill (safe rehearsal)

Use **devnet** and a **throwaway** upgradeable program — never rehearse on production keys.

1. Point the CLI at devnet: `solana config set --url https://api.devnet.solana.com` (or your RPC).
2. Build `sbpf-asm-abort` as in section **(A)**.
3. Deploy the stub against your **test** program id with your **test** upgrade authority.
4. Confirm invocations fail; then redeploy your normal `.so` to the same program id.

A printable checklist lives at: `scripts/solana/sbpf-devnet-drill.sh` (run: `bash scripts/solana/sbpf-devnet-drill.sh`).

## Operational runbook (keep private)

Store **outside the git repo** (password manager, internal wiki, or encrypted doc):

- Program id(s) and cluster(s).
- Paths or references to upgrade authority (hardware wallet, multisig, cold key) — **not** the key material itself in git.
- Checksum of the approved emergency `*.so` artifact.
- Who may authorize deploy of the stub vs. the fixed build.
- Post-incident steps and communications template.

CI for verifier-related changes: `.github/workflows/ares-solana-ci.yml` (Rust unit tests + TS compile check).
