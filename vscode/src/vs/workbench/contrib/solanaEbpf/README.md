# Solana eBPF Decompiler Setup

This workspace ships Solana eBPF decompile commands in ARGUS IDE.

## Prerequisites

- A local Ghidra installation
- `support/analyzeHeadless` available under your Ghidra install directory
- `Solana-eBPF-for-Ghidra/` folder present next to the `vscode/` directory

## First-time setup

1. Run `Solana: Configure Ghidra` from the Command Palette.
2. Enter the absolute path to the Ghidra install root (for example `/Applications/ghidra_11.4_PUBLIC`).
3. Run `Solana: Install Solana eBPF Ghidra Module`.
4. In Ghidra, install the generated extension zip from `Solana-eBPF-for-Ghidra/dist`.

## Decompile workflow

1. Run `Solana: Decompile eBPF Program (.so)`.
2. Provide an absolute path to your `.so` binary.
3. ARGUS IDE runs headless import and analysis, then writes output to `decompile.c`.
4. Use `Solana: Open eBPF Decompiler Output Folder` to revisit the latest output.

## Troubleshooting

- **"Ghidra install dir is not configured"**
  - Run `Solana: Configure Ghidra`.
- **"Invalid Ghidra install dir"**
  - Ensure `<ghidraInstallDir>/support/analyzeHeadless` exists and points to your Ghidra root.
- **"Missing Solana-eBPF-for-Ghidra folder"**
  - Launch ARGUS IDE from this repository root so the sibling module path resolves.
