#!/usr/bin/env bash
# Devnet drill for emergency abort stub (sbpf-asm-abort).
# Does not deploy by default — prints the checklist and optional commands.
# Upstream: https://github.com/deanmlittle/sbpf-asm-abort
set -euo pipefail

echo "=== sbpf-asm-abort devnet drill (checklist) ==="
echo ""
echo "Prerequisites:"
echo "  - solana CLI: https://docs.solanalabs.com/cli/install"
echo "  - sbpf CLI: cargo install --git https://github.com/blueshift-gg/sbpf.git"
echo "  - funded devnet keypair (not committed): solana config set --url https://api.devnet.solana.com"
echo ""
echo "1) Clone and build upstream:"
echo "     git clone https://github.com/deanmlittle/sbpf-asm-abort.git"
echo "     cd sbpf-asm-abort && sbpf build"
echo ""
echo "2) Create or reuse an UPGRADEABLE program on devnet (separate from production)."
echo "   Note the program id keypair and upgrade authority."
echo ""
echo "3) Deploy the stub over that program id (example — adjust paths):"
echo "     solana program deploy deploy/sbpf-asm-abort.so \\"
echo "       --program-id /path/to/program-keypair.json \\"
echo "       --upgrade-authority /path/to/upgrade-authority.json"
echo ""
echo "4) Verify: send a transaction that invokes the program — it should fail until you redeploy a fixed .so."
echo ""
echo "5) Recover: deploy your real program binary again to the same program id."
echo ""
if command -v solana >/dev/null 2>&1; then
  echo "Current solana CLI: $(command -v solana)"
  solana --version || true
  echo "Current cluster (if configured):"
  solana config get || true
else
  echo "solana CLI not found in PATH."
fi
