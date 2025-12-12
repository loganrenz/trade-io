/**
 * tRPC API Handler for Nuxt
 * Handles all tRPC requests via /api/trpc/*
 */
import { createNuxtApiHandler } from 'trpc-nuxt';
import { appRouter } from '../../trpc/routers/_app';
import { createContext } from '../../trpc/context';

export default createNuxtApiHandler({
  router: appRouter,
  createContext,
  onError({ error, type, path, input, ctx }) {
    ctx.logger.error(
      {
        error,
        type,
        path,
        input,
        requestId: ctx.requestId,
      },
      'tRPC error occurred'
    );
  },
});
