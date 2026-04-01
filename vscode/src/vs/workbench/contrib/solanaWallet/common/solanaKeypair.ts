/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { base58Decode, base58Encode } from './base58.js';

export interface ISolanaKeypair {
	readonly publicKeyBytes: Uint8Array;   // 32 bytes
	readonly secretKeyBytes: Uint8Array;   // 64 bytes (ed25519)
}

export function publicKeyToBase58(publicKeyBytes: Uint8Array): string {
	if (publicKeyBytes.length !== 32) {
		throw new Error(`Invalid public key length ${publicKeyBytes.length}`);
	}
	return base58Encode(publicKeyBytes);
}

export function secretKeyToJson(secretKeyBytes: Uint8Array): string {
	return JSON.stringify(Array.from(secretKeyBytes));
}

export function parseSecretKey(input: string): ISolanaKeypair {
	const trimmed = input.trim();
	if (!trimmed) {
		throw new Error('Empty secret key');
	}

	// Solana CLI keypair file: JSON array of 64 numbers
	if (trimmed.startsWith('[')) {
		const parsed = JSON.parse(trimmed) as unknown;
		if (!Array.isArray(parsed)) {
			throw new Error('Invalid JSON secret key');
		}
		const bytes = Uint8Array.from(parsed.map(v => {
			if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 255) {
				throw new Error('Invalid byte in JSON secret key');
			}
			return v;
		}));
		return keypairFromSecretKeyBytes(bytes);
	}

	// Base58-encoded 64-byte secret key
	const decoded = base58Decode(trimmed);
	return keypairFromSecretKeyBytes(decoded);
}

export function keypairFromSecretKeyBytes(secretKeyBytes: Uint8Array): ISolanaKeypair {
	if (secretKeyBytes.length !== 64) {
		throw new Error(`Expected 64 bytes secret key, got ${secretKeyBytes.length}`);
	}
	const publicKeyBytes = secretKeyBytes.slice(32, 64);
	if (publicKeyBytes.length !== 32) {
		throw new Error('Invalid secret key payload');
	}
	return { publicKeyBytes, secretKeyBytes };
}

export function validateBase58PublicKey(publicKey: string): void {
	const bytes = base58Decode(publicKey);
	if (bytes.length !== 32) {
		throw new Error(`Invalid public key length ${bytes.length}`);
	}
}

