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
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IConfigurationService, ConfigurationTarget } from '../../../../platform/configuration/common/configuration.js';
import { VIEW_CONTAINER } from '../../files/browser/explorerViewlet.js';
import { SolanaWalletCommandId, SOLANA_WALLET_VIEW_ID, SolanaWalletView } from './solanaWalletView.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { ISecretStorageService } from '../../../../platform/secrets/common/secrets.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { SolanaSettingId } from '../../solana/common/solanaConfiguration.js';
import { IStatusbarService, StatusbarAlignment } from '../../../services/statusbar/browser/statusbar.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { Disposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { timeout } from '../../../../base/common/async.js';
import { URI } from '../../../../base/common/uri.js';
import { INativeEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { parseSecretKey, publicKeyToBase58, secretKeyToJson, validateBase58PublicKey } from '../common/solanaKeypair.js';

interface IStoredWallet {
	readonly alias: string;
	readonly publicKey: string;
}

const walletViewIcon = registerIcon('solana-wallet-view-icon', Codicon.key, localize('solana.wallet.icon', "View icon for Solana wallet."));
const WALLET_LIST_STORAGE_KEY = 'solide.wallet.keypairs';

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([{
	id: SOLANA_WALLET_VIEW_ID,
	name: localize2('solana.wallet.view.title', "Solana Wallet"),
	canToggleVisibility: true,
	canMoveView: true,
	ctorDescriptor: new SyncDescriptor(SolanaWalletView),
	order: 3,
	weight: 12,
	containerIcon: walletViewIcon,
	focusCommand: { id: SolanaWalletCommandId.Focus },
}], VIEW_CONTAINER);

function readWallets(storageService: IStorageService): IStoredWallet[] {
	try {
		const value = storageService.get(WALLET_LIST_STORAGE_KEY, StorageScope.APPLICATION);
		if (!value) {
			return [];
		}
		const parsed = JSON.parse(value) as IStoredWallet[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function saveWallets(storageService: IStorageService, wallets: IStoredWallet[]): void {
	storageService.store(WALLET_LIST_STORAGE_KEY, JSON.stringify(wallets), StorageScope.APPLICATION, StorageTarget.USER);
}

async function runTerminalCommand(commandService: ICommandService, value: string): Promise<void> {
	await commandService.executeCommand('workbench.action.terminal.focus');
	await commandService.executeCommand('workbench.action.terminal.sendSequence', { text: `${value}\r` });
}

async function waitForKeypairFile(fileService: IFileService, file: URI): Promise<Uint8Array | undefined> {
	const maxWaitMs = 30_000;
	const pollMs = 250;
	for (let waited = 0; waited < maxWaitMs; waited += pollMs) {
		if (await fileService.exists(file)) {
			try {
				return (await fileService.readFile(file)).value.buffer;
			} catch {
				// Ignore until file is fully written
			}
		}
		await timeout(pollMs);
	}
	return undefined;
}

registerAction2(class extends Action2 {
	constructor() {
		super({ id: SolanaWalletCommandId.Generate, title: localize2('solana.wallet.generate', "Solana: Generate Keypair") });
	}
	override async run(accessor: import('../../../../platform/instantiation/common/instantiation.js').ServicesAccessor): Promise<void> {
		const quickInput = accessor.get(IQuickInputService);
		const storageService = accessor.get(IStorageService);
		const secretStorageService = accessor.get(ISecretStorageService);
		const configurationService = accessor.get(IConfigurationService);
		const notificationService = accessor.get(INotificationService);
		const fileService = accessor.get(IFileService);
		const environmentService = accessor.get(INativeEnvironmentService);
		const commandService = accessor.get(ICommandService);

		const alias = await quickInput.input({ prompt: localize('solana.wallet.alias.prompt', "Alias for the new keypair") });
		if (!alias) {
			return;
		}

		const keypairFile = URI.joinPath(environmentService.tmpDir, `solide-keypair-${Date.now()}.json`);
		await runTerminalCommand(commandService, `solana-keygen new --no-bip39-passphrase --force -o "${keypairFile.fsPath}" --silent`);

		const bytes = await waitForKeypairFile(fileService, keypairFile);
		if (!bytes) {
			notificationService.error(localize('solana.wallet.keygenMissing', "Failed to generate keypair. Ensure `solana-keygen` is installed and try again."));
			return;
		}

		let keypair;
		try {
			const json = new TextDecoder().decode(bytes);
			keypair = parseSecretKey(json);
		} catch (error) {
			notificationService.error(localize('solana.wallet.keygenInvalid', "Generated keypair file was invalid: {0}", error instanceof Error ? error.message : String(error)));
			return;
		} finally {
			try {
				await fileService.del(keypairFile);
			} catch {
				// ignore
			}
		}

		const publicKey = publicKeyToBase58(keypair.publicKeyBytes);
		const secretKey = secretKeyToJson(keypair.secretKeyBytes);

		const wallets = readWallets(storageService).filter(w => w.alias !== alias);
		wallets.push({ alias, publicKey });
		saveWallets(storageService, wallets);
		await secretStorageService.set(`solide.wallet.${alias}`, secretKey);
		await configurationService.updateValue(SolanaSettingId.WalletActiveKeypair, alias, ConfigurationTarget.USER);
		notificationService.notify({ severity: Severity.Info, message: localize('solana.wallet.generated', "Generated keypair '{0}'", alias), source: 'Solana Wallet' });
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({ id: SolanaWalletCommandId.Import, title: localize2('solana.wallet.import', "Solana: Import Keypair") });
	}
	override async run(accessor: import('../../../../platform/instantiation/common/instantiation.js').ServicesAccessor): Promise<void> {
		const quickInput = accessor.get(IQuickInputService);
		const storageService = accessor.get(IStorageService);
		const secretStorageService = accessor.get(ISecretStorageService);
		const configurationService = accessor.get(IConfigurationService);
		const notificationService = accessor.get(INotificationService);
		const alias = await quickInput.input({ prompt: localize('solana.wallet.import.alias', "Alias for imported keypair") });
		if (!alias) {
			return;
		}
		const secretKeyInput = await quickInput.input({ prompt: localize('solana.wallet.import.private', "Paste secret key (Solana JSON array or base58). Stored securely.") });
		if (!secretKeyInput) {
			return;
		}

		let keypair;
		try {
			keypair = parseSecretKey(secretKeyInput);
		} catch (error) {
			notificationService.error(localize('solana.wallet.import.invalid', "Invalid secret key: {0}", error instanceof Error ? error.message : String(error)));
			return;
		}

		const publicKey = publicKeyToBase58(keypair.publicKeyBytes);
		const secretKey = secretKeyToJson(keypair.secretKeyBytes);

		const wallets = readWallets(storageService).filter(w => w.alias !== alias);
		wallets.push({ alias, publicKey });
		saveWallets(storageService, wallets);
		await secretStorageService.set(`solide.wallet.${alias}`, secretKey);
		await configurationService.updateValue(SolanaSettingId.WalletActiveKeypair, alias, ConfigurationTarget.USER);
		notificationService.notify({ severity: Severity.Info, message: localize('solana.wallet.imported', "Imported keypair '{0}'", alias), source: 'Solana Wallet' });
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({ id: SolanaWalletCommandId.CopyAddress, title: localize2('solana.wallet.copyAddress', "Solana: Copy Active Address") });
	}
	override async run(accessor: import('../../../../platform/instantiation/common/instantiation.js').ServicesAccessor): Promise<void> {
		const configurationService = accessor.get(IConfigurationService);
		const storageService = accessor.get(IStorageService);
		const clipboardService = accessor.get(IClipboardService);
		const notificationService = accessor.get(INotificationService);
		const activeAlias = configurationService.getValue<string>(SolanaSettingId.WalletActiveKeypair);
		const wallet = readWallets(storageService).find(w => w.alias === activeAlias);
		if (!wallet) {
			notificationService.warn(localize('solana.wallet.noActive', "No active wallet configured."));
			return;
		}
		try {
			validateBase58PublicKey(wallet.publicKey);
		} catch (error) {
			notificationService.error(localize('solana.wallet.invalidPublicKey', "Active wallet address is invalid: {0}", error instanceof Error ? error.message : String(error)));
			return;
		}
		await clipboardService.writeText(wallet.publicKey);
		notificationService.notify({ severity: Severity.Info, message: localize('solana.wallet.copied', "Copied active wallet address for '{0}'", activeAlias), source: 'Solana Wallet' });
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({ id: SolanaWalletCommandId.Airdrop, title: localize2('solana.wallet.airdrop', "Solana: Request Airdrop") });
	}
	override async run(accessor: import('../../../../platform/instantiation/common/instantiation.js').ServicesAccessor): Promise<void> {
		const configurationService = accessor.get(IConfigurationService);
		const storageService = accessor.get(IStorageService);
		const notificationService = accessor.get(INotificationService);
		const activeAlias = configurationService.getValue<string>(SolanaSettingId.WalletActiveKeypair);
		const wallet = readWallets(storageService).find(w => w.alias === activeAlias);
		if (!wallet) {
			notificationService.warn(localize('solana.wallet.noActive', "No active wallet configured."));
			return;
		}
		try {
			validateBase58PublicKey(wallet.publicKey);
		} catch (error) {
			notificationService.error(localize('solana.wallet.invalidPublicKey', "Active wallet address is invalid: {0}", error instanceof Error ? error.message : String(error)));
			return;
		}

		const rpcUrl = configurationService.getValue<string>(SolanaSettingId.RpcUrl) || 'https://api.devnet.solana.com';
		try {
			const response = await fetch(rpcUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					jsonrpc: '2.0',
					id: 1,
					method: 'requestAirdrop',
					params: [wallet.publicKey, 1000000000],
				})
			});
			if (!response.ok) {
				throw new Error(`RPC error ${response.status}`);
			}
			const json = await response.json() as { result?: unknown; error?: unknown };
			if (json && typeof json === 'object' && 'error' in json && json.error) {
				throw new Error(JSON.stringify(json.error));
			}
			notificationService.notify({ severity: Severity.Info, message: localize('solana.wallet.airdropRequested', "Airdrop requested for '{0}'", wallet.alias), source: 'Solana Wallet' });
		} catch (error) {
			notificationService.error(localize('solana.wallet.airdropError', "Failed to request airdrop: {0}", error instanceof Error ? error.message : String(error)));
		}
	}
});

class SolanaWalletStatusbarContribution extends Disposable {
	static readonly ID = 'workbench.contrib.solanaWalletStatusbar';

	private readonly _entry = this._register(new MutableDisposable());

	constructor(
		@IStatusbarService statusbarService: IStatusbarService,
		@IConfigurationService configurationService: IConfigurationService,
		@IStorageService storageService: IStorageService,
	) {
		super();

		const render = () => {
			const alias = configurationService.getValue<string>(SolanaSettingId.WalletActiveKeypair);
			const wallet = readWallets(storageService).find(w => w.alias === alias);
			const text = wallet ? `$(key) ${alias}` : '$(key) No Wallet';
			this._entry.value = statusbarService.addEntry({
				name: localize('solana.wallet.statusbar.name', "Solana Wallet"),
				text,
				ariaLabel: text,
				tooltip: wallet ? wallet.publicKey : localize('solana.wallet.statusbar.tooltip', "No active wallet configured"),
				command: SolanaWalletCommandId.Focus,
			}, 'status.solana.wallet', StatusbarAlignment.LEFT);
		};

		this._register(configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(SolanaSettingId.WalletActiveKeypair)) {
				render();
			}
		}));
		this._register(storageService.onDidChangeValue(StorageScope.APPLICATION, WALLET_LIST_STORAGE_KEY, this._store)(() => render()));
		render();
	}
}

registerWorkbenchContribution2(SolanaWalletStatusbarContribution.ID, SolanaWalletStatusbarContribution, WorkbenchPhase.BlockRestore);

