import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { config } from '../config';
import { ApiResponse } from 'shared';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    logger.warn('Known application error', {
      code: err.code,
      statusCode: err.statusCode,
      message: err.message,
      path: req.path,
      method: req.method,
    });

    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: { code: err.code, message: err.message },
      meta: null,
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // a unique rule of the database was hit that no check caught first: say so plainly instead of a server error
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    logger.warn('Unique value already exists', { target: err.meta?.['target'], path: req.path, method: req.method });
    const response: ApiResponse<null> = { success: false, data: null, error: { code: 'ALREADY_EXISTS', message: 'That value already exists.' }, meta: null };
    res.status(409).json(response);
    return;
  }

  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  const response: ApiResponse<null> = {
    success: false,
    data: null,
    error: {
      code: 'INTERNAL_ERROR',
      message: config.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
    },
    meta: null,
  };
  res.status(500).json(response);
};
