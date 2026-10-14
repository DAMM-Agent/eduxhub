import { TRPCError } from '@trpc/server';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { assertModelProvider, ModelProviderSchema } from 'model-bank/modelProvider';
import { describe, expect, it } from 'vitest';

import { publicProcedure, router } from '../lambda';
import { createContextInner } from '../lambda/context';

const appRouter = router({
  savedProvider: publicProcedure.query(() => {
    assertModelProvider('google');
  }),
  selectedProvider: publicProcedure.input(ModelProviderSchema).query(({ input }) => input),
  unexpectedError: publicProcedure.query(() => {
    throw new Error('unexpected failure');
  }),
  forbidden: publicProcedure.query(() => {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
  }),
});

const request = (path: string) =>
  fetchRequestHandler({
    createContext: () => createContextInner(),
    endpoint: '/trpc',
    req: new Request(`http://localhost/trpc/${path}`),
    router: appRouter,
  });

describe('provider rejection at the tRPC HTTP boundary', () => {
  it.each([
    'savedProvider',
    `selectedProvider?input=${encodeURIComponent(JSON.stringify({ json: 'google' }))}`,
  ])('returns HTTP 400 for %s', async (path) => {
    const response = await request(path);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: {
        json: {
          message: expect.stringContaining('UnsupportedProvider'),
          data: { code: 'BAD_REQUEST' },
        },
      },
    });
  });

  it('accepts a retained provider', async () => {
    const response = await request(
      `selectedProvider?input=${encodeURIComponent(JSON.stringify({ json: 'volcengine' }))}`,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ result: { data: { json: 'volcengine' } } });
  });

  it.each([
    ['unexpectedError', 500],
    ['forbidden', 403],
  ] as const)('preserves the status for %s', async (path, status) => {
    expect((await request(path)).status).toBe(status);
  });
});
