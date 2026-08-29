/**
 * Runs the eval set defined in cases.ts against the live agent (real
 * Anthropic API calls - this costs a small amount of money to run, it's
 * not mocked). Requires a seeded user with a linked bank account and
 * wallet to exercise the tool-calling cases meaningfully; without one,
 * tool-selection cases can still pass (the model still calls the tool),
 * but it'll get an "error" result back instead of real data.
 *
 * Usage:
 *   npx ts-node src/ai/evals/run.ts user@example.com
 */
import { connectDB, disconnectDB } from '../../config/db';
import { User } from '../../models/User';
import { runAgentToCompletion } from '../agent';
import { evalCases } from './cases';

interface Result {
  id: string;
  passed: boolean;
  reason: string;
  answer: string;
  toolsCalled: string[];
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: ts-node src/ai/evals/run.ts <user-email>');
    process.exit(1);
  }

  await connectDB();
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    console.error(`No user found with email "${email}"`);
    await disconnectDB();
    process.exit(1);
  }

  const results: Result[] = [];

  for (const testCase of evalCases) {
    process.stdout.write(`Running "${testCase.id}"... `);
    try {
      const { text, toolsCalled } = await runAgentToCompletion(
        user._id.toString(),
        testCase.prompt
      );

      let passed = true;
      const reasons: string[] = [];

      if (testCase.expectAnyTool) {
        const toolOk = testCase.expectAnyTool.some((t) => toolsCalled.includes(t));
        if (!toolOk) {
          passed = false;
          reasons.push(`expected one of [${testCase.expectAnyTool.join(', ')}] to be called, got [${toolsCalled.join(', ') || 'none'}]`);
        }
      }

      if (testCase.expectAnySubstring) {
        const lower = text.toLowerCase();
        const substringOk = testCase.expectAnySubstring.some((s) => lower.includes(s.toLowerCase()));
        if (!substringOk) {
          passed = false;
          reasons.push(`expected answer to mention one of [${testCase.expectAnySubstring.join(', ')}]`);
        }
      }

      results.push({
        id: testCase.id,
        passed,
        reason: reasons.join('; '),
        answer: text,
        toolsCalled,
      });
      console.log(passed ? 'PASS' : 'FAIL');
    } catch (err) {
      results.push({
        id: testCase.id,
        passed: false,
        reason: (err as Error).message,
        answer: '',
        toolsCalled: [],
      });
      console.log('ERROR');
    }
  }

  console.log('\n--- Eval report ---');
  for (const r of results) {
    console.log(`\n[${r.passed ? 'PASS' : 'FAIL'}] ${r.id}`);
    if (!r.passed) console.log(`  reason: ${r.reason}`);
    console.log(`  tools called: ${r.toolsCalled.join(', ') || '(none)'}`);
    console.log(`  answer: ${r.answer.slice(0, 160)}${r.answer.length > 160 ? '...' : ''}`);
  }

  const passCount = results.filter((r) => r.passed).length;
  console.log(`\n${passCount}/${results.length} passed`);

  await disconnectDB();
  process.exit(passCount === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error('Eval run failed:', err);
  process.exit(1);
});
