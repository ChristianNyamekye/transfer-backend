import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
export declare const validate: (schema: Joi.ObjectSchema) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const schemas: {
    register: Joi.ObjectSchema<any>;
    login: Joi.ObjectSchema<any>;
    passwordResetRequest: Joi.ObjectSchema<any>;
    passwordReset: Joi.ObjectSchema<any>;
    createTransfer: Joi.ObjectSchema<any>;
    addCurrencyWallet: Joi.ObjectSchema<any>;
};
export declare const isValidEmail: (email: string) => boolean;
export declare const isValidPhone: (phone: string) => boolean;
export declare const isStrongPassword: (password: string) => boolean;
//# sourceMappingURL=validation.d.ts.map