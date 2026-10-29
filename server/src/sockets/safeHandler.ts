/**
 * Wraps a socket event handler so a thrown error (a database hiccup during a read receipt, say) is
 * logged and acknowledged with `{ ok: false }` instead of becoming an unhandled rejection.
 * By convention the ack callback, when the client sent one, is the handler's last argument.
 */
export const safeHandler =
  <A extends unknown[]>(event: string, handler: (...args: A) => unknown) =>
  async (...args: A): Promise<void> => {
    try {
      await handler(...args);
    } catch (error) {
      console.error(`Socket handler "${event}" failed:`, error);
      const ack = args[args.length - 1];
      if (typeof ack === 'function') ack({ ok: false, error: 'Something went wrong. Please try again.' });
    }
  };
