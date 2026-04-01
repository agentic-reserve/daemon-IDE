/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const ALPHABET_MAP = new Map<string, number>(Array.from(ALPHABET).map((c, i) => [c, i]));

export function base58Encode(bytes: Uint8Array): string {
	if (bytes.length === 0) {
		return '';
	}

	let zeroes = 0;
	while (zeroes < bytes.length && bytes[zeroes] === 0) {
		zeroes++;
	}

	// Convert base256 -> base58 using "long division" on a mutable copy.
	const input = new Uint8Array(bytes);
	const encoded: number[] = [];
	let startAt = zeroes;

	while (startAt < input.length) {
		let remainder = 0;
		for (let i = startAt; i < input.length; i++) {
			const value = (remainder << 8) | input[i];
			input[i] = Math.floor(value / 58);
			remainder = value % 58;
		}

		encoded.push(remainder);
		while (startAt < input.length && input[startAt] === 0) {
			startAt++;
		}
	}

	let result = '1'.repeat(zeroes);
	for (let i = encoded.length - 1; i >= 0; i--) {
		result += ALPHABET[encoded[i]];
	}

	return result;
}

export function base58Decode(value: string): Uint8Array {
	const trimmed = value.trim();
	if (!trimmed) {
		return new Uint8Array();
	}

	let zeroes = 0;
	while (zeroes < trimmed.length && trimmed[zeroes] === '1') {
		zeroes++;
	}

	const bytes: number[] = [];
	for (let i = zeroes; i < trimmed.length; i++) {
		const char = trimmed[i];
		const digit = ALPHABET_MAP.get(char);
		if (digit === undefined) {
			throw new Error(`Invalid base58 character '${char}'`);
		}

		let carry = digit;
		for (let j = 0; j < bytes.length; j++) {
			const x = bytes[j] * 58 + carry;
			bytes[j] = x & 0xff;
			carry = x >> 8;
		}
		while (carry > 0) {
			bytes.push(carry & 0xff);
			carry >>= 8;
		}
	}

	const out = new Uint8Array(zeroes + bytes.length);
	out.fill(0, 0, zeroes);
	for (let i = 0; i < bytes.length; i++) {
		out[out.length - 1 - i] = bytes[i];
	}
	return out;
}

