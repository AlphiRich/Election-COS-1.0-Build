import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveAgentModel } from './agentModel';

const KEY = 'ANTHROPIC_API_KEY';
const MODEL = 'CAMPAIGN_DIRECTOR_MODEL';

describe('resolveAgentModel — fails closed on the credential', () => {
  let savedKey: string | undefined;
  let savedModel: string | undefined;

  beforeEach(() => {
    savedKey = process.env[KEY];
    savedModel = process.env[MODEL];
    delete process.env[KEY];
    delete process.env[MODEL];
  });
  afterEach(() => {
    if (savedKey === undefined) delete process.env[KEY];
    else process.env[KEY] = savedKey;
    if (savedModel === undefined) delete process.env[MODEL];
    else process.env[MODEL] = savedModel;
  });

  it('returns null when no API key is set (the agent then refuses)', () => {
    expect(resolveAgentModel()).toBeNull();
  });

  it('returns null for a blank/whitespace key', () => {
    process.env[KEY] = '   ';
    expect(resolveAgentModel()).toBeNull();
  });

  it('constructs a model with an invoke method when a key is present', () => {
    process.env[KEY] = 'sk-ant-test-not-a-real-key';
    const model = resolveAgentModel();
    expect(model).not.toBeNull();
    expect(typeof model!.invoke).toBe('function');
    // Construction must not reach the network — only an actual invoke would.
  });

  it('accepts a model-id override without a code change', () => {
    process.env[KEY] = 'sk-ant-test-not-a-real-key';
    process.env[MODEL] = 'claude-haiku-5-5';
    expect(resolveAgentModel()).not.toBeNull();
  });
});
