/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { URI } from '../../../../base/common/uri.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IAiProviderService } from '../../../services/aiProvider/common/aiProvider.js';
import { IMcpToolRouter } from '../../../services/aiProvider/common/mcpToolRouter.js';
import { IChatMessage, IChatResponsePart, ILanguageModelChatMetadataAndIdentifier, ILanguageModelChatProvider, ILanguageModelChatRequestOptions, ILanguageModelChatResponse, ILanguageModelsService } from '../common/languageModels.js';
import { IUserFriendlyLanguageModel } from '../common/languageModels.js';
import { VSBuffer } from '../../../../base/common/buffer.js';

class SolanaIdeLanguageModelProvider implements ILanguageModelChatProvider {
	private readonly _onDidChange = new Emitter<void>();
	readonly onDidChange = this._onDidChange.event;

	constructor(
		private readonly _aiProviderService: IAiProviderService,
		private readonly _mcpToolRouter: IMcpToolRouter,
		private readonly _workspaceContextService: IWorkspaceContextService,
		private readonly _fileService: IFileService,
	) {
		this._aiProviderService.onDidChangeConfiguration(() => this._onDidChange.fire());
	}

	async provideLanguageModelChatInfo(): Promise<ILanguageModelChatMetadataAndIdentifier[]> {
		const modelIdentifier = this._modelIdentifier();
		return [{
			identifier: modelIdentifier,
			metadata: {
				extension: new ExtensionIdentifier('solana.ide'),
				name: this._aiProviderService.getConfiguredModel(),
				id: modelIdentifier,
				vendor: 'solide',
				version: '1.0.0',
				family: 'solide-chat',
				maxInputTokens: 128000,
				maxOutputTokens: 4096,
				isDefaultForLocation: {},
				modelPickerCategory: { label: localize('solide.category', "Solana IDE"), order: 20 },
				capabilities: {
					toolCalling: true,
					agentMode: true,
				}
			}
		}];
	}

	async sendChatRequest(_modelId: string, messages: IChatMessage[], _from: ExtensionIdentifier | undefined, options: ILanguageModelChatRequestOptions, token: CancellationToken): Promise<ILanguageModelChatResponse> {
		const prompt = await this._buildSolanaSystemPrompt();
		const mergedMessages: IChatMessage[] = [{
			role: 0,
			content: [{ type: 'text', value: prompt }],
		}, ...messages];

		const tools = await this._mcpToolRouter.listOpenAiTools();
		const requestOptions: ILanguageModelChatRequestOptions = {
			...options,
			modelOptions: {
				...(options.modelOptions ?? {}),
				tools,
			}
		};

		return {
			stream: (async function* (this: SolanaIdeLanguageModelProvider): AsyncIterable<IChatResponsePart | IChatResponsePart[]> {
				let currentMessages = mergedMessages;
				while (true) {
					const response = await this._aiProviderService.sendChatRequest(currentMessages, requestOptions, token);
					const toolCalls: Array<{ name: string; toolCallId: string; parameters: unknown }> = [];

					for await (const part of response.stream) {
						if (part.type === 'text') {
							yield { type: 'text' as const, value: part.value };
						} else if (part.type === 'tool_use') {
							toolCalls.push(part.value);
							yield { type: 'tool_use' as const, name: part.value.name, toolCallId: part.value.toolCallId, parameters: part.value.parameters };
						}
					}

					if (!toolCalls.length) {
						return;
					}

					const toolResultParts: any[] = [];
					for (const call of toolCalls) {
						try {
							const result = await this._mcpToolRouter.executeTool(call.name, call.parameters, token);
							yield { type: 'data' as const, mimeType: result.mimeType, data: result.bytes };
							toolResultParts.push({ type: 'tool_result', toolCallId: call.toolCallId, value: [{ type: 'data', mimeType: result.mimeType, data: result.bytes }], isError: result.isError });
						} catch (error) {
							const text = error instanceof Error ? error.message : String(error);
							const bytes = VSBuffer.fromString(text);
							yield { type: 'data' as const, mimeType: 'text/plain', data: bytes };
							toolResultParts.push({ type: 'tool_result', toolCallId: call.toolCallId, value: [{ type: 'text', value: text }], isError: true });
						}
					}

					currentMessages = [...currentMessages, { role: 2, content: toolResultParts }];
				}
			}).call(this),
			result: Promise.resolve(undefined),
		};
	}

	async provideTokenCount(_modelId: string, message: string | IChatMessage): Promise<number> {
		const text = typeof message === 'string'
			? message
			: message.content.filter(part => part.type === 'text').map(part => part.value).join('\n');
		return Math.max(1, Math.ceil(text.length / 4));
	}

	private _modelIdentifier(): string {
		const provider = this._aiProviderService.getConfiguredProvider();
		const model = this._aiProviderService.getConfiguredModel();
		return `solide/${provider}/${model}`;
	}

	private async _buildSolanaSystemPrompt(): Promise<string> {
		let hasAnchorToml = false;
		for (const folder of this._workspaceContextService.getWorkspace().folders) {
			const anchorToml = URI.joinPath(folder.uri, 'Anchor.toml');
			if (await this._fileService.exists(anchorToml)) {
				hasAnchorToml = true;
				break;
			}
		}

		const workspaceHint = hasAnchorToml
			? 'The current workspace contains Anchor.toml, so assume this is an Anchor project unless the user says otherwise.'
			: 'No Anchor.toml was detected yet. Ask whether the user wants to scaffold a new Anchor project.';

		return [
			'You are the built-in Solana development assistant in Solana IDE.',
			'Prioritize Solana and Anchor best practices for programs, clients, tests, and deployment workflows.',
			'Use MCP tools when available for Solana docs, Anchor guidance, and blockchain intelligence.',
			'When proposing commands, default to explicit and safe commands suitable for localnet/devnet workflows.',
			workspaceHint,
		].join(' ');
	}
}

class SolanaIdeLanguageModelContribution extends Disposable {
	static readonly ID = 'workbench.contrib.solanaIdeLanguageModelContribution';

	constructor(
		@ILanguageModelsService languageModelsService: ILanguageModelsService,
		@IAiProviderService aiProviderService: IAiProviderService,
		@IMcpToolRouter mcpToolRouter: IMcpToolRouter,
		@ILogService logService: ILogService,
		@IWorkspaceContextService workspaceContextService: IWorkspaceContextService,
		@IFileService fileService: IFileService,
	) {
		super();

		const descriptor: IUserFriendlyLanguageModel = {
			vendor: 'solide',
			displayName: 'Solana IDE',
			configuration: undefined,
			managementCommand: undefined,
			when: undefined,
		};
		languageModelsService.deltaLanguageModelChatProviderDescriptors([descriptor], []);

		const provider = new SolanaIdeLanguageModelProvider(aiProviderService, mcpToolRouter, workspaceContextService, fileService);
		this._register(provider.onDidChange(() => {
			logService.debug('[SolanaIdeLanguageModelContribution] AI provider configuration changed');
		}));
		this._register(languageModelsService.registerLanguageModelProvider('solide', provider));
	}
}

registerWorkbenchContribution2(SolanaIdeLanguageModelContribution.ID, SolanaIdeLanguageModelContribution, WorkbenchPhase.BlockRestore);

