import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "AUTH_ERROR"
  | "PERMISSION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "CONNECTOR_ERROR"
  | "PROVIDER_ERROR"
  | "SYNC_ERROR"
  | "IMPORT_ERROR"
  | "CALCULATION_ERROR"
  | "REPORT_ERROR"
  | "DATABASE_ERROR"
  | "UNKNOWN_ERROR";

export class ApiError extends Error {
  status: number;
  code: ApiErrorCode;
  action?: string;
  details?: unknown;

  constructor(status: number, code: ApiErrorCode, message: string, options: { action?: string; details?: unknown } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.action = options.action;
    this.details = options.details;
  }
}

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      startedAt?: number;
    }
  }
}

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header("x-correlation-id") ?? req.header("x-request-id");
  req.correlationId = incoming?.trim() || randomUUID();
  req.startedAt = Date.now();
  res.setHeader("x-correlation-id", req.correlationId);
  next();
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, "NOT_FOUND", `Route introuvable: ${req.method} ${req.path}`, { action: "Vérifier l'URL ou la documentation API." }));
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  const apiError = error instanceof ApiError ? error : new ApiError(500, "UNKNOWN_ERROR", error instanceof Error ? error.message : "Erreur inattendue");
  const payload: Record<string, unknown> = {
    code: apiError.code,
    message: apiError.message,
    correlationId: req.correlationId
  };

  if (apiError.action) payload.action = apiError.action;
  if (process.env.NODE_ENV !== "production" && apiError.details) payload.details = apiError.details;

  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "error",
    service: "api",
    route: req.path,
    method: req.method,
    correlationId: req.correlationId,
    durationMs: req.startedAt ? Date.now() - req.startedAt : undefined,
    errorCode: apiError.code,
    message: apiError.message
  }));

  res.status(apiError.status).json(payload);
}

