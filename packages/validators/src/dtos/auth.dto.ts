import 'reflect-metadata';

import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

import type { LoginRequest, RegisterRequest } from '../types/auth';

export class RegisterRequestDto implements RegisterRequest {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class LoginRequestDto implements LoginRequest {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
