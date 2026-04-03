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
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { SolanaSettingId, isRpcUrlAllowed, isHttpsRpc } from '../../solana/common/solanaConfiguration.js';
import { DomainAssociationMode, DomainAssociationRecordType, isValidSolanaAddress, verifyDomainAssociation } from '../../solana/common/domainAssociation.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IUntitledTextEditorService } from '../../../services/untitled/common/untitledTextEditorService.js';
import { UntitledTextEditorInput } from '../../../services/untitled/common/untitledTextEditorInput.js';
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

async function rpcCall(configurationService: IConfigurationService, notificationService: INotificationService, method: string, params: unknown[]): Promise<unknown> {
	const rpcUrl = configurationService.getValue<string>(SolanaSettingId.RpcUrl) || 'https://api.devnet.solana.com';

	if (!isRpcUrlAllowed(configurationService, rpcUrl)) {
		notificationService.notify({
			severity: Severity.Warning,
			message: localize('solana.explorer.rpc.untrusted', "Security Warning: This RPC endpoint ({0}) is not in your allowed list. Configure 'Solana: Allowed RPC Endpoints' to restrict endpoints.", rpcUrl),
			source: 'Solana Explorer',
		});
	}

	if (!isHttpsRpc(rpcUrl)) {
		notificationService.notify({
			severity: Severity.Warning,
			message: localize('solana.explorer.rpc.insecure', "Security Warning: This RPC endpoint ({0}) is not using HTTPS. Your data may be intercepted.", rpcUrl),
			source: 'Solana Explorer',
		});
	}

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

function clusterQueryFromRpcUrl(rpcUrl: string): string {
	const u = rpcUrl.toLowerCase();
	if (u.includes('mainnet') && !u.includes('devnet')) {
		return 'mainnet-beta';
	}
	if (u.includes('testnet')) {
		return 'testnet';
	}
	return 'devnet';
}

async function openSolanaResultEditor(accessor: import('../../../../platform/instantiation/common/instantiation.js').ServicesAccessor, data: unknown): Promise<void> {
	const instantiationService = accessor.get(IInstantiationService);
	const untitledTextEditorService = accessor.get(IUntitledTextEditorService);
	const editorService = accessor.get(IEditorService);
	const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
	const model = untitledTextEditorService.create({ initialValue: text, languageId: 'json' });
	const input = instantiationService.createInstance(UntitledTextEditorInput, model);
	await editorService.openEditor(input, { pinned: true });
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
			const result = await rpcCall(configurationService, notificationService, 'getAccountInfo', [address, { encoding: 'base64' }]);
			notificationService.notify({ severity: Severity.Info, message: localize('solana.explorer.account.success', "Account lookup completed for {0}", address), source: 'Solana Explorer' });
			await openSolanaResultEditor(accessor, result);
		} catch (error) {
			notificationService.error(localize('solana.explorer.account.error', "Failed to lookup account: {0}", error instanceof Error ? error.message : String(error)));
		}
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({ id: SolanaExplorerCommandId.VerifyDomainAssociation, title: localize2('solana.explorer.verifyDomainAssociation.command', "Solana: Verify Domain Association") });
	}
	override async run(accessor: import('../../../../platform/instantiation/common/instantiation.js').ServicesAccessor): Promise<void> {
		const quickInput = accessor.get(IQuickInputService);
		const notificationService = accessor.get(INotificationService);
		const configurationService = accessor.get(IConfigurationService);

		const domain = await quickInput.input({ prompt: localize('solana.explorer.verify.domain.prompt', "Enter domain (for example, example.com)") });
		if (!domain) {
			return;
		}

		const address = await quickInput.input({ prompt: localize('solana.explorer.verify.address.prompt', "Enter Solana address") });
		if (!address) {
			return;
		}
		if (!isValidSolanaAddress(address)) {
			notificationService.error(localize('solana.explorer.verify.invalidAddress', "Enter a valid Solana address (base58, 32-byte public key)."));
			return;
		}

		const selectedType = await quickInput.pick([
			{ id: 'any', label: localize('solana.explorer.verify.type.any', "Any type") },
			{ id: DomainAssociationRecordType.Address, label: localize('solana.explorer.verify.type.address', "Wallet address") },
			{ id: DomainAssociationRecordType.Program, label: localize('solana.explorer.verify.type.program', "Program address") },
			{ id: DomainAssociationRecordType.Mint, label: localize('solana.explorer.verify.type.mint', "Mint address") },
		], { placeHolder: localize('solana.explorer.verify.type.placeholder', "Select expected association type") });
		if (!selectedType) {
			return;
		}

		const mode = configurationService.getValue<DomainAssociationMode>(SolanaSettingId.DomainVerificationMode) ?? DomainAssociationMode.Compat;
		const network = configurationService.getValue<string>(SolanaSettingId.DomainVerificationNetwork) ?? 'mainnet';

		try {
			const result = await verifyDomainAssociation(domain.trim(), address.trim(), {
				mode,
				network,
				recordType: selectedType.id === 'any' ? undefined : selectedType.id as DomainAssociationRecordType,
			});

			const reason = `${result.reason} (mode=${result.mode}, network=${result.network}, records=${result.recordsConsidered})`;
			if (result.matched && !result.denied) {
				notificationService.notify({
					severity: Severity.Info,
					message: localize('solana.explorer.verify.success', "Domain association matched for {0}: {1}", result.domain, reason),
					source: 'Solana Explorer',
				});
			} else {
				notificationService.notify({
					severity: Severity.Warning,
					message: localize('solana.explorer.verify.noMatch', "Domain association did not match for {0}: {1}", result.domain, reason),
					source: 'Solana Explorer',
				});
			}

			if (result.warnings.length) {
				notificationService.notify({
					severity: Severity.Warning,
					message: localize('solana.explorer.verify.warnings', "Domain verification warnings: {0}", result.warnings.join(' | ')),
					source: 'Solana Explorer',
				});
			}

			await openSolanaResultEditor(accessor, result);
		} catch (error) {
			notificationService.error(localize('solana.explorer.verify.error', "Failed to verify domain association: {0}", error instanceof Error ? error.message : String(error)));
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
			const result = await rpcCall(configurationService, notificationService, 'getTransaction', [signature, { maxSupportedTransactionVersion: 0 }]);
			notificationService.notify({ severity: Severity.Info, message: localize('solana.explorer.tx.success', "Transaction lookup completed for {0}", signature), source: 'Solana Explorer' });
			await openSolanaResultEditor(accessor, result);
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
		const configurationService = accessor.get(IConfigurationService);
		const programId = await quickInput.input({ prompt: localize('solana.explorer.program.prompt', "Enter program ID") });
		if (!programId) {
			return;
		}
		const rpcUrl = configurationService.getValue<string>(SolanaSettingId.RpcUrl) || 'https://api.devnet.solana.com';
		const cluster = clusterQueryFromRpcUrl(rpcUrl);
		await commandService.executeCommand('simpleBrowser.show', `https://explorer.solana.com/address/${encodeURIComponent(programId)}?cluster=${encodeURIComponent(cluster)}`);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({ id: SolanaExplorerCommandId.LookupToken, title: localize2('solana.explorer.lookupToken', "Solana: Inspect Token Mint") });
	}
	override async run(accessor: import('../../../../platform/instantiation/common/instantiation.js').ServicesAccessor): Promise<void> {
		const quickInput = accessor.get(IQuickInputService);
		const commandService = accessor.get(ICommandService);
		const configurationService = accessor.get(IConfigurationService);
		const mint = await quickInput.input({ prompt: localize('solana.explorer.token.prompt', "Enter token mint address") });
		if (!mint) {
			return;
		}
		const rpcUrl = configurationService.getValue<string>(SolanaSettingId.RpcUrl) || 'https://api.devnet.solana.com';
		const cluster = clusterQueryFromRpcUrl(rpcUrl);
		await commandService.executeCommand('simpleBrowser.show', `https://explorer.solana.com/address/${encodeURIComponent(mint)}?cluster=${encodeURIComponent(cluster)}`);
	}
});

