/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IChatMessage, ILanguageModelChatRequestOptions } from '../../../contrib/chat/common/languageModels.js';

export const IAiProviderService = createDecorator<IAiProviderService>('IAiProviderService');

export const enum SolideAiProvider {
	OpenAI = 'openai',
	Anthropic = 'anthropic',
	OpenRouter = 'openrouter',
	Daemon = 'daemon',
	Ollama = 'ollama',
}

export const enum SolideAiSettingId {
	Provider = 'solide.ai.provider',
	Model = 'solide.ai.model',
	BaseUrl = 'solide.ai.baseUrl',
	Temperature = 'solide.ai.temperature',
	McpAllowedServers = 'solide.ai.mcp.allowedServers',
	McpAllowedTools = 'solide.ai.mcp.allowedTools',
}

export interface IAiProviderUsage {
	readonly promptTokens?: number;
	readonly completionTokens?: number;
	readonly totalTokens?: number;
	readonly costUsd?: number;
}

export type IAiProviderStreamPart =
	| { readonly type: 'text'; readonly value: string }
	| { readonly type: 'tool_use'; readonly value: { readonly name: string; readonly toolCallId: string; readonly parameters: unknown } }
	| { readonly type: 'usage'; readonly value: IAiProviderUsage }
	| { readonly type: 'raw'; readonly value: unknown };

export interface IAiProviderResponse {
	readonly stream: AsyncIterable<IAiProviderStreamPart>;
	readonly raw: unknown;
	readonly usage?: IAiProviderUsage;
}

export interface IAiProviderService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeConfiguration: Event<void>;

	getConfiguredProvider(): SolideAiProvider;
	getConfiguredModel(): string;
	sendChatRequest(messages: IChatMessage[], options: ILanguageModelChatRequestOptions, token: CancellationToken): Promise<IAiProviderResponse>;
}

