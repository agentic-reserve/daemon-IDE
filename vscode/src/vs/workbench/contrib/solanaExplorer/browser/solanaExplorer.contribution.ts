/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Extensions as ViewExtensions, IViewsRegistry } from '../../../common/views.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { SolanaSettingId } from '../../solana/common/solanaConfiguration.js';
import { VIEW_CONTAINER } from '../../files/browser/explorerViewlet.js';
import { SolanaExplorerCommandId, SolanaExplorerView, SOLANA_EXPLORER_VIEW_ID } from './solanaExplorerView.js';

const explorerIcon = registerIcon('solana-explorer-view-icon', Codicon.globe, localize('solana.explorer.icon', "View icon for Solana explorer."));

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([{
	id: SOLANA_EXPLORER_VIEW_ID,
	name: localize2('solana.explorer.view.title', "Solana Explorer"),
	canToggleVisibility: true,
	canMoveView: true,
	ctorDescriptor: new SyncDescriptor(SolanaExplorerView),
	order: 2,
	weight: 11,
	containerIcon: explorerIcon,
	focusCommand: { id: SolanaExplorerCommandId.Focus },
}], VIEW_CONTAINER);

async function rpcCall(configurationService: IConfigurationService, method: string, params: unknown[]): Promise<unknown> {
	const rpcUrl = configurationService.getValue<string>(SolanaSettingId.RpcUrl) || 'https://api.devnet.solana.com';
	const response = await fetch(rpcUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
	});
	if (!response.ok) {
		throw new Error(`RPC request failed (${response.status})`);
	}
	return response.json();
}

registerAction2(class extends Action2 {
	constructor() {
		super({ id: SolanaExplorerCommandId.LookupAccount, title: localize2('solana.explorer.lookupAccount', "Solana: Lookup Account") });
	}
	override async run(accessor: import('../../../../platform/instantiation/common/instantiation.js').ServicesAccessor): Promise<void> {
		const quickInput = accessor.get(IQuickInputService);
		const notificationService = accessor.get(INotificationService);
		const configurationService = accessor.get(IConfigurationService);
		const address = await quickInput.input({ prompt: localize('solana.explorer.account.prompt', "Enter account address") });
		if (!address) {
			return;
		}
		try {
			const result = await rpcCall(configurationService, 'getAccountInfo', [address, { encoding: 'base64' }]);
			notificationService.notify({ severity: Severity.Info, message: localize('solana.explorer.account.success', "Account lookup completed for {0}", address), source: 'Solana Explorer' });
			console.debug('[SolanaExplorer] getAccountInfo', result);
		} catch (error) {
			notificationService.error(localize('solana.explorer.account.error', "Failed to lookup account: {0}", error instanceof Error ? error.message : String(error)));
		}
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({ id: SolanaExplorerCommandId.LookupTransaction, title: localize2('solana.explorer.lookupTransaction', "Solana: Lookup Transaction") });
	}
	override async run(accessor: import('../../../../platform/instantiation/common/instantiation.js').ServicesAccessor): Promise<void> {
		const quickInput = accessor.get(IQuickInputService);
		const notificationService = accessor.get(INotificationService);
		const configurationService = accessor.get(IConfigurationService);
		const signature = await quickInput.input({ prompt: localize('solana.explorer.tx.prompt', "Enter transaction signature") });
		if (!signature) {
			return;
		}
		try {
			const result = await rpcCall(configurationService, 'getTransaction', [signature, { maxSupportedTransactionVersion: 0 }]);
			notificationService.notify({ severity: Severity.Info, message: localize('solana.explorer.tx.success', "Transaction lookup completed for {0}", signature), source: 'Solana Explorer' });
			console.debug('[SolanaExplorer] getTransaction', result);
		} catch (error) {
			notificationService.error(localize('solana.explorer.tx.error', "Failed to lookup transaction: {0}", error instanceof Error ? error.message : String(error)));
		}
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({ id: SolanaExplorerCommandId.LookupProgram, title: localize2('solana.explorer.lookupProgram', "Solana: Inspect Program") });
	}
	override async run(accessor: import('../../../../platform/instantiation/common/instantiation.js').ServicesAccessor): Promise<void> {
		const quickInput = accessor.get(IQuickInputService);
		const commandService = accessor.get(ICommandService);
		const programId = await quickInput.input({ prompt: localize('solana.explorer.program.prompt', "Enter program ID") });
		if (!programId) {
			return;
		}
		await commandService.executeCommand('simpleBrowser.show', `https://explorer.solana.com/address/${encodeURIComponent(programId)}?cluster=devnet`);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({ id: SolanaExplorerCommandId.LookupToken, title: localize2('solana.explorer.lookupToken', "Solana: Inspect Token Mint") });
	}
	override async run(accessor: import('../../../../platform/instantiation/common/instantiation.js').ServicesAccessor): Promise<void> {
		const quickInput = accessor.get(IQuickInputService);
		const commandService = accessor.get(ICommandService);
		const mint = await quickInput.input({ prompt: localize('solana.explorer.token.prompt', "Enter token mint address") });
		if (!mint) {
			return;
		}
		await commandService.executeCommand('simpleBrowser.show', `https://explorer.solana.com/address/${encodeURIComponent(mint)}?cluster=devnet`);
	}
});

