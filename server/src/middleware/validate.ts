import { Request, Response, NextFunction } from 'express';
import { ZodType, ZodError } from 'zod';

export const validate = (schema: ZodType) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors,
        });
        return;
      }

      next(error);
    }
  };
};
