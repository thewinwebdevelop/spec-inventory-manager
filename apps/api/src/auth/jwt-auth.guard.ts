// F-001 · T-001-04 — JwtAuthGuard. arch §2.2 (§7 tech stack: guard is the single
// choke-point that populates req.user). Reads `Authorization: Bearer <access>`,
// verifies via AccessTokenService (alg + typ pinned), and sets
// `req.user = { userId }`. NO DB I/O on the hot path (arch §2.2).
//
// Used by endpoints 5/6/7/8 (logout-all, sessions, change-password, admin-reset).
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { AccessTokenService } from "./access-token.service";

/** The authenticated principal F-001 proves — userId only (arch §1.1). */
export interface AuthPrincipal {
  userId: string;
}

/** Express request augmented with the authenticated principal. */
export interface AuthedRequest extends Request {
  user?: AuthPrincipal;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly accessTokens: AccessTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new UnauthorizedException({ error: { code: "UNAUTHENTICATED", message: "ต้องเข้าสู่ระบบ" } });
    }
    const token = header.slice("Bearer ".length).trim();
    try {
      const claims = this.accessTokens.verify(token);
      req.user = { userId: claims.sub };
      return true;
    } catch {
      throw new UnauthorizedException({ error: { code: "UNAUTHENTICATED", message: "ต้องเข้าสู่ระบบ" } });
    }
  }
}
