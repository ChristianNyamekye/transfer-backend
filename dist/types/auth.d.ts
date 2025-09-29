export interface User {
    id: string;
    email: string;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    kycStatus: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateUserRequest {
    email: string;
    password: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface LoginResponse {
    user: {
        id: string;
        email: string;
        name: string;
        phone?: string | null;
        kycStatus: 'not-started' | 'pending' | 'verified' | 'rejected';
        profileImage?: string | null;
        createdAt: string;
    };
    accessToken: string;
    refreshToken: string;
}
export interface JWTPayload {
    userId: string;
    email: string;
    type: 'access' | 'refresh';
    iat?: number;
    exp?: number;
}
export interface AuthenticatedRequest extends Request {
    user?: User;
}
//# sourceMappingURL=auth.d.ts.map