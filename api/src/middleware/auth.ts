import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db/client";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

export interface AuthenticatedUser {
  id: string;
  email: string;
  orgId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user: AuthenticatedUser;
    }
  }
}

export async function auth(req: Request, res: Response, next: NextFunction) {
  try {
    const token =
      req.cookies?.["auth_token"] ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const secret = process.env["JWT_SECRET"];
    if (!secret) throw new Error("JWT_SECRET not configured");

    const payload = jwt.verify(token, secret) as {
      sub: string;
      email: string;
      orgId: string;
      role: string;
    };

    // Verify user still exists and is associated with the org
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.sub),
    });

    if (!user || user.organizationId !== payload.orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      orgId: payload.orgId,
      role: payload.role,
    };

    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

export function issueToken(user: { id: string; email: string; orgId: string; role: string }): string {
  const secret = process.env["JWT_SECRET"];
  if (!secret) throw new Error("JWT_SECRET not configured");

  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      orgId: user.orgId,
      role: user.role,
    },
    secret,
    { expiresIn: "7d" },
  );
}
