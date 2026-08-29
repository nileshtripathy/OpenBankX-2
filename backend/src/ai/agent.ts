import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import { toolDefinitions, executeTool } from './tools';
import { buildRagContext } from './rag';

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env.ai.anthropicApiKey });
  return client;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Events streamed back to the HTTP layer (SSE) as the agent works. */
export type AgentEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_start'; tool: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool: string; result: unknown }
  | { type: 'done'; stepCount: number }
  | { type: 'error'; message: string };

const SYSTEM_PROMPT = `You are the OpenBankX assistant, built into a personal finance app that unifies a
traditional bank account and a crypto vault in one dashboard.

Rules:
- For anything about the user's own balances, accounts, or transactions, ALWAYS call the
  relevant tool rather than guessing or using a number from earlier in the conversation -
  balances change, and a stale guess is worse than admitting you need to check.
- If a tool returns an "error" field (e.g. no wallet linked), relay that plainly to the user
  and suggest the fix (e.g. "link a wallet from Settings first") rather than making up a number.
- For general "how does X work" questions, use the reference material provided below if it's
  relevant. If nothing relevant was retrieved, answer from general knowledge but say so isn't
  specific to OpenBankX.
- Keep answers concise - a sentence or two plus the concrete number, not a report.
- Never invent transaction hashes, addresses, or amounts. Every number in your answer must come
  from a tool result.`;

/**
 * Runs the agent to completion for one user turn, yielding events as they
 * happen so the HTTP layer can stream them out over SSE in real time. This
 * is the multi-step part: after a tool call, the loop feeds the tool's
 * result back to the model and asks it to continue, repeating until the
 * model produces a final answer with no further tool calls - bounded by
 * `maxAgentSteps` so a confused model can't loop forever.
 */
export async function* runAgent(
  userId: string,
  message: string,
  history: ChatMessage[]
): AsyncGenerator<AgentEvent> {
  if (!env.ai.anthropicApiKey) {
    yield { type: 'error', message: 'The AI assistant is not configured on this server.' };
    return;
  }

  const ragContext = await buildRagContext(message);
  const system = ragContext
    ? `${SYSTEM_PROMPT}\n\n--- Reference material relevant to this question ---\n${ragContext}`
    : SYSTEM_PROMPT;

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: message },
  ];

  const anthropic = getClient();
  let step = 0;

  while (step < env.ai.maxAgentSteps) {
    step++;

    const stream = anthropic.messages.stream({
      model: env.ai.model,
      max_tokens: env.ai.maxTokens,
      system,
      messages,
      tools: toolDefinitions as unknown as Anthropic.Tool[],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { type: 'text', delta: event.delta.text };
      }
    }

    const finalMessage = await stream.finalMessage();
    messages.push({ role: 'assistant', content: finalMessage.content });

    if (finalMessage.stop_reason !== 'tool_use') {
      yield { type: 'done', stepCount: step };
      return;
    }

    const toolUseBlocks = finalMessage.content.filter(
      (b: Anthropic.ContentBlock): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      yield { type: 'tool_start', tool: block.name, input: block.input as Record<string, unknown> };
      let result: unknown;
      try {
        result = await executeTool(block.name, block.input as Record<string, unknown>, { userId });
      } catch (err) {
        result = { error: (err as Error).message };
      }
      yield { type: 'tool_result', tool: block.name, result };
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  yield {
    type: 'error',
    message: `Reached the maximum of ${env.ai.maxAgentSteps} steps without a final answer.`,
  };
}

/** Consumes the agent generator to completion and returns the final text - used by the eval harness and anywhere else a non-streamed result is more convenient than SSE. */
export async function runAgentToCompletion(
  userId: string,
  message: string,
  history: ChatMessage[] = []
): Promise<{ text: string; toolsCalled: string[] }> {
  let text = '';
  const toolsCalled: string[] = [];

  for await (const event of runAgent(userId, message, history)) {
    if (event.type === 'text') text += event.delta;
    if (event.type === 'tool_start') toolsCalled.push(event.tool);
    if (event.type === 'error') throw new Error(event.message);
  }

  return { text, toolsCalled };
}
