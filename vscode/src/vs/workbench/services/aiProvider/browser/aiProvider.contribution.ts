/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { ISecretStorageService } from '../../../../platform/secrets/common/secrets.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { SolideAiProvider, SolideAiSettingId } from '../common/aiProvider.js';

export const enum SolideAiCommandId {
	SetApiKey = 'solide.ai.setApiKey',
}

function normalize(value: string): string {
	return value.trim().replace(/^"(.*)"$/, '$1');
}

function isAiProvider(value: string | undefined): value is SolideAiProvider {
	switch (value) {
		case SolideAiProvider.OpenAI:
		case SolideAiProvider.Anthropic:
		case SolideAiProvider.OpenRouter:
		case SolideAiProvider.Daemon:
		case SolideAiProvider.Ollama:
			return true;
		default:
			return false;
	}
}

registerAction2(class extends Action2 {
	constructor() {
		super({ id: SolideAiCommandId.SetApiKey, title: localize2('solide.ai.setApiKey', "Solana IDE: Set AI API Key") });
	}

	override async run(accessor: import('../../../../platform/instantiation/common/instantiation.js').ServicesAccessor): Promise<void> {
		const configurationService = accessor.get(IConfigurationService);
		const quickInputService = accessor.get(IQuickInputService);
		const secretStorageService = accessor.get(ISecretStorageService);

		const provider = configurationService.getValue<string>(SolideAiSettingId.Provider);
		const id = isAiProvider(provider) ? provider : SolideAiProvider.OpenRouter;

		const key = await quickInputService.input({
			password: true,
			prompt: localize('solide.ai.setApiKey.prompt', "Enter API key for {0}", id),
		});
		if (!key) {
			return;
		}

		await secretStorageService.set(`solide.ai.apiKey.${id}`, normalize(key));
	}
});

