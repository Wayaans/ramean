import test from "node:test";
import assert from "node:assert/strict";
import {
  getWorkingIndicatorState,
  setDispatchWorkingIndicator,
  setMinimalModeWorkingIndicator,
} from "../UI/working-indicator.js";

function createCtx(): { calls: Array<{ frames?: string[]; intervalMs?: number } | undefined>; ctx: any } {
  const calls: Array<{ frames?: string[]; intervalMs?: number } | undefined> = [];
  return {
    calls,
    ctx: {
      ui: {
        theme: {
          fg(_token: string, text: string) {
            return text;
          },
        },
        setWorkingIndicator(options?: { frames?: string[]; intervalMs?: number }) {
          calls.push(options);
        },
      },
    },
  };
}

test("minimal mode working indicator uses a subtle animated pulse", () => {
  const { ctx, calls } = createCtx();
  setDispatchWorkingIndicator(ctx, false);
  setMinimalModeWorkingIndicator(ctx, false);
  calls.length = 0;

  setMinimalModeWorkingIndicator(ctx, true);

  assert.equal(getWorkingIndicatorState().minimalMode, true);
  assert.deepEqual(calls.at(-1)?.frames, ["·", "•", "●", "•"]);
  assert.equal(calls.at(-1)?.intervalMs, 140);
});

test("dispatch indicator overrides minimal mode and restores it when dispatches finish", () => {
  const { ctx, calls } = createCtx();
  setDispatchWorkingIndicator(ctx, false);
  setMinimalModeWorkingIndicator(ctx, false);
  calls.length = 0;

  setMinimalModeWorkingIndicator(ctx, true);
  setDispatchWorkingIndicator(ctx, true);

  assert.equal(getWorkingIndicatorState().dispatch, true);
  assert.deepEqual(calls.at(-1)?.frames, ["⚏", "⚍", "⚎", "⚌"]);
  assert.equal(calls.at(-1)?.intervalMs, 100);

  setDispatchWorkingIndicator(ctx, false);
  assert.deepEqual(calls.at(-1)?.frames, ["·", "•", "●", "•"]);

  setMinimalModeWorkingIndicator(ctx, false);
  assert.equal(calls.at(-1), undefined);
});
