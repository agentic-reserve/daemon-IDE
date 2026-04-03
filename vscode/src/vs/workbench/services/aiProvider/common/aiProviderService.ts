/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { isString } from '../../../../base/common/types.js';
import { decodeBase64 } from '../../../../base/common/buffer.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { ISecretStorageService } from '../../../../platform/secrets/common/secrets.js';
import { IChatMessage, ILanguageModelChatRequestOptions } from '../../../contrib/chat/common/languageModels.js';
import { IAiProviderResponse, IAiProviderService, IAiProviderStreamPart, IAiProviderUsage, SolideAiProvider, SolideAiSettingId } from './aiProvider.js';
import { X402PaymentRequiredError, fetchWithX402Readiness } from './x402Http.js';
import { IMcpToolRouter, McpToolRouter } from './mcpToolRouter.js';

type OpenAiRole = 'system' | 'user' | 'assistant' | 'tool';

function simpleHash(value: string): string {
	let hash = 0;
	for (let i = 0; i < value.length; i++) {
		const char = value.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash;
	}
	return Math.abs(hash).toString(16);
}

const REPLAY_WINDOW_MS = 60_000;
const _recentSignatures = new Map<string, number>();

const SECRET_PATTERNS = [
	/ak-[a-zA-Z0-9]{20,}/i,
	/sk-[a-zA-Z0-9]{20,}/i,
	/0x[a-fA-F0-9]{40,}/,
	/[a-zA-Z0-9+/]{40,}={0,2}/,
	/eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/,
	/solana_[a-zA-Z0-9]{40,}/i,
];

const MAX_OUTPUT_LENGTH = 10000;

function containsPotentialSecret(text: string): boolean {
	return SECRET_PATTERNS.some(pattern => pattern.test(text));
}

function redactSecrets(text: string, redactionLabel = '[REDACTED]'): string {
	let result = text;
	for (const pattern of SECRET_PATTERNS) {
		result = result.replace(pattern, redactionLabel);
	}
	return result;
}

function redactToolOutput(output: unknown): { redacted: unknown; hadSecrets: boolean } {
	if (typeof output === 'string') {
		const hadSecrets = containsPotentialSecret(output);
		const redacted = hadSecrets ? redactSecrets(output) : output;
		const truncated = redacted.length > MAX_OUTPUT_LENGTH ? redacted.slice(0, MAX_OUTPUT_LENGTH) + '...[truncated]' : redacted;
		return { redacted: truncated, hadSecrets };
	}

	if (Array.isArray(output)) {
		let hadSecrets = false;
		const redacted = output.map(item => {
			const result = redactToolOutput(item);
			if (result.hadSecrets) hadSecrets = true;
			return result.redacted;
		});
		return { redacted, hadSecrets };
	}

	if (output && typeof output === 'object') {
		let hadSecrets = false;
		const redacted: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(output)) {
			const result = redactToolOutput(value);
			if (result.hadSecrets) hadSecrets = true;
			redacted[key] = result.redacted;
		}
		return { redacted, hadSecrets };
	}

	return { redacted: output, hadSecrets: false };
}

export class AiProviderService extends Disposable implements IAiProviderService {
	readonly _serviceBrand: undefined;

	private readonly _onDidChangeConfiguration = this._register(new Emitter<void>());
	readonly onDidChangeConfiguration = this._onDidChangeConfiguration.event;

	constructor(
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@ILogService private readonly _logService: ILogService,
		@IQuickInputService private readonly _quickInputService: IQuickInputService,
		@ISecretStorageService private readonly _secretStorageService: ISecretStorageService,
	) {
		super();
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (
				e.affectsConfiguration(SolideAiSettingId.Provider) ||
				e.affectsConfiguration(SolideAiSettingId.Model) ||
				e.affectsConfiguration(SolideAiSettingId.BaseUrl) ||
				e.affectsConfiguration(SolideAiSettingId.Temperature)
			) {
				this._onDidChangeConfiguration.fire();
			}
		}));
	}

	getConfiguredProvider(): SolideAiProvider {
		const configured = this._configurationService.getValue<string>(SolideAiSettingId.Provider);
		switch (configured) {
			case SolideAiProvider.OpenAI:
			case SolideAiProvider.Anthropic:
			case SolideAiProvider.OpenRouter:
			case SolideAiProvider.Daemon:
			case SolideAiProvider.Ollama:
				return configured;
			default:
				return SolideAiProvider.OpenRouter;
		}
	}

	getConfiguredModel(): string {
		return this._configurationService.getValue<string>(SolideAiSettingId.Model) || 'openai/gpt-4o-mini';
	}

	async sendChatRequest(messages: IChatMessage[], options: ILanguageModelChatRequestOptions, token: CancellationToken): Promise<IAiProviderResponse> {
		const provider = this.getConfiguredProvider();
		const response = await (async () => {
			switch (provider) {
			case SolideAiProvider.Anthropic:
				return this._sendAnthropic(messages, options, token);
			case SolideAiProvider.Ollama:
				return this._sendOpenAiCompatible(messages, options, 'http://localhost:11434/v1/chat/completions', undefined, token);
			case SolideAiProvider.OpenAI:
				return this._sendOpenAiCompatible(messages, options, 'https://api.openai.com/v1/chat/completions', await this._getApiKey(provider), token);
			case SolideAiProvider.Daemon:
				return this._sendOpenAiCompatible(messages, options, 'https://daemonai.io/api/v1/chat/completions', await this._getApiKey(provider), token);
			case SolideAiProvider.OpenRouter:
			default:
				return this._sendOpenAiCompatible(messages, options, 'https://openrouter.ai/api/v1/chat/completions', await this._getApiKey(provider), token);
			}
		})();

		if (response.usage) {
			this._logService.info('[AiProviderService] usage', {
				provider,
				model: this.getConfiguredModel(),
				...response.usage,
			});
		}

		return response;
	}

	private async _getApiKey(provider: SolideAiProvider): Promise<string | undefined> {
		try {
			const key = (await this._secretStorageService.get(`solide.ai.apiKey.${provider}`))?.trim();
			return key ? key : undefined;
		} catch (error) {
			this._logService.debug('[AiProviderService] Failed reading API key from secret storage', error);
			return undefined;
		}
	}

	private _getBaseUrl(): string | undefined {
		const url = this._configurationService.getValue<string>(SolideAiSettingId.BaseUrl)?.trim();
		return url || undefined;
	}

	private _getTemperature(options: ILanguageModelChatRequestOptions): number {
		const fromOptions = options.modelOptions?.temperature;
		if (typeof fromOptions === 'number') {
			return fromOptions;
		}
		const configured = this._configurationService.getValue<number>(SolideAiSettingId.Temperature);
		return typeof configured === 'number' ? configured : 0.2;
	}

	private _flattenTextParts(message: IChatMessage): string {
		return message.content
			.filter(part => part.type === 'text')
			.map(part => part.value)
			.join('\n')
			.trim();
	}

	private _toOpenAiMessages(messages: IChatMessage[]): Array<{ role: OpenAiRole; content: string; tool_call_id?: string }> {
		const result: Array<{ role: OpenAiRole; content: string; tool_call_id?: string }> = [];

		for (const message of messages) {
			// Expand tool results into OpenAI `tool` role messages when present.
			const toolResults = message.content.filter(p => p.type === 'tool_result') as Array<{ type: 'tool_result'; toolCallId: string; value: unknown; isError?: boolean }>;
			if (toolResults.length) {
				for (const toolResult of toolResults) {
					const { redacted, hadSecrets } = redactToolOutput(toolResult.value);
					if (hadSecrets) {
						this._logService.warn('[AiProviderService] Tool output contained secrets - redacted before sending to LLM');
					}
					result.push({
						role: 'tool',
						tool_call_id: toolResult.toolCallId,
						content: JSON.stringify(redacted),
					});
				}
				continue;
			}

			const role: OpenAiRole = message.role === 1 ? 'user' : message.role === 2 ? 'assistant' : 'system';
			const text = this._flattenTextParts(message);
			if (containsPotentialSecret(text)) {
				this._logService.warn('[AiProviderService] Message may contain secrets - consider reviewing');
			}
			result.push({ role, content: text });
		}

		return result;
	}

	private async _sendOpenAiCompatible(messages: IChatMessage[], options: ILanguageModelChatRequestOptions, defaultUrl: string, apiKey: string | undefined, token: CancellationToken): Promise<IAiProviderResponse> {
		const tools = options.modelOptions && Array.isArray((options.modelOptions as any).tools) ? (options.modelOptions as any).tools : undefined;
		const payload = {
			model: this.getConfiguredModel(),
			messages: this._toOpenAiMessages(messages),
			temperature: this._getTemperature(options),
			stream: true,
			...(tools ? { tools, tool_choice: 'auto' } : {}),
		};

		const url = this._getBaseUrl() || defaultUrl;
		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		if (apiKey) {
			headers.Authorization = `Bearer ${apiKey}`;
		}

		const { stream, raw, usage } = await this._postOpenAiStreaming(url, headers, payload, token);
		return { stream, raw, usage };
	}

	private async _sendAnthropic(messages: IChatMessage[], options: ILanguageModelChatRequestOptions, token: CancellationToken): Promise<IAiProviderResponse> {
		const apiKey = await this._getApiKey(SolideAiProvider.Anthropic);
		const url = this._getBaseUrl() || 'https://api.anthropic.com/v1/messages';
		const payload = {
			model: this.getConfiguredModel(),
			max_tokens: 2048,
			temperature: this._getTemperature(options),
			messages: messages
				.filter(m => m.role !== 0)
				.map(m => ({
					role: m.role === 2 ? 'assistant' : 'user',
					content: this._flattenTextParts(m),
				}))
		};

		const raw = await this._postJson(url, {
			'Content-Type': 'application/json',
			'anthropic-version': '2023-06-01',
			...(apiKey ? { 'x-api-key': apiKey } : {}),
		}, payload, token);

		let text = '';
		if (typeof raw === 'object' && raw && 'content' in raw && Array.isArray((raw as { content?: unknown[] }).content)) {
			for (const part of (raw as { content: unknown[] }).content) {
				if (typeof part === 'object' && part && 'text' in part && isString((part as { text?: unknown }).text)) {
					text += (part as { text: string }).text;
				}
			}
		}

		const usage: IAiProviderUsage | undefined = undefined;
		return {
			raw,
			usage,
			stream: (async function* (): AsyncIterable<IAiProviderStreamPart> {
				if (text) {
					yield { type: 'text', value: text };
				}
				yield { type: 'raw', value: raw };
			})(),
		};
	}

	private async _postOpenAiStreaming(url: string, headers: Record<string, string>, body: unknown, token: CancellationToken): Promise<{ stream: AsyncIterable<IAiProviderStreamPart>; raw: unknown; usage?: IAiProviderUsage }> {
		const controller = new AbortController();
		const listener = token.onCancellationRequested(() => controller.abort());

		try {
			const post = async (extraHeaders?: Record<string, string>) => {
				return await fetch(url, {
					method: 'POST',
					headers: { ...headers, ...(extraHeaders ?? {}) },
					body: JSON.stringify(body),
					signal: controller.signal,
				});
			};

			let response = await post();

			if (!response.ok) {
				if (response.status === 402) {
					let required: X402PaymentRequiredError;
					try {
						await fetchWithX402Readiness(url, {
							method: 'POST',
							headers,
							body: JSON.stringify(body),
							signal: controller.signal,
						});
						// Should never reach here because status===402.
						const text = await response.text();
						throw new Error(`AI provider request failed (${response.status}): ${text}`);
					} catch (error) {
						if (error instanceof X402PaymentRequiredError) {
							required = error;
						} else {
							throw error;
						}
					}

					const paymentRequiredHeader = required.readonlyHeaders['payment-required'] ?? required.readonlyHeaders['payment_required'];
					let paymentRequiredPreview = '';
					if (paymentRequiredHeader) {
						try {
							const decoded = decodeBase64(paymentRequiredHeader);
							paymentRequiredPreview = new TextDecoder().decode(decoded.buffer).slice(0, 3000);
						} catch {
							// ignore
						}
					}

					const requestBinding = `${url}::${paymentRequiredPreview}::${simpleHash(paymentRequiredHeader || '')}`;
					const bindingHash = simpleHash(requestBinding);
					const now = Date.now();
					for (const [sig, timestamp] of _recentSignatures) {
						if (now - timestamp > REPLAY_WINDOW_MS) {
							_recentSignatures.delete(sig);
						}
					}

					const prompt = [
						'SECURITY: Verify before paying!',
						`URL: ${url}`,
						paymentRequiredPreview ? `Requirement: ${paymentRequiredPreview}` : '',
						`Binding: ${bindingHash.substring(0, 8)}...`,
						'',
						'Paste payment signature (base64 JSON) to pay and retry once.',
						'WARNING: The same signature cannot be reused within 60 seconds.',
					].filter(Boolean).join('\n');

					const paymentSignatureB64 = await this._quickInputService.input({
						password: true,
						prompt,
						placeHolder: paymentRequiredPreview ? `PAYMENT-REQUIRED: ${paymentRequiredPreview}` : undefined,
					});

					if (paymentSignatureB64) {
						const trimmedSig = paymentSignatureB64.trim();
						if (_recentSignatures.has(trimmedSig)) {
							this._logService.warn('[AiProviderService] x402 replay detected - signature used within 60s window');
							throw new Error('Payment signature was recently used. Wait 60 seconds before retrying.');
						}
						_recentSignatures.set(trimmedSig, Date.now());
						response = await post({ 'PAYMENT-SIGNATURE': trimmedSig });
						if (!response.ok) {
							const text = await response.text();
							throw new Error(`AI provider request failed (${response.status}): ${text}`);
						}
					} else {
						throw required;
					}
				}
				const text = await response.text();
				throw new Error(`AI provider request failed (${response.status}): ${text}`);
			}

			const rawChunks: unknown[] = [];
			let finalUsage: IAiProviderUsage | undefined = undefined;

			const stream = (async function* (): AsyncIterable<IAiProviderStreamPart> {
				const reader = response.body?.getReader();
				if (!reader) {
					return;
				}

				const decoder = new TextDecoder();
				let buffer = '';

				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						break;
					}

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split(/\r?\n/);
					buffer = lines.pop() ?? '';

					for (const line of lines) {
						const trimmed = line.trim();
						if (!trimmed.startsWith('data:')) {
							continue;
						}
						const data = trimmed.slice('data:'.length).trim();
						if (!data) {
							continue;
						}
						if (data === '[DONE]') {
							return;
						}
						try {
							const json = JSON.parse(data) as any;
							rawChunks.push(json);

							const delta = json?.choices?.[0]?.delta?.content;
							if (isString(delta) && delta) {
								yield { type: 'text', value: delta };
							}

							const toolCalls = json?.choices?.[0]?.delta?.tool_calls;
							if (Array.isArray(toolCalls)) {
								for (const toolCall of toolCalls) {
									const id = toolCall?.id;
									const name = toolCall?.function?.name;
									const args = toolCall?.function?.arguments;
									if (isString(id) && isString(name) && isString(args)) {
										try {
											yield { type: 'tool_use', value: { toolCallId: id, name, parameters: JSON.parse(args) } };
										} catch {
											// ignore partial/invalid JSON
										}
									}
								}
							}

							const usage = json?.usage;
							if (usage && typeof usage === 'object') {
								finalUsage = {
									promptTokens: typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : undefined,
									completionTokens: typeof usage.completion_tokens === 'number' ? usage.completion_tokens : undefined,
									totalTokens: typeof usage.total_tokens === 'number' ? usage.total_tokens : undefined,
									costUsd: typeof usage.cost === 'number' ? usage.cost : undefined,
								};
								yield { type: 'usage', value: finalUsage };
							}
						} catch {
							// ignore parse errors (non-JSON lines)
						}
					}
				}
			})();

			return { stream, raw: rawChunks, usage: finalUsage };
		} catch (error) {
			if (error instanceof X402PaymentRequiredError) {
				this._logService.error('[AiProviderService] x402 payment required', { headers: error.readonlyHeaders });
			}
			this._logService.error('[AiProviderService] Request failed', error);
			throw error;
		} finally {
			listener.dispose();
		}
	}

	private async _postJson(url: string, headers: Record<string, string>, body: unknown, token: CancellationToken): Promise<unknown> {
		const controller = new AbortController();
		const listener = token.onCancellationRequested(() => controller.abort());
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers,
				body: JSON.stringify(body),
				signal: controller.signal,
			});
			if (!response.ok) {
				const text = await response.text();
				throw new Error(`AI provider request failed (${response.status}): ${text}`);
			}
			return await response.json();
		} catch (error) {
			this._logService.error('[AiProviderService] Request failed', error);
			throw error;
		} finally {
			listener.dispose();
		}
	}
}

registerSingleton(IAiProviderService, AiProviderService, InstantiationType.Delayed);
registerSingleton(IMcpToolRouter, McpToolRouter, InstantiationType.Delayed);

