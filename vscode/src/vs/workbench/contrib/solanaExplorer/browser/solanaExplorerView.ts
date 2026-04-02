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

export const SOLANA_EXPLORER_VIEW_ID = 'workbench.view.solana.explorer';

export const enum SolanaExplorerCommandId {
	Focus = 'solana.explorer.focus',
	LookupAccount = 'solana.explorer.lookupAccount',
	LookupTransaction = 'solana.explorer.lookupTransaction',
	LookupProgram = 'solana.explorer.lookupProgram',
	LookupToken = 'solana.explorer.lookupToken',
	VerifyDomainAssociation = 'solana.explorer.verifyDomainAssociation',
}

export class SolanaExplorerView extends ViewPane {
	static readonly ID = SOLANA_EXPLORER_VIEW_ID;
	static readonly TITLE = localize('solana.explorer.view.title', "Solana Explorer");

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
		intro.textContent = localize('solana.explorer.view.intro', "Inspect accounts, transactions, programs, and token mints.");

		this._renderSection(root, localize('solana.explorer.accounts', "Accounts"), [
			{ label: localize('solana.explorer.lookupAccount', "Lookup account"), command: SolanaExplorerCommandId.LookupAccount },
		]);
		this._renderSection(root, localize('solana.explorer.transactions', "Transactions"), [
			{ label: localize('solana.explorer.lookupTransaction', "Lookup transaction"), command: SolanaExplorerCommandId.LookupTransaction },
		]);
		this._renderSection(root, localize('solana.explorer.programs', "Programs"), [
			{ label: localize('solana.explorer.lookupProgram', "Inspect program"), command: SolanaExplorerCommandId.LookupProgram },
		]);
		this._renderSection(root, localize('solana.explorer.tokens', "Tokens"), [
			{ label: localize('solana.explorer.lookupToken', "Inspect token mint"), command: SolanaExplorerCommandId.LookupToken },
		]);
		this._renderSection(root, localize('solana.explorer.domainVerification', "Domain Verification"), [
			{ label: localize('solana.explorer.verifyDomainAssociation', "Verify domain association"), command: SolanaExplorerCommandId.VerifyDomainAssociation },
		]);
	}

	private _renderSection(container: HTMLElement, title: string, actions: Array<{ label: string; command: string }>): void {
		const section = dom.append(container, dom.$('.solide-view__section'));
		const titleElement = dom.append(section, dom.$('h3.solide-view__title'));
		titleElement.textContent = title;

		for (const action of actions) {
			const button = dom.append(section, dom.$('button'));
			button.className = 'monaco-button solide-view__button';
			button.textContent = action.label;
			this._register(dom.addDisposableListener(button, dom.EventType.CLICK, () => this.commandService.executeCommand(action.command)));
		}
	}
}

