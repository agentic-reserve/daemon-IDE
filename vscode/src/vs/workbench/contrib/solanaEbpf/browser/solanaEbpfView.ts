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

export const SOLANA_EBPF_VIEW_ID = 'workbench.view.solana.ebpf';

export const enum SolanaEbpfCommandId {
	Focus = 'solana.ebpf.focus',
	ConfigureGhidra = 'solana.ebpf.configureGhidra',
	InstallProcessorModule = 'solana.ebpf.installProcessorModule',
	DecompileProgram = 'solana.ebpf.decompileProgram',
	OpenReport = 'solana.ebpf.openReport',
}

export class SolanaEbpfView extends ViewPane {
	static readonly ID = SOLANA_EBPF_VIEW_ID;
	static readonly TITLE = localize('solana.ebpf.view.title', "eBPF Decompiler");

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
		intro.textContent = localize('solana.ebpf.view.intro', "Decompile Solana program binaries (.so) with Ghidra using the Solana eBPF processor module.");

		this._renderSection(root, localize('solana.ebpf.view.setup', "Setup"), [
			{ label: localize('solana.ebpf.configure', "Configure Ghidra install path"), command: SolanaEbpfCommandId.ConfigureGhidra },
			{ label: localize('solana.ebpf.install', "Build & install Solana eBPF module into Ghidra"), command: SolanaEbpfCommandId.InstallProcessorModule },
		]);

		this._renderSection(root, localize('solana.ebpf.view.actions', "Actions"), [
			{ label: localize('solana.ebpf.decompile', "Decompile a program (.so)"), command: SolanaEbpfCommandId.DecompileProgram },
			{ label: localize('solana.ebpf.openReport', "Open last output folder"), command: SolanaEbpfCommandId.OpenReport },
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

