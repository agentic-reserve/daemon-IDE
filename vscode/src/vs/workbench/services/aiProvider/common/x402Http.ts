/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class X402PaymentRequiredError extends Error {
	readonly status = 402;

	constructor(
		message: string,
		readonly readonlyHeaders: Record<string, string>,
		readonly bodyText: string,
	) {
		super(message);
	}
}

export async function fetchWithX402Readiness(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
	const response = await fetch(input, init);
	if (response.status !== 402) {
		return response;
	}

	const headers: Record<string, string> = {};
	response.headers.forEach((value, key) => headers[key.toLowerCase()] = value);
	const bodyText = await response.text();

	throw new X402PaymentRequiredError('Payment required (x402)', headers, bodyText);
}

