/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { base58Encode, base58Decode } from '../../common/base58.js';
import {
	publicKeyToBase58,
	secretKeyToJson,
	parseSecretKey,
	keypairFromSecretKeyBytes,
	validateBase58PublicKey,
} from '../../common/solanaKeypair.js';

suite('Base58 encoding/decoding', () => {

	test('encode/decode roundtrip for various lengths', () => {
		const lengths = [1, 16, 32, 64, 128, 256];
		for (const len of lengths) {
			const bytes = new Uint8Array(len);
			crypto.getRandomValues(bytes);
			const encoded = base58Encode(bytes);
			const decoded = base58Decode(encoded);
			assert.strictEqual(decoded.length, len, `Length mismatch for ${len} bytes`);
			assert.ok(decoded.every((v, i) => v === bytes[i]), `Content mismatch for ${len} bytes`);
		}
	});

	test('encode empty array returns empty string', () => {
		assert.strictEqual(base58Encode(new Uint8Array(0)), '');
	});

	test('decode empty string returns empty array', () => {
		const result = base58Decode('');
		assert.strictEqual(result.length, 0);
	});

	test('decode with whitespace is trimmed', () => {
		const original = new Uint8Array([1, 2, 3]);
		const encoded = base58Encode(original);
		const decoded = base58Decode(`  ${encoded}  `);
		assert.strictEqual(decoded.length, 3);
		assert.ok(decoded.every((v, i) => v === original[i]));
	});

	test('encode leading zeroes preserved', () => {
		const bytes = new Uint8Array([0, 0, 1, 2, 3]);
		const encoded = base58Encode(bytes);
		assert.strictEqual(encoded.startsWith('11'), true);
	});

	test('decode leading ones create zeroes', () => {
		const encoded = '11123Ab';
		const decoded = base58Decode(encoded);
		assert.strictEqual(decoded[0], 0);
		assert.strictEqual(decoded[1], 0);
		assert.strictEqual(decoded[2], 0);
	});

	test('decode invalid character throws', () => {
		assert.throws(() => base58Decode('abc0xyz'), /Invalid base58 character/);
	});

	test('decode ambiguous I/l/0 throws', () => {
		assert.throws(() => base58Decode('I'), /Invalid base58 character/);
		assert.throws(() => base58Decode('l'), /Invalid base58 character/);
		assert.throws(() => base58Decode('0'), /Invalid base58 character/);
	});

	test('known test vectors', () => {
		assert.strictEqual(base58Decode('2'), '102'.charCodeAt(0) === 102 ? undefined : new Uint8Array([0]));
	});

	test('very long input handled correctly', () => {
		const longBytes = new Uint8Array(1000);
		longBytes[0] = 0xff;
		longBytes[999] = 0xff;
		const encoded = base58Encode(longBytes);
		const decoded = base58Decode(encoded);
		assert.strictEqual(decoded.length, 1000);
		assert.strictEqual(decoded[0], 0xff);
		assert.strictEqual(decoded[999], 0xff);
	});

	test('all valid base58 alphabet characters', () => {
		const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
		const decoded = base58Decode(alphabet);
		assert.strictEqual(decoded.length > 0, true);
	});
});

suite('Public key operations', () => {

	test('publicKeyToBase58 valid 32-byte key', () => {
		const bytes = new Uint8Array(32);
		bytes[0] = 0x01;
		bytes[31] = 0xff;
		const result = publicKeyToBase58(bytes);
		assert.strictEqual(typeof result, 'string');
		assert.ok(result.length > 0);
	});

	test('publicKeyToBase58 rejects wrong length', () => {
		const bytes31 = new Uint8Array(31);
		assert.throws(() => publicKeyToBase58(bytes31), /Invalid public key length/);

		const bytes33 = new Uint8Array(33);
		assert.throws(() => publicKeyToBase58(bytes33), /Invalid public key length/);
	});

	test('validateBase58PublicKey accepts valid key', () => {
		const validKey = '2e1dmVEiNAB2rMYcwCxMgYgCYDqt66NXm5cZw77gQxP4';
		assert.doesNotThrow(() => validateBase58PublicKey(validKey));
	});

	test('validateBase58PublicKey rejects wrong length', () => {
		const shortKey = '2e1dmVEiNAB2rMYcwCxMg';
		assert.throws(() => validateBase58PublicKey(shortKey), /Invalid public key length/);

		const longKey = '2e1dmVEiNAB2rMYcwCxMgYgCYDqt66NXm5cZw77gQxP42e1dmVEiNAB2rMYcwCxMgYgCYDqt66NXm5cZw77gQxP4';
		assert.throws(() => validateBase58PublicKey(longKey), /Invalid public key length/);
	});

	test('validateBase58PublicKey rejects invalid characters', () => {
		const invalidKey = '0IlOabc123'; // 0, I, l, O not allowed
		assert.throws(() => validateBase58PublicKey(invalidKey), /Invalid base58 character/);
	});
});

suite('Secret key operations', () => {

	test('keypairFromSecretKeyBytes valid 64-byte key', () => {
		const secretKey = new Uint8Array(64);
		crypto.getRandomValues(secretKey);
		const keypair = keypairFromSecretKeyBytes(secretKey);

		assert.strictEqual(keypair.secretKeyBytes.length, 64);
		assert.strictEqual(keypair.publicKeyBytes.length, 32);
		assert.ok(keypair.publicKeyBytes.every((v, i) => v === secretKey[32 + i]));
	});

	test('keypairFromSecretKeyBytes rejects wrong length', () => {
		const bytes63 = new Uint8Array(63);
		assert.throws(() => keypairFromSecretKeyBytes(bytes63), /Expected 64 bytes/);

		const bytes65 = new Uint8Array(65);
		assert.throws(() => keypairFromSecretKeyBytes(bytes65), /Expected 64 bytes/);
	});

	test('secretKeyToJson produces valid JSON array', () => {
		const bytes = new Uint8Array([1, 2, 3, 255, 0]);
		const json = secretKeyToJson(bytes);
		const parsed = JSON.parse(json);
		assert.deepStrictEqual(parsed, [1, 2, 3, 255, 0]);
	});

	test('parseSecretKey from JSON array', () => {
		const secretKey = new Uint8Array(64);
		crypto.getRandomValues(secretKey);
		const json = JSON.stringify(Array.from(secretKey));
		const keypair = parseSecretKey(json);

		assert.strictEqual(keypair.secretKeyBytes.length, 64);
		assert.strictEqual(keypair.publicKeyBytes.length, 32);
	});

	test('parseSecretKey from base58', () => {
		const secretKey = new Uint8Array(64);
		crypto.getRandomValues(secretKey);
		const encoded = base58Encode(secretKey);
		const keypair = parseSecretKey(encoded);

		assert.strictEqual(keypair.secretKeyBytes.length, 64);
		assert.strictEqual(keypair.publicKeyBytes.length, 32);
	});

	test('parseSecretKey rejects empty input', () => {
		assert.throws(() => parseSecretKey(''), /Empty secret key/);
		assert.throws(() => parseSecretKey('   '), /Empty secret key/);
	});

	test('parseSecretKey rejects invalid JSON array', () => {
		assert.throws(() => parseSecretKey('not-json'), /JSON/);
		assert.throws(() => parseSecretKey('{}'), /Invalid JSON secret key/);
		assert.throws(() => parseSecretKey('[1,2,3]'), /Expected 64 bytes/);
	});

	test('parseSecretKey rejects JSON with invalid bytes', () => {
		assert.throws(() => parseSecretKey('[-1, 0, 1]'), /Invalid byte/);
		assert.throws(() => parseSecretKey('[256, 0, 1]'), /Invalid byte/);
		assert.throws(() => parseSecretKey('[1.5, 0, 1]'), /Invalid byte/);
		assert.throws(() => parseSecretKey('["a", 0, 1]'), /Invalid byte/);
		assert.throws(() => parseSecretKey('[Infinity, 0, 1]'), /Invalid byte/);
		assert.throws(() => parseSecretKey('[NaN, 0, 1]'), /Invalid byte/);
	});

	test('parseSecretKey rejects base58 with invalid characters', () => {
		assert.throws(() => parseSecretKey('abc0xyz'), /Invalid base58 character/);
	});

	test('parseSecretKey trims whitespace', () => {
		const secretKey = new Uint8Array(64);
		crypto.getRandomValues(secretKey);
		const json = JSON.stringify(Array.from(secretKey));
		const keypair = parseSecretKey(`  ${json}  `);
		assert.strictEqual(keypair.secretKeyBytes.length, 64);
	});
});

suite('Security edge cases', () => {

	test('Very large JSON array rejected', () => {
		const largeArray = new Array(10000).fill(1);
		assert.throws(() => parseSecretKey(JSON.stringify(largeArray)), /Expected 64 bytes/);
	});

	test('Deeply nested JSON rejected', () => {
		let obj: unknown = [1];
		for (let i = 0; i < 100; i++) {
			obj = [obj];
		}
		assert.throws(() => parseSecretKey(JSON.stringify(obj)), /Invalid JSON secret key/);
	});

	test('Unicode in JSON is handled', () => {
		const bytes = new Uint8Array(64);
		bytes[0] = 0xf0;
		bytes[1] = 0x9f;
		bytes[2] = 0x98;
		bytes[3] = 0x80;
		const json = JSON.stringify(Array.from(bytes));
		const keypair = parseSecretKey(json);
		assert.strictEqual(keypair.secretKeyBytes.length, 64);
	});

	test('Control characters in base58 rejected', () => {
		assert.throws(() => base58Decode('abc\ndef'), /Invalid base58 character/);
		assert.throws(() => base58Decode('abc\tdef'), /Invalid base58 character/);
	});

	test('All-zero secret key is valid', () => {
		const zeroKey = new Uint8Array(64);
		const keypair = keypairFromSecretKeyBytes(zeroKey);
		assert.strictEqual(keypair.secretKeyBytes.length, 64);
		assert.strictEqual(keypair.publicKeyBytes.length, 32);
	});

	test('All-255 secret key is valid', () => {
		const maxKey = new Uint8Array(64);
		maxKey.fill(255);
		const keypair = keypairFromSecretKeyBytes(maxKey);
		assert.strictEqual(keypair.secretKeyBytes.length, 64);
		assert.strictEqual(keypair.publicKeyBytes.length, 32);
	});

	test('JSON array with floats truncated', () => {
		const json = '[1.9, 2.1, 3.9]';
		assert.throws(() => parseSecretKey(json), /Invalid byte/);
	});
});
