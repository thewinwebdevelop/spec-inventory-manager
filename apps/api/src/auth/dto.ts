// F-001 · T-001-07 — auth DTOs (class-validator). api-spec §2.
// Validation runs via a global ValidationPipe (whitelist + transform); a bad
// shape → 422 before any credential work (consistent with the enumeration-safe
// error model). deviceId is bounded (M-8): max 64, charset [A-Za-z0-9_-].
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class SignupDto {
  @IsString()
  @IsEmail({}, { message: "EMAIL_INVALID" })
  @MaxLength(254)
  email!: string;

  // Length/breached policy is enforced in the service via the core-domain
  // policy fn (so the 422 code is PASSWORD_TOO_SHORT/BREACHED, not a generic
  // class-validator message). Here we only assert it is a non-empty string.
  @IsString()
  @MinLength(1)
  password!: string;
}

export class LoginDto {
  @IsString()
  @IsEmail({}, { message: "EMAIL_INVALID" })
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: "DEVICE_ID_INVALID" })
  deviceId?: string;

  @IsOptional()
  @IsIn(["cookie", "body"], { message: "TOKEN_TRANSPORT_INVALID" })
  tokenTransport?: "cookie" | "body";
}

export class RefreshDto {
  // Body transport (mobile). Cookie transport supplies the token via omni_rt.
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: "DEVICE_ID_INVALID" })
  deviceId?: string;
}

export class LogoutDto {
  // Body transport refresh token (mobile) — optional; cookie path uses omni_rt.
  @IsOptional()
  @IsString()
  refreshToken?: string;

  // Optional per-device logout of a LISTED non-current family (M-3 ownership).
  @IsOptional()
  @IsString()
  familyId?: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(1)
  newPassword!: string;

  // Optional mobile refresh token to identify the current family to spare (N-1).
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class AdminResetDto {
  @IsString()
  @MinLength(1)
  newPassword!: string;
}
