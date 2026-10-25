/** An error with an HTTP status; the central errorHandler responds with it. */
export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}
