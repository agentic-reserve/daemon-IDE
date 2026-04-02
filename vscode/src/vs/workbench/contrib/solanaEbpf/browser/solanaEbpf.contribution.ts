/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { basename } from '../../../../base/common/path.js';
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
import { IConfigurationService, ConfigurationTarget } from '../../../../platform/configuration/common/configuration.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { INativeEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { URI } from '../../../../base/common/uri.js';
import { VIEW_CONTAINER } from '../../files/browser/explorerViewlet.js';
import { SolanaEbpfCommandId, SolanaEbpfView, SOLANA_EBPF_VIEW_ID } from './solanaEbpfView.js';
import { SolanaEbpfSettingId } from '../common/solanaEbpfConfiguration.js';

const ebpfIcon = registerIcon('solana-ebpf-view-icon', Codicon.debug, localize('solana.ebpf.icon', "View icon for Solana eBPF decompiler."));
const LAST_OUTPUT_STORAGE_KEY = 'solide.ebpf.lastOutputFolder';
const LAST_EXPORT_FILE_STORAGE_KEY = 'solide.ebpf.lastExportFile';

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([{
	id: SOLANA_EBPF_VIEW_ID,
	name: localize2('solana.ebpf.view.title', "eBPF Decompiler"),
	canToggleVisibility: true,
	canMoveView: true,
	ctorDescriptor: new SyncDescriptor(SolanaEbpfView),
	order: 4,
	weight: 13,
	containerIcon: ebpfIcon,
	focusCommand: { id: SolanaEbpfCommandId.Focus },
}], VIEW_CONTAINER);

async function runTerminalCommand(commandService: ICommandService, value: string): Promise<void> {
	await commandService.executeCommand('workbench.action.terminal.focus');
	await commandService.executeCommand('workbench.action.terminal.sendSequence', { text: `${value}\r` });
}

function normalizePathInput(value: string): string {
	return value.trim().replace(/^"(.*)"$/, '$1');
}

function defaultProjectRoot(environmentService: INativeEnvironmentService): URI {
	return URI.joinPath(environmentService.userHome, '.solide', 'ghidra-projects');
}

async function fileExists(fileService: IFileService, path: string): Promise<boolean> {
	try {
		return await fileService.exists(URI.file(path));
	} catch {
		return false;
	}
}

function ghidraAnalyzeHeadlessPath(ghidraInstallDir: string): string {
	return URI.joinPath(URI.file(ghidraInstallDir), 'support', 'analyzeHeadless').fsPath;
}

async function validateGhidraInstallDir(fileService: IFileService, ghidraInstallDir: string): Promise<boolean> {
	const analyzeHeadless = ghidraAnalyzeHeadlessPath(ghidraInstallDir);
	return fileExists(fileService, analyzeHeadless);
}

registerAction2(class extends Action2 {
	constructor() {
		super({ id: SolanaEbpfCommandId.ConfigureGhidra, title: localize2('solana.ebpf.configureGhidra', "Solana: Configure Ghidra") });
	}

	override async run(accessor: import('../../../../platform/instantiation/common/instantiation.js').ServicesAccessor): Promise<void> {
		const quickInput = accessor.get(IQuickInputService);
		const configurationService = accessor.get(IConfigurationService);

		const current = configurationService.getValue<string>(SolanaEbpfSettingId.GhidraInstallDir) ?? '';
		const value = await quickInput.input({
			prompt: localize('solana.ebpf.ghidra.prompt', "Enter absolute path to your Ghidra install directory"),
			value: current,
			valueSelection: [0, current.length],
		});
		if (value === undefined) {
			return;
		}

		await configurationService.updateValue(SolanaEbpfSettingId.GhidraInstallDir, normalizePathInput(value), ConfigurationTarget.USER);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({ id: SolanaEbpfCommandId.InstallProcessorModule, title: localize2('solana.ebpf.installProcessorModule', "Solana: Install Solana eBPF Ghidra Module") });
	}

	override async run(accessor: import('../../../../platform/instantiation/common/instantiation.js').ServicesAccessor): Promise<void> {
		const configurationService = accessor.get(IConfigurationService);
		const quickInput = accessor.get(IQuickInputService);
		const notificationService = accessor.get(INotificationService);
		const environmentService = accessor.get(INativeEnvironmentService);
		const fileService = accessor.get(IFileService);
		const commandService = accessor.get(ICommandService);

		let ghidraInstallDir = (configurationService.getValue<string>(SolanaEbpfSettingId.GhidraInstallDir) ?? '').trim();
		if (!ghidraInstallDir) {
			const typed = await quickInput.input({ prompt: localize('solana.ebpf.ghidra.prompt.install', "Ghidra install dir is not set. Enter it now") });
			if (!typed) {
				return;
			}
			ghidraInstallDir = normalizePathInput(typed);
			await configurationService.updateValue(SolanaEbpfSettingId.GhidraInstallDir, ghidraInstallDir, ConfigurationTarget.USER);
		}
		if (!(await validateGhidraInstallDir(fileService, ghidraInstallDir))) {
			notificationService.error(localize(
				'solana.ebpf.ghidra.invalid.install',
				"Invalid Ghidra install dir: expected `{0}`. Run “Solana: Configure Ghidra” and select your Ghidra root folder.",
				ghidraAnalyzeHeadlessPath(ghidraInstallDir)
			));
			return;
		}

		// Derive repo root from the app root, then locate the module folder next to `vscode/`.
		const appRoot = URI.file(environmentService.appRoot);
		const moduleFolder = URI.joinPath(appRoot, '..', '..', 'Solana-eBPF-for-Ghidra');
		if (!(await fileService.exists(moduleFolder))) {
			notificationService.error(localize(
				'solana.ebpf.module.missing',
				"Missing `Solana-eBPF-for-Ghidra/` folder at `{0}`. Ensure ARGUS IDE is launched from this repository root.",
				moduleFolder.fsPath
			));
			return;
		}

		notificationService.notify({
			severity: Severity.Info,
			message: localize('solana.ebpf.install.started', "Building Solana eBPF Ghidra module…"),
			source: 'eBPF Decompiler',
		});

		await runTerminalCommand(commandService, `cd "${moduleFolder.fsPath}"`);
		await runTerminalCommand(commandService, `GHIDRA_INSTALL_DIR="${ghidraInstallDir}" gradle`);

		notificationService.notify({
			severity: Severity.Info,
			message: localize('solana.ebpf.install.next', "Build started. When it finishes, install the generated extension zip in Ghidra via File → Install Extensions…"),
			source: 'eBPF Decompiler',
		});
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({ id: SolanaEbpfCommandId.DecompileProgram, title: localize2('solana.ebpf.decompileProgram', "Solana: Decompile eBPF Program (.so)") });
	}

	override async run(accessor: import('../../../../platform/instantiation/common/instantiation.js').ServicesAccessor): Promise<void> {
		const quickInput = accessor.get(IQuickInputService);
		const configurationService = accessor.get(IConfigurationService);
		const storageService = accessor.get(IStorageService);
		const notificationService = accessor.get(INotificationService);
		const environmentService = accessor.get(INativeEnvironmentService);
		const fileService = accessor.get(IFileService);
		const commandService = accessor.get(ICommandService);

		const ghidraInstallDir = (configurationService.getValue<string>(SolanaEbpfSettingId.GhidraInstallDir) ?? '').trim();
		if (!ghidraInstallDir) {
			notificationService.error(localize('solana.ebpf.ghidra.notSet', "Ghidra install dir is not configured. Run “Solana: Configure Ghidra” first."));
			return;
		}
		if (!(await validateGhidraInstallDir(fileService, ghidraInstallDir))) {
			notificationService.error(localize(
				'solana.ebpf.ghidra.invalid.decompile',
				"Invalid Ghidra install dir: expected `{0}`. Run “Solana: Configure Ghidra” and select your Ghidra root folder.",
				ghidraAnalyzeHeadlessPath(ghidraInstallDir)
			));
			return;
		}

		const binaryPathInput = await quickInput.input({
			prompt: localize('solana.ebpf.binary.prompt', "Path to Solana program binary (.so)"),
			value: '',
		});
		if (!binaryPathInput) {
			return;
		}

		const binaryPath = normalizePathInput(binaryPathInput);
		if (!(await fileExists(fileService, binaryPath))) {
			notificationService.error(localize('solana.ebpf.binary.missing', "File not found: {0}", binaryPath));
			return;
		}

		const configuredRoot = (configurationService.getValue<string>(SolanaEbpfSettingId.ProjectDir) ?? '').trim();
		const projectRoot = configuredRoot ? URI.file(configuredRoot) : defaultProjectRoot(environmentService);
		const projectName = `solide-ebpf-${Date.now()}-${basename(binaryPath).replace(/[^a-zA-Z0-9._-]+/g, '-')}`;
		const exportRoot = URI.joinPath(projectRoot, `${projectName}-export`);
		const exportFile = URI.joinPath(exportRoot, 'decompile.c');

		const analyzeHeadless = `"${ghidraAnalyzeHeadlessPath(ghidraInstallDir)}"`;
		const timeoutSeconds = configurationService.getValue<number>(SolanaEbpfSettingId.TimeoutSeconds) ?? 300;

		await runTerminalCommand(commandService, `mkdir -p "${projectRoot.fsPath}"`);
		await runTerminalCommand(commandService, `mkdir -p "${exportRoot.fsPath}"`);

		notificationService.notify({
			severity: Severity.Info,
			message: localize('solana.ebpf.decompile.started', "Starting headless import & analysis…"),
			source: 'eBPF Decompiler',
		});

		const appRoot = URI.file(environmentService.appRoot);
		const scriptPath = URI.joinPath(appRoot, 'vs', 'workbench', 'contrib', 'solanaEbpf', 'browser', 'ghidra_scripts');
		const postScript = 'SolideExportDecompile.java';

		await runTerminalCommand(commandService, `${analyzeHeadless} "${projectRoot.fsPath}" "${projectName}" -import "${binaryPath}" -analysisTimeoutPerFile ${timeoutSeconds} -scriptPath "${scriptPath.fsPath}" -postScript ${postScript} "${exportRoot.fsPath}"`);

		storageService.store(LAST_OUTPUT_STORAGE_KEY, exportRoot.fsPath, StorageScope.APPLICATION, StorageTarget.USER);
		storageService.store(LAST_EXPORT_FILE_STORAGE_KEY, exportFile.fsPath, StorageScope.APPLICATION, StorageTarget.USER);
		notificationService.notify({
			severity: Severity.Info,
			message: localize('solana.ebpf.decompile.done', "Headless run started. Export folder: {0}", exportRoot.fsPath),
			source: 'eBPF Decompiler',
		});

		// The export file may appear later; opening immediately gives a fast path when it already exists.
		try {
			await commandService.executeCommand('vscode.open', exportFile);
		} catch {
			// ignore
		}
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({ id: SolanaEbpfCommandId.OpenReport, title: localize2('solana.ebpf.openReport', "Solana: Open eBPF Decompiler Output Folder") });
	}

	override async run(accessor: import('../../../../platform/instantiation/common/instantiation.js').ServicesAccessor): Promise<void> {
		const storageService = accessor.get(IStorageService);
		const commandService = accessor.get(ICommandService);
		const notificationService = accessor.get(INotificationService);

		const exportFile = storageService.get(LAST_EXPORT_FILE_STORAGE_KEY, StorageScope.APPLICATION);
		if (exportFile) {
			try {
				await commandService.executeCommand('vscode.open', URI.file(exportFile));
				return;
			} catch {
				// fall through to reveal in OS
			}
		}

		const folder = storageService.get(LAST_OUTPUT_STORAGE_KEY, StorageScope.APPLICATION);
		if (!folder && !exportFile) {
			notificationService.error(localize('solana.ebpf.openReport.none', "No previous output folder recorded yet."));
			return;
		}

		await commandService.executeCommand('revealFileInOS', URI.file(exportFile ?? folder!));
	}
});

