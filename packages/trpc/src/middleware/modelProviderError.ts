import { isObjectLike } from '@lobechat/utils/object';
import { TRPCError } from '@trpc/server';

import { trpc } from '../lambda/init';

/** Saved configurations and background calls can bypass a router's input schema. */
export const modelProviderError = trpc.middleware(async ({ next }) => {
  const result = await next();
  if (result.ok || result.error.code !== 'INTERNAL_SERVER_ERROR') return result;

  let cause: unknown = result.error.cause;
  for (let depth = 0; isObjectLike(cause) && depth < 5; depth++) {
    if (cause.errorType === 'UnsupportedProvider') {
      throw new TRPCError({
        cause: result.error,
        code: 'BAD_REQUEST',
        message:
          'UnsupportedProvider: this model provider is no longer supported. Select a supported provider.',
      });
    }
    cause = cause.cause;
  }

  return result;
});
