export class AppError extends Error {
  readonly statusCode: number;
  readonly details: Record<string, unknown>;

  constructor(message: string, statusCode: number, details: Record<string, unknown> = {}) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
