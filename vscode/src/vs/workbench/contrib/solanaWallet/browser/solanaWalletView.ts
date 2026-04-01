/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/solideView.css';

import * as dom from '../../../../base/browser/dom.js';
import { localize } from '../../../../nls.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IViewletViewOptions } from '../../../browser/parts/views/viewsViewlet.js';
import { ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';

export const SOLANA_WALLET_VIEW_ID = 'workbench.view.solana.wallet';

export const enum SolanaWalletCommandId {
	Focus = 'solana.wallet.focus',
	Generate = 'solana.wallet.generate',
	Import = 'solana.wallet.import',
	Airdrop = 'solana.wallet.airdrop',
	CopyAddress = 'solana.wallet.copyAddress',
}

export class SolanaWalletView extends ViewPane {
	static readonly ID = SOLANA_WALLET_VIEW_ID;
	static readonly TITLE = localize('solana.wallet.view.title', "Solana Wallet");

	constructor(
		options: IViewletViewOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		const root = dom.append(container, dom.$('.solide-view'));
		const intro = dom.append(root, dom.$('p.solide-view__intro'));
		intro.textContent = localize('solana.wallet.view.intro', "Manage keypairs, copy addresses, and request devnet/localnet airdrops.");

		this._renderButton(root, localize('solana.wallet.generate', "Generate keypair"), SolanaWalletCommandId.Generate);
		this._renderButton(root, localize('solana.wallet.import', "Import keypair"), SolanaWalletCommandId.Import);
		this._renderButton(root, localize('solana.wallet.copyAddress', "Copy active address"), SolanaWalletCommandId.CopyAddress);
		this._renderButton(root, localize('solana.wallet.airdrop', "Request airdrop"), SolanaWalletCommandId.Airdrop);
	}

	private _renderButton(container: HTMLElement, label: string, command: string): void {
		const button = dom.append(container, dom.$('button'));
		button.className = 'monaco-button solide-view__button';
		button.textContent = label;
		this._register(dom.addDisposableListener(button, dom.EventType.CLICK, () => this.commandService.executeCommand(command)));
	}
}

