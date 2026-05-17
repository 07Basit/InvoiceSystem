import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ApiResponse } from 'shared';

type ValidateTarget = 'body' | 'query' | 'params';

export const validate = (schema: ZodSchema, target: ValidateTarget = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const dataToValidate = target === 'body' ? req.body : target === 'query' ? req.query : req.params;
    const result = schema.safeParse(dataToValidate);
    if (!result.success) {
      const details = formatZodErrors(result.error);
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details },
        meta: null,
      };
      res.status(400).json(response);
      return;
    }

    if (target === 'body') {
      req.body = result.data;
    } else if (target === 'query') {
      Object.assign(req.query as Record<string, unknown>, result.data as Record<string, unknown>);
    } else {
      Object.assign(req.params as Record<string, unknown>, result.data as Record<string, unknown>);
    }

    next();
  };
};

function formatZodErrors(error: ZodError): Record<string, string[]> {
  return error.issues.reduce<Record<string, string[]>>((acc, issue) => {
    const key = issue.path.join('.') || 'root';
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(issue.message);
    return acc;
  }, {});
}
