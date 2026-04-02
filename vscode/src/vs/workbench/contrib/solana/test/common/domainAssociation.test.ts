/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DomainAssociationMode, DomainAssociationRecordType, isValidSolanaAddress, verifyDomainAssociation } from '../../common/domainAssociation.js';

const TEST_PK = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const OTHER_PK = 'SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu';

suite('DomainAssociation verification fixtures', () => {
	const originalFetch = globalThis.fetch;

	teardown(() => {
		globalThis.fetch = originalFetch;
	});

	test('strict mode match', async () => {
		globalThis.fetch = (async (input: string | URL | Request) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
			if (url.includes('dns.google/resolve')) {
				return makeJsonResponse({
					Answer: [{ data: `"solana-address=${TEST_PK} network=mainnet"` }]
				});
			}
			return makeTextResponse('', 404);
		}) as typeof fetch;

		const result = await verifyDomainAssociation('example.com', TEST_PK, {
			mode: DomainAssociationMode.Strict,
			network: 'mainnet',
			recordType: DomainAssociationRecordType.Address,
		});

		assert.strictEqual(result.matched, true);
		assert.strictEqual(result.denied, false);
	});

	test('compat mode deny', async () => {
		globalThis.fetch = (async (input: string | URL | Request) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
			if (url.includes('.well-known/solana.txt')) {
				return makeTextResponse(`solana-address=${TEST_PK} deny=1`);
			}
			return makeJsonResponse({});
		}) as typeof fetch;

		const result = await verifyDomainAssociation('example.com', TEST_PK, {
			mode: DomainAssociationMode.Compat,
			network: 'mainnet',
			recordType: DomainAssociationRecordType.Address,
		});

		assert.strictEqual(result.matched, false);
		assert.strictEqual(result.denied, true);
	});

	test('no match case', async () => {
		globalThis.fetch = (async (input: string | URL | Request) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
			if (url.includes('dns.google/resolve')) {
				return makeJsonResponse({ Answer: [{ data: `"solana-address=${OTHER_PK}"` }] });
			}
			return makeTextResponse('', 404);
		}) as typeof fetch;

		const result = await verifyDomainAssociation('example.com', TEST_PK, {
			mode: DomainAssociationMode.Strict,
			network: 'mainnet',
			recordType: DomainAssociationRecordType.Address,
		});

		assert.strictEqual(result.matched, false);
		assert.strictEqual(result.denied, false);
	});

	test('invalid address is rejected before fetch', async () => {
		let called = false;
		globalThis.fetch = (async () => {
			called = true;
			return makeJsonResponse({});
		}) as typeof fetch;

		const result = await verifyDomainAssociation('example.com', 'not-a-valid-address', {
			mode: DomainAssociationMode.Strict,
			network: 'mainnet',
		});

		assert.strictEqual(called, false);
		assert.strictEqual(result.matched, false);
		assert.ok(result.reason.includes('Invalid Solana address'));
	});

	test('isValidSolanaAddress', () => {
		assert.strictEqual(isValidSolanaAddress(TEST_PK), true);
		assert.strictEqual(isValidSolanaAddress('abc'), false);
		assert.strictEqual(isValidSolanaAddress(''), false);
	});
});

function makeJsonResponse(body: unknown, status = 200): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
		text: async () => JSON.stringify(body),
	} as Response;
}

function makeTextResponse(body: string, status = 200): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		text: async () => body,
		json: async () => JSON.parse(body),
	} as Response;
}
