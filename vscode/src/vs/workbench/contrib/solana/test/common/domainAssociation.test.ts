/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DomainAssociationMode, DomainAssociationRecordType, verifyDomainAssociation } from '../../common/domainAssociation.js';

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
					Answer: [{ data: '"solana-address=abc network=mainnet"' }]
				});
			}
			return makeTextResponse('', 404);
		}) as typeof fetch;

		const result = await verifyDomainAssociation('example.com', 'abc', {
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
				return makeTextResponse('solana-address=abc deny=1');
			}
			return makeJsonResponse({});
		}) as typeof fetch;

		const result = await verifyDomainAssociation('example.com', 'abc', {
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
				return makeJsonResponse({ Answer: [{ data: '"solana-address=zzz"' }] });
			}
			return makeTextResponse('', 404);
		}) as typeof fetch;

		const result = await verifyDomainAssociation('example.com', 'abc', {
			mode: DomainAssociationMode.Strict,
			network: 'mainnet',
			recordType: DomainAssociationRecordType.Address,
		});

		assert.strictEqual(result.matched, false);
		assert.strictEqual(result.denied, false);
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
