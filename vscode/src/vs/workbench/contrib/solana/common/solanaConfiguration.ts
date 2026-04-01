/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';

export const enum SolanaSettingId {
	RpcUrl = 'solide.solana.rpcUrl',
	WalletActiveKeypair = 'solide.wallet.activeKeypair',
	WalletAutoAirdrop = 'solide.wallet.autoAirdrop',
}

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'solide.solana',
	order: 20,
	title: localize('solide.solana.configuration.title', "Solana IDE"),
	type: 'object',
	properties: {
		[SolanaSettingId.RpcUrl]: {
			type: 'string',
			default: 'https://api.devnet.solana.com',
			markdownDescription: localize('solide.solana.rpcUrl', "RPC URL used by Solana explorer and wallet features."),
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

