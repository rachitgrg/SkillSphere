import { IUser } from './index';

// Passport already declares `Express.Request.user?: Express.User`.
// Make that user our Mongoose user document so `req.user` is typed everywhere.
declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends IUser {}
  }
}

export {};
