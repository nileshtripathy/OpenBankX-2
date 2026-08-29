import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { runAgent } from '../ai/agent';
import { env } from '../config/env';

/**
 * Streams the assistant's reply as Server-Sent Events. Each event is a
 * small JSON payload tagged with a `type` (see AgentEvent in ai/agent.ts)
 * so the frontend can render tool calls ("Checking your vault balance...")
 * distinctly from the assistant's actual prose as they happen, rather than
 * waiting for the whole multi-step turn to finish.
 */
export const chat = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  if (!env.ai.anthropicApiKey) {
    throw ApiError.badRequest('The AI assistant is not configured on this server (missing ANTHROPIC_API_KEY).');
  }

  const { message, history } = req.body as { message: string; history: { role: 'user' | 'assistant'; content: string }[] };

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable nginx buffering so tokens arrive as they're generated, not batched
  });
  res.write(': connected\n\n');

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15_000);
  let closed = false;
  req.on('close', () => {
    closed = true;
    clearInterval(heartbeat);
  });

  try {
    for await (const event of runAgent(req.user.userId, message, history)) {
      if (closed) break;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (err) {
    if (!closed) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: (err as Error).message })}\n\n`);
    }
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});
