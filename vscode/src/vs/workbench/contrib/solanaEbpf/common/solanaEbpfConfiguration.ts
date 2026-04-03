/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';

export const enum SolanaEbpfSettingId {
	GhidraInstallDir = 'solide.ebpf.ghidraInstallDir',
	ProjectDir = 'solide.ebpf.projectDir',
	TimeoutSeconds = 'solide.ebpf.timeoutSeconds',
}

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'solide.ebpf',
	order: 21,
	title: localize('solide.ebpf.configuration.title', "Solana eBPF"),
	type: 'object',
	properties: {
		[SolanaEbpfSettingId.GhidraInstallDir]: {
			type: 'string',
			default: '',
			markdownDescription: localize('solide.ebpf.ghidraInstallDir', "Absolute path to your local Ghidra installation directory (used for headless analysis)."),
		},
		[SolanaEbpfSettingId.ProjectDir]: {
			type: 'string',
			default: '',
			markdownDescription: localize('solide.ebpf.projectDir', "Directory where headless Ghidra projects will be stored. If empty, ARES IDE will choose a default."),
		},
		[SolanaEbpfSettingId.TimeoutSeconds]: {
			type: 'number',
			default: 300,
			minimum: 30,
			markdownDescription: localize('solide.ebpf.timeoutSeconds', "Per-run timeout (in seconds) for headless analysis."),
		},
	}
});

