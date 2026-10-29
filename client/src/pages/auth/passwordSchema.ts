import { z } from 'zod';

/** Mirrors the server's password rule (server/src/utils/validators.ts). */
export const strongPassword = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Z]/, 'Add an uppercase letter')
  .regex(/[a-z]/, 'Add a lowercase letter')
  .regex(/[0-9]/, 'Add a number');
