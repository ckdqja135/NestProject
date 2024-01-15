import { Catch, HttpException } from '@nestjs/common';

@Catch(HttpException)
export class HttpExceptionFilter {
  catch(exception, host) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const status = exception.getStatus();
    const err = exception.getResponse() as
      | string
      | { error: string; statusCode: 400; message: string[] }; // calss-alidator

    if (typeof err !== 'string' && err.error === 'Bad Request') {
      return response.status(status).json({
        success: false,
        code: status,
        data: err.message,
      });
    }

    response.status(status).json({
      success: false,
      code: status,
      data: err,
    });
    // response.status(status).json({
    //   statusCode: status,
    //   timestamp: new Date().toISOString(),
    //   path: request.url,
    // });
  }
}
