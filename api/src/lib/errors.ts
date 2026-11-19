export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (m: string) => new AppError(400, m);
export const notFound = (m: string) => new AppError(404, m);
export const conflict = (m: string) => new AppError(409, m);
