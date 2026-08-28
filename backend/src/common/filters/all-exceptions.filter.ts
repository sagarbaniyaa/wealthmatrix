import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      res.status(status).json({
        statusCode: status,
        path: req.url,
        message: this.extractMessage(exception),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (exception instanceof QueryFailedError) {
      const pgError = exception as any;
      const status = this.mapPgErrorToStatus(pgError.code);
      res.status(status).json({
        statusCode: status,
        path: req.url,
        message: this.friendlyPgMessage(pgError),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : exception);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      path: req.url,
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }

  private extractMessage(exception: HttpException): string {
    const response = exception.getResponse();
    if (typeof response === 'string') return response;
    if (response && typeof response === 'object') {
      const msg = (response as any).message;
      if (Array.isArray(msg)) return msg.join(', ');
      if (typeof msg === 'string') return msg;
    }
    return exception.message;
  }

  private mapPgErrorToStatus(code: string): number {
    switch (code) {
      case '23505':
        return HttpStatus.CONFLICT;
      case '23514':
      case '23502':
      case '23503':
        return HttpStatus.BAD_REQUEST;
      case '42501':
        return HttpStatus.FORBIDDEN;
      default:
        return HttpStatus.BAD_REQUEST;
    }
  }

  private friendlyPgMessage(pgError: any): string {
    switch (pgError.code) {
      case '23505':
        return 'A record with these values already exists.';
      case '23514':
        return 'This change violates a data integrity rule (e.g. ownership % range, date range).';
      case '23503':
        return 'Referenced record does not exist.';
      case '42501':
        return 'Not permitted to access or modify this record.';
      default:
        return 'Invalid request.';
    }
  }
}