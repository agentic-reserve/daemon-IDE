/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const enum DomainAssociationMode {
	Strict = 'strict',
	Compat = 'compat',
	Minimal = 'minimal',
}

export const enum DomainAssociationRecordType {
	Program = 'program',
	Mint = 'mint',
	Address = 'address',
}

export const enum DomainAssociationSource {
	DnsTxt = 'dns_txt',
	WellKnown = 'well_known',
}

export interface DomainAssociationVerificationOptions {
	mode: DomainAssociationMode;
	network: string;
	recordType?: DomainAssociationRecordType;
}

export interface DomainAssociationVerificationResult {
	domain: string;
	address: string;
	recordType?: DomainAssociationRecordType;
	network: string;
	mode: DomainAssociationMode;
	source: DomainAssociationSource[];
	matched: boolean;
	denied: boolean;
	reason: string;
	warnings: string[];
	recordsConsidered: number;
}

interface ParsedRecord {
	source: DomainAssociationSource;
	raw: string;
	recordType?: DomainAssociationRecordType;
	address?: string;
	network?: string;
	allow?: boolean;
	deny?: boolean;
	denyAll: boolean;
}

interface DnsResolveResult {
	Answer?: Array<{ data?: string }>;
}

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** True if `address` decodes to exactly 32 bytes (typical Solana public key). */
export function isValidSolanaAddress(address: string): boolean {
	const t = address.trim();
	if (!t) {
		return false;
	}
	try {
		return decodeBase58(t).length === 32;
	} catch {
		return false;
	}
}

function decodeBase58(str: string): Uint8Array {
	const bytes: number[] = [0];
	for (let i = 0; i < str.length; i++) {
		const value = BASE58_ALPHABET.indexOf(str[i]);
		if (value < 0) {
			throw new Error('invalid base58 character');
		}
		let carry = value;
		for (let j = 0; j < bytes.length; j++) {
			carry += bytes[j] * 58;
			bytes[j] = carry & 0xff;
			carry >>= 8;
		}
		while (carry > 0) {
			bytes.push(carry & 0xff);
			carry >>= 8;
		}
	}
	for (let k = 0; k < str.length && str[k] === '1'; k++) {
		bytes.push(0);
	}
	return Uint8Array.from(bytes.reverse());
}

export async function verifyDomainAssociation(
	domain: string,
	address: string,
	options: DomainAssociationVerificationOptions,
): Promise<DomainAssociationVerificationResult> {
	const trimmed = address.trim();
	if (!isValidSolanaAddress(trimmed)) {
		return {
			domain,
			address: trimmed,
			recordType: options.recordType,
			network: options.network,
			mode: options.mode,
			source: [],
			matched: false,
			denied: false,
			reason: 'Invalid Solana address: expected base58-encoded 32-byte public key',
			warnings: [],
			recordsConsidered: 0,
		};
	}

	const warnings: string[] = [];
	const strictFirst = options.mode === DomainAssociationMode.Strict;
	const source = new Set<DomainAssociationSource>();

	const dnsRecords = await fetchDnsTxt(domain, warnings);
	const wellKnownRecords = await fetchWellKnown(domain, warnings);
	const records = [...dnsRecords, ...wellKnownRecords];
	const parsed: ParsedRecord[] = [];

	for (const rec of records) {
		const strictRecord = parseStrictRecord(rec.source, rec.value);
		if (strictRecord) {
			parsed.push(strictRecord);
			source.add(rec.source);
			continue;
		}

		if (!strictFirst) {
			parsed.push(parseCompatRecord(rec.source, rec.value));
			source.add(rec.source);
		}
	}

	const verdict = evaluate(parsed, domain, trimmed, options, warnings);
	return {
		...verdict,
		source: Array.from(source.values()),
	};
}

function evaluate(
	records: ParsedRecord[],
	domain: string,
	address: string,
	options: DomainAssociationVerificationOptions,
	warnings: string[],
): Omit<DomainAssociationVerificationResult, 'source'> {
	let matched = false;
	let denied = false;
	let sawAddressMatch = false;
	let sawDenyAll = false;

	for (const record of records) {
		if (record.denyAll) {
			sawDenyAll = true;
			continue;
		}

		if (!record.address) {
			if (options.mode === DomainAssociationMode.Minimal && isValidSolanaAddress(address) && record.raw.includes(address)) {
				matched = true;
			}
			continue;
		}

		if (record.address.toLowerCase() !== address.toLowerCase()) {
			continue;
		}

		sawAddressMatch = true;

		if (options.recordType && record.recordType !== options.recordType) {
			continue;
		}

		if (!matchesNetwork(options.network, record.network)) {
			continue;
		}

		const explicitlyDenied = record.deny === true || record.allow === false;
		if (explicitlyDenied) {
			denied = true;
		} else {
			matched = true;
		}
	}

	if (sawDenyAll) {
		denied = true;
		matched = false;
	}

	if (records.length === 0) {
		warnings.push('No association records discovered in DNS TXT or well-known file.');
	}

	const reason = denied
		? 'Association denied by record'
		: matched
			? 'Association matched'
			: sawAddressMatch
				? 'No eligible allow record matched network/tag filters'
				: 'No matching association record found';

	return {
		domain,
		address,
		recordType: options.recordType,
		network: options.network,
		mode: options.mode,
		matched,
		denied,
		reason,
		warnings,
		recordsConsidered: records.length,
	};
}

function matchesNetwork(expected: string, recordNetwork?: string): boolean {
	const normalizedExpected = expected.toLowerCase();
	if (!recordNetwork) {
		return normalizedExpected === 'mainnet';
	}

	return recordNetwork.toLowerCase() === normalizedExpected;
}

function parseStrictRecord(source: DomainAssociationSource, value: string): ParsedRecord | undefined {
	const tokens = value.trim().split(/\s+/g).filter(Boolean);
	if (tokens.length === 0) {
		return undefined;
	}

	let recordType: DomainAssociationRecordType | undefined;
	let address: string | undefined;
	let allow: boolean | undefined;
	let deny: boolean | undefined;
	let network: string | undefined;
	let denyAll = false;

	for (const token of tokens) {
		const parts = token.split('=');
		if (parts.length !== 2) {
			return undefined;
		}

		const key = parts[0];
		const rawValue = parts[1].replace(/^['"]|['"]$/g, '');

		switch (key) {
			case 'solana-program-address':
				recordType = DomainAssociationRecordType.Program;
				address = rawValue;
				break;
			case 'solana-mint-address':
				recordType = DomainAssociationRecordType.Mint;
				address = rawValue;
				break;
			case 'solana-address':
				if (rawValue.toLowerCase() === 'denyall') {
					denyAll = true;
				} else {
					recordType = DomainAssociationRecordType.Address;
					address = rawValue;
				}
				break;
			case 'allow':
				allow = parseBool(rawValue);
				break;
			case 'deny':
				deny = parseBool(rawValue);
				break;
			case 'network':
				network = rawValue;
				break;
			default:
				break;
		}
	}

	if (!address && !denyAll) {
		return undefined;
	}

	return { source, raw: value, recordType, address, allow, deny, network, denyAll };
}

function parseCompatRecord(source: DomainAssociationSource, value: string): ParsedRecord {
	const recordType = value.includes('solana-program-address')
		? DomainAssociationRecordType.Program
		: value.includes('solana-mint-address')
			? DomainAssociationRecordType.Mint
			: value.includes('solana-address')
				? DomainAssociationRecordType.Address
				: undefined;

	return {
		source,
		raw: value,
		recordType,
		address: extractValue(value, 'solana-address') ?? extractValue(value, 'solana-program-address') ?? extractValue(value, 'solana-mint-address'),
		allow: parseBool(extractValue(value, 'allow') ?? ''),
		deny: parseBool(extractValue(value, 'deny') ?? ''),
		network: extractValue(value, 'network'),
		denyAll: value.includes('solana-address=denyall'),
	};
}

function extractValue(value: string, key: string): string | undefined {
	const needle = `${key}=`;
	const index = value.indexOf(needle);
	if (index === -1) {
		return undefined;
	}

	const after = value.slice(index + needle.length);
	const extracted = after.split(/\s+/g)[0].replace(/^['"]|['"]$/g, '').replace(/,+$/g, '');
	return extracted || undefined;
}

function parseBool(value: string): boolean | undefined {
	const normalized = value.toLowerCase();
	if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'allow') {
		return true;
	}
	if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'deny') {
		return false;
	}
	return undefined;
}

async function fetchDnsTxt(domain: string, warnings: string[]): Promise<Array<{ source: DomainAssociationSource; value: string }>> {
	const records: Array<{ source: DomainAssociationSource; value: string }> = [];
	try {
		const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=TXT`);
		if (!response.ok) {
			warnings.push(`DNS TXT lookup failed (${response.status}).`);
			return records;
		}

		const payload = await response.json() as DnsResolveResult;
		for (const answer of payload.Answer ?? []) {
			const raw = answer.data ?? '';
			const decoded = decodeTxtAnswer(raw);
			if (decoded) {
				records.push({ source: DomainAssociationSource.DnsTxt, value: decoded });
			}
		}
	} catch (error) {
		warnings.push(`DNS TXT lookup failed: ${error instanceof Error ? error.message : String(error)}`);
	}

	return records;
}

function decodeTxtAnswer(raw: string): string {
	const matches = raw.match(/"([^"]*)"/g);
	if (!matches) {
		return raw.replace(/^['"]|['"]$/g, '');
	}

	return matches.map(m => m.slice(1, -1)).join('');
}

async function fetchWellKnown(domain: string, warnings: string[]): Promise<Array<{ source: DomainAssociationSource; value: string }>> {
	const records: Array<{ source: DomainAssociationSource; value: string }> = [];
	try {
		const response = await fetch(`https://${domain}/.well-known/solana.txt`);
		if (!response.ok) {
			return records;
		}

		const body = await response.text();
		for (const line of body.split(/\r?\n/g)) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) {
				continue;
			}
			records.push({ source: DomainAssociationSource.WellKnown, value: trimmed });
		}
	} catch (error) {
		warnings.push(`Well-known lookup failed: ${error instanceof Error ? error.message : String(error)}`);
	}

	return records;
}
