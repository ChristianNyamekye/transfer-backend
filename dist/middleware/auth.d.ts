import { Request, Response, NextFunction } from 'express';
import { JWTPayload, User } from '@/types/auth';
declare global {
    namespace Express {
        interface Request {
            user?: User;
        }
    }
}
export declare const generateTokens: (userId: string, email: string) => {
    accessToken: string;
    refreshToken: string;
};
export declare const verifyToken: (token: string) => JWTPayload;
export declare const authenticate: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const optionalAuth: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const requireKYC: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const requireEmailVerification: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=auth.d.ts.map