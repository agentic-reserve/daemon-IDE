/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { timeout } from '../../../../base/common/async.js';
import { URI } from '../../../../base/common/uri.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Extensions as ViewExtensions, IViewsRegistry } from '../../../common/views.js';
import { AnchorWorkflowView, AnchorCommandId, ANCHOR_WORKFLOW_VIEW_ID } from './anchorWorkflowView.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { INativeEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { VIEW_CONTAINER } from '../../files/browser/explorerViewlet.js';

const anchorViewIcon = registerIcon('solana-anchor-view-icon', Codicon.symbolClass, localize('solana.anchor.view.icon', "View icon for the Anchor workflow panel."));

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([{
	id: ANCHOR_WORKFLOW_VIEW_ID,
	name: localize2('solana.anchor.view.title', "Anchor Workflow"),
	canToggleVisibility: true,
	canMoveView: true,
	ctorDescriptor: new SyncDescriptor(AnchorWorkflowView),
	order: 2,
	weight: 10,
	focusCommand: { id: AnchorCommandId.Focus },
	containerIcon: anchorViewIcon,
}], VIEW_CONTAINER);

function sanitizeShellArg(value: string): string {
	return value.replace(/'/g, "'\\''");
}

function escapeShellArg(value: string): string {
	return `'${sanitizeShellArg(value)}'`;
}

async function runAnchorTerminalCommand(commandService: ICommandService, value: string): Promise<void> {
	await commandService.executeCommand('workbench.action.terminal.focus');
	await commandService.executeCommand('workbench.action.terminal.sendSequence', { text: `${value}\r` });
}

async function pickUniqueFolderName(fileService: IFileService, baseFolder: URI, desiredName: string): Promise<string> {
	let name = desiredName;
	let counter = 2;
	while (await fileService.exists(URI.joinPath(baseFolder, name))) {
		name = `${desiredName}-${counter++}`;
	}
	return name;
}

async function waitForAnchorProject(fileService: IFileService, folder: URI): Promise<boolean> {
	const anchorToml = URI.joinPath(folder, 'Anchor.toml');
	const maxWaitMs = 90_000;
	const pollMs = 500;

	for (let waited = 0; waited < maxWaitMs; waited += pollMs) {
		if (await fileService.exists(anchorToml)) {
			return true;
		}
		await timeout(pollMs);
	}

	return false;
}

registerAction2(class extends Action2 {
	constructor() {
		super({ id: AnchorCommandId.Build, title: localize2('solana.anchor.build', "Solana: Anchor Build") });
	}
	override async run(accessor: import('../../../../platform/instantiation/common/instantiation.js').ServicesAccessor): Promise<void> {
		await runAnchorTerminalCommand(accessor.get(ICommandService), 'anchor build');
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({ id: AnchorCommandId.Test, title: localize2('solana.anchor.test', "Solana: Anchor Test") });
	}
	override async run(accessor: import('../../../../platform/instantiation/common/instantiation.js').ServicesAccessor): Promise<void> {
		await runAnchorTerminalCommand(accessor.get(ICommandService), 'anchor test');
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({ id: AnchorCommandId.Deploy, title: localize2('solana.anchor.deploy', "Solana: Anchor Deploy") });
	}
	override async run(accessor: import('../../../../platform/instantiation/common/instantiation.js').ServicesAccessor): Promise<void> {
		await runAnchorTerminalCommand(accessor.get(ICommandService), 'anchor deploy');
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({ id: AnchorCommandId.SelectNetwork, title: localize2('solana.anchor.selectNetwork', "Solana: Select Anchor Network") });
	}
	override async run(accessor: import('../../../../platform/instantiation/common/instantiation.js').ServicesAccessor): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const commandService = accessor.get(ICommandService);
		const selected = await quickInputService.pick([
			{ id: 'localnet', label: 'localnet' },
			{ id: 'devnet', label: 'devnet' },
			{ id: 'mainnet-beta', label: 'mainnet-beta' },
		], { placeHolder: localize('solana.anchor.selectNetwork.placeholder', "Select the network for Anchor commands") });
		if (!selected) {
			return;
		}
		await runAnchorTerminalCommand(commandService, `solana config set --url ${selected.id}`);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({ id: AnchorCommandId.NewProject, title: localize2('solana.anchor.newProject', "Solana: New Anchor Project") });
	}
	override async run(accessor: import('../../../../platform/instantiation/common/instantiation.js').ServicesAccessor): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const commandService = accessor.get(ICommandService);
		const notificationService = accessor.get(INotificationService);
		const fileService = accessor.get(IFileService);
		const environmentService = accessor.get(INativeEnvironmentService);
		const workspaceContextService = accessor.get(IWorkspaceContextService);

		const template = await quickInputService.pick([
			{ id: 'basic', label: 'basic' },
			{ id: 'token', label: 'token' },
			{ id: 'nft', label: 'nft' },
			{ id: 'defi', label: 'defi' },
		], { placeHolder: localize('solana.anchor.newProject.placeholder', "Choose an Anchor starter template") });
		if (!template) {
			return;
		}

		const workspaceFolder = workspaceContextService.getWorkspace().folders[0]?.uri;
		const baseFolder = workspaceFolder ?? environmentService.userHome;

		const suggested = `solana-${template.id}-project`;
		const desired = await quickInputService.input({
			prompt: localize('solana.anchor.newProject.namePrompt', "Project folder name (created under {0})", baseFolder.fsPath),
			value: suggested,
			valueSelection: [0, suggested.length],
		});
		if (!desired) {
			return;
		}

		const projectName = await pickUniqueFolderName(fileService, baseFolder, desired);
		const projectFolder = URI.joinPath(baseFolder, projectName);

		await runAnchorTerminalCommand(commandService, `cd ${escapeShellArg(baseFolder.fsPath)}`);
		await runAnchorTerminalCommand(commandService, `anchor init ${escapeShellArg(projectName)}`);

		notificationService.notify({
			severity: Severity.Info,
			message: localize('solana.anchor.newProject.started', "Scaffolding Anchor project '{0}'…", projectName),
			source: 'Anchor Workflow',
		});

		const created = await waitForAnchorProject(fileService, projectFolder);
		if (!created) {
			notificationService.notify({
				severity: Severity.Warning,
				message: localize('solana.anchor.newProject.timeout', "Project '{0}' was not detected yet. If Anchor finished successfully, open it manually.", projectName),
				source: 'Anchor Workflow',
			});
			return;
		}

		await commandService.executeCommand('vscode.openFolder', projectFolder.toJSON(), { forceReuseWindow: true });
	}
});

