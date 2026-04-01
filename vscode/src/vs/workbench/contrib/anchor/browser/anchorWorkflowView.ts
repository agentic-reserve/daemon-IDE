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

export const ANCHOR_WORKFLOW_VIEW_ID = 'workbench.view.anchor.workflow';

export const enum AnchorCommandId {
	Focus = 'solana.anchor.focus',
	Build = 'solana.anchor.build',
	Test = 'solana.anchor.test',
	Deploy = 'solana.anchor.deploy',
	SelectNetwork = 'solana.anchor.selectNetwork',
	NewProject = 'solana.anchor.newProject',
}

export class AnchorWorkflowView extends ViewPane {
	static readonly ID = ANCHOR_WORKFLOW_VIEW_ID;
	static readonly TITLE = localize('solana.anchor.view.title', "Anchor Workflow");

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
		intro.textContent = localize('solana.anchor.view.intro', "Build, test, and deploy Solana programs with Anchor tasks.");

		this._renderSection(root, localize('solana.anchor.view.programs', "Programs"), [
			{ label: localize('solana.anchor.newProject', "New Anchor project"), command: AnchorCommandId.NewProject },
		]);
		this._renderSection(root, localize('solana.anchor.view.tests', "Tests"), [
			{ label: localize('solana.anchor.test', "Run anchor test"), command: AnchorCommandId.Test },
		]);
		this._renderSection(root, localize('solana.anchor.view.network', "Network"), [
			{ label: localize('solana.anchor.selectNetwork', "Select network"), command: AnchorCommandId.SelectNetwork },
		]);
		this._renderSection(root, localize('solana.anchor.view.deploy', "Deploy"), [
			{ label: localize('solana.anchor.build', "Build program"), command: AnchorCommandId.Build },
			{ label: localize('solana.anchor.deploy', "Deploy program"), command: AnchorCommandId.Deploy },
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

