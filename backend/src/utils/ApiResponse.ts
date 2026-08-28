import { Response } from 'express';

export class ApiResponse {
  static send<T>(
    res: Response,
    statusCode: number,
    data: T,
    message = 'Success'
  ) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }
}
