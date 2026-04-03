/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SolideAiProvider, SolideAiSettingId } from './aiProvider.js';

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'solide.ai',
	order: 20,
	title: localize('solide.ai.configuration.title', "Solana IDE AI"),
	type: 'object',
	properties: {
		[SolideAiSettingId.Provider]: {
			type: 'string',
			enum: [SolideAiProvider.OpenRouter, SolideAiProvider.OpenAI, SolideAiProvider.Anthropic, SolideAiProvider.Daemon, SolideAiProvider.Ollama],
			default: SolideAiProvider.OpenRouter,
			markdownDescription: localize('solide.ai.provider', "Selects which AI backend powers the built-in Solana AI features."),
		},
		[SolideAiSettingId.Model]: {
			type: 'string',
			default: 'openai/gpt-4o-mini',
			markdownDescription: localize('solide.ai.model', "Model identifier to use for Solana AI chat requests."),
		},
		[SolideAiSettingId.BaseUrl]: {
			type: 'string',
			default: '',
			markdownDescription: localize('solide.ai.baseUrl', "Optional custom base URL. Leave empty to use the provider default endpoint."),
		},
		[SolideAiSettingId.Temperature]: {
			type: 'number',
			default: 0.2,
			minimum: 0,
			maximum: 2,
			markdownDescription: localize('solide.ai.temperature', "Sampling temperature for AI requests."),
		},
		[SolideAiSettingId.McpAllowedServers]: {
			type: 'array',
			items: { type: 'string' },
			default: ['user-solanaMcp'],
			markdownDescription: localize('solide.ai.mcp.allowedServers', "List of MCP server IDs that the AI is allowed to call as tools. This is an allowlist."),
		},
		[SolideAiSettingId.McpAllowedTools]: {
			type: 'array',
			items: { type: 'string' },
			default: [],
			markdownDescription: localize('solide.ai.mcp.allowedTools', "List of allowed tool patterns (glob-like) within allowed MCP servers. Default is empty (deny all). Examples: `*` (allow all), `get_*` (allow tools starting with get_), `*_read` (allow tools ending with _read). **WARNING**: Using `*` exposes all tools from allowed servers to the AI."),
		},
	}
});

