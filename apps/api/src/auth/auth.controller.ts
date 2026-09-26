import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { authService } from '@packages/auth';
import {
  authUserSchema,
  loginResponseSchema,
  LoginRequestDto,
  ok,
  RegisterRequestDto,
  type ApiEnvelope,
  type AuthUser,
  type LoginResponse,
} from '@packages/validators';

import { AuthGuard } from './auth.guard';
import { AuthToken, CurrentUser } from './current-user.decorator';

type AuthedRequest = Request & { user?: AuthUser; authToken?: string };

@Controller('auth')
export class AuthController {
  @Post('register')
  async register(@Body() body: RegisterRequestDto): Promise<ApiEnvelope<AuthUser>> {
    const user = await authService.register(body);
    return ok(authUserSchema.parse(user));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginRequestDto,
    @Req() request: AuthedRequest,
  ): Promise<ApiEnvelope<LoginResponse>> {
    const userAgent = request.headers['user-agent'];
    const response = await authService.login(body, {
      authAgent: typeof userAgent === 'string' ? userAgent : null,
      ipAddress: request.ip ?? null,
    });
    return ok(loginResponseSchema.parse(response));
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  async logout(@AuthToken() token: string): Promise<ApiEnvelope<null>> {
    await authService.logout(token);
    return ok(null);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthUser): ApiEnvelope<AuthUser> {
    return ok(authUserSchema.parse(user));
  }
}
