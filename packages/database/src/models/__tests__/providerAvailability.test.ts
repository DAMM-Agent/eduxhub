// @vitest-environment node
import { and, eq } from 'drizzle-orm';
import {
  isModelProvider,
  SUPPORTED_MODEL_PROVIDERS,
  UnsupportedModelProviderError,
} from 'model-bank';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { AiInfraRepos } from '../../repositories/aiInfra';
import { aiModels, aiProviders, messages, users, workspaces } from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { AiModelModel } from '../aiModel';
import { AiProviderModel } from '../aiProvider';

const db: LobeChatDatabase = await getTestDB();
const userId = 'provider-availability-user';
const otherId = 'provider-availability-other';
const workspaceId = 'provider-availability-workspace';
const providers = new AiProviderModel(db, userId);
const models = new AiModelModel(db, userId);

beforeEach(async () => {
  await db.insert(users).values([{ id: userId }, { id: otherId }]);
  await db
    .insert(workspaces)
    .values({ id: workspaceId, name: 'Providers', primaryOwnerId: userId, slug: workspaceId });
  await db.insert(aiProviders).values([
    ...SUPPORTED_MODEL_PROVIDERS.map((id) => ({
      id,
      userId,
      enabled: true,
      keyVaults: `key-${id}`,
      source: 'builtin' as const,
    })),
    { id: 'google', userId, enabled: true, keyVaults: 'retired-secret' },
    {
      id: 'custom-provider',
      userId,
      enabled: true,
      keyVaults: 'custom-secret',
      settings: { sdkType: 'openai' },
    },
    { id: 'openai', userId: otherId, keyVaults: 'other-user-secret' },
    { id: 'volcengine', userId: otherId, workspaceId, keyVaults: 'workspace-secret' },
    { id: 'google', userId: otherId, workspaceId, keyVaults: 'workspace-retired-secret' },
  ]);
  await db.insert(aiModels).values([
    { id: 'retained-model', providerId: 'openai', userId, enabled: true },
    { id: 'legacy-model', providerId: 'google', userId, enabled: true },
    { id: 'legacy-custom', providerId: 'custom-provider', userId, enabled: true },
    { id: 'other-model', providerId: 'openai', userId: otherId, enabled: true },
    {
      id: 'workspace-model',
      providerId: 'volcengine',
      userId: otherId,
      workspaceId,
      enabled: true,
    },
  ]);
});

afterEach(async () => {
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
  await db.delete(users).where(eq(users.id, userId));
  await db.delete(users).where(eq(users.id, otherId));
});

describe('provider availability across saved data', () => {
  it('filters personal lists before decrypting and preserves user isolation', async () => {
    const decrypt = vi.fn(async (key: string | null) => ({ apiKey: key }));
    const state = await providers.getAiProviderRuntimeConfig(decrypt);
    expect(Object.keys(state).sort()).toEqual([...SUPPORTED_MODEL_PROVIDERS].sort());
    expect(decrypt.mock.calls.map(([key]) => key).sort()).toEqual(
      SUPPORTED_MODEL_PROVIDERS.map((id) => `key-${id}`).sort(),
    );
    expect((await providers.query()).every(({ id }) => isModelProvider(id))).toBe(true);
    expect((await providers.getAiProviderList()).map(({ id }) => id).sort()).toEqual(
      [...SUPPORTED_MODEL_PROVIDERS].sort(),
    );
    expect((await models.getAllModels()).map(({ id }) => id)).toEqual(['retained-model']);
    expect(await models.findById('legacy-model')).toBeUndefined();
  });

  it('keeps workspace sharing while hiding retired workspace providers', async () => {
    const scoped = new AiProviderModel(db, userId, workspaceId);
    const decrypt = vi.fn(async (key: string | null) => ({ apiKey: key }));
    expect(Object.keys(await scoped.getAiProviderRuntimeConfig(decrypt))).toEqual(['volcengine']);
    expect(decrypt).toHaveBeenCalledExactlyOnceWith('workspace-secret');
    expect(
      (await new AiModelModel(db, userId, workspaceId).getAllModels()).map(({ id }) => id),
    ).toEqual(['workspace-model']);
  });

  it.each(['google', 'custom-provider', 'volcenginecodingplan'])(
    'rejects %s reads, writes and batch activation before decryption',
    async (id) => {
      const decrypt = vi.fn();
      await expect(providers.getAiProviderById(id, decrypt)).rejects.toThrow(
        UnsupportedModelProviderError,
      );
      await expect(providers.create({ id, name: id, source: 'custom' })).rejects.toThrow(
        UnsupportedModelProviderError,
      );
      await expect(
        providers.updateConfig(id, { keyVaults: { apiKey: 'new' } }, undefined, decrypt),
      ).rejects.toThrow(UnsupportedModelProviderError);
      await expect(providers.toggleProviderEnabled(id, true)).rejects.toThrow(
        UnsupportedModelProviderError,
      );
      await expect(
        providers.updateOrder([
          { id: 'openai', sort: 9 },
          { id, sort: 0 },
        ]),
      ).rejects.toThrow(UnsupportedModelProviderError);
      await expect(models.batchToggleAiModels(id, ['legacy-model'], true)).rejects.toThrow(
        UnsupportedModelProviderError,
      );
      await expect(models.batchUpdateAiModels(id, [])).rejects.toThrow(
        UnsupportedModelProviderError,
      );
      await expect(models.create({ id: 'new-model', providerId: id })).rejects.toThrow(
        UnsupportedModelProviderError,
      );
      expect(decrypt).not.toHaveBeenCalled();
      const [untouched] = await db
        .select()
        .from(aiProviders)
        .where(and(eq(aiProviders.id, 'openai'), eq(aiProviders.userId, userId)));
      expect(untouched.sort).toBeNull();
    },
  );

  it('does not reintroduce legacy models through the merged runtime state', async () => {
    const repo = new AiInfraRepos(db, userId, {});
    const state = await repo.getAiProviderRuntimeState(async () => ({}));
    expect(state.enabledAiProviders.map(({ id }) => id).sort()).toEqual(
      [...SUPPORTED_MODEL_PROVIDERS].sort(),
    );
    expect(
      state.enabledAiModels.some(
        ({ providerId }) => providerId === 'google' || providerId === 'custom-provider',
      ),
    ).toBe(false);
    await expect(
      AiInfraRepos.tryMatchingProviderFrom(state, {
        modelId: 'legacy-model',
        fallbackProvider: 'google',
      }),
    ).rejects.toThrow(UnsupportedModelProviderError);
  });

  it('preserves historical messages and stored rows when a provider is refused', async () => {
    const messageId = 'provider-availability-message';
    await db.insert(messages).values({
      id: messageId,
      userId,
      role: 'assistant',
      content: 'Historic answer',
      model: 'legacy-model',
      provider: 'google',
    });
    await expect(providers.findById('google')).rejects.toThrow(UnsupportedModelProviderError);
    const [history] = await db.select().from(messages).where(eq(messages.id, messageId));
    const [savedProvider] = await db
      .select()
      .from(aiProviders)
      .where(and(eq(aiProviders.id, 'google'), eq(aiProviders.userId, userId)));
    expect(history.content).toBe('Historic answer');
    expect(savedProvider.keyVaults).toBe('retired-secret');
  });
});
