/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';

export const enum SolanaSettingId {
	RpcUrl = 'solide.solana.rpcUrl',
	RpcAllowedEndpoints = 'solide.solana.allowedRpcEndpoints',
	DomainVerificationMode = 'solide.solana.domainVerification.mode',
	DomainVerificationNetwork = 'solide.solana.domainVerification.network',
	WalletActiveKeypair = 'solide.wallet.activeKeypair',
	WalletAutoAirdrop = 'solide.wallet.autoAirdrop',
}

const DEFAULT_RPC_ALLOWLIST = [
	'https://api.devnet.solana.com',
	'https://api.testnet.solana.com',
	'https://mainnet.helius-rpc.com',
	'https://rpc.helius.xyz',
	'https://solana-mainnet.rpc.extrnode.com',
	'https://solana-api.projectserum.com',
	'https://api.mainnet-beta.solana.com',
];

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'solide.solana',
	order: 20,
	title: localize('solide.solana.configuration.title', "Solana IDE"),
	type: 'object',
	properties: {
		[SolanaSettingId.RpcUrl]: {
			type: 'string',
			default: 'https://api.devnet.solana.com',
			markdownDescription: localize('solide.solana.rpcUrl', "RPC URL used by Solana explorer and wallet features. **WARNING**: Malicious RPC endpoints can return false data. Only use trusted endpoints."),
		},
		[SolanaSettingId.RpcAllowedEndpoints]: {
			type: 'array',
			items: { type: 'string' },
			default: DEFAULT_RPC_ALLOWLIST,
			markdownDescription: localize('solide.solana.allowedRpcEndpoints', "Approved RPC endpoints. When non-empty, warnings will be shown for untrusted RPC URLs. Examples: `https://api.mainnet-beta.solana.com`, `https://mainnet.helius-rpc.com`"),
		},
		[SolanaSettingId.DomainVerificationMode]: {
			type: 'string',
			enum: ['strict', 'compat', 'minimal'],
			default: 'compat',
			markdownDescription: localize('solide.solana.domainVerification.mode', "Verification mode for domain-to-address association checks."),
		},
		[SolanaSettingId.DomainVerificationNetwork]: {
			type: 'string',
			default: 'mainnet',
			markdownDescription: localize('solide.solana.domainVerification.network', "Default network qualifier used by domain verification checks."),
		},
		[SolanaSettingId.WalletActiveKeypair]: {
			type: 'string',
			default: '',
			markdownDescription: localize('solide.wallet.activeKeypair', "Alias of the active Solana keypair."),
		},
		[SolanaSettingId.WalletAutoAirdrop]: {
			type: 'boolean',
			default: false,
			markdownDescription: localize('solide.wallet.autoAirdrop', "Automatically request a devnet airdrop when a wallet has low balance."),
		},
	}
});

export function isRpcUrlAllowed(rpcUrl: string, allowedEndpoints: string[]): boolean {
	if (allowedEndpoints.length === 0) {
		return true;
	}
	return allowedEndpoints.some(endpoint => {
		try {
			const allowed = new URL(endpoint);
			const current = new URL(rpcUrl);
			return allowed.hostname === current.hostname;
		} catch {
			return false;
		}
	});
}

export function isHttpsRpc(rpcUrl: string): boolean {
	try {
		const url = new URL(rpcUrl);
		return url.protocol === 'https:';
	} catch {
		return false;
	}
}

