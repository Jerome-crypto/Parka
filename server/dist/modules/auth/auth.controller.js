"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.forgotPassword = exports.getMe = exports.refresh = exports.logout = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const zod_1 = require("zod");
const database_1 = require("../../config/database");
const appError_1 = require("../../utils/appError");
const jwt_1 = require("../../utils/jwt");
const email_1 = require("../../utils/email");
const env_1 = require("../../config/env");
// Registration Validation Schema
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters'),
    email: zod_1.z.string().email('Invalid email address'),
    phone: zod_1.z.string().optional(),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    role: zod_1.z.enum(['DRIVER', 'OPERATOR', 'ATTENDANT']),
    // Additional Operator fields
    companyName: zod_1.z.string().optional(),
    businessLicense: zod_1.z.string().optional(),
    // Additional Attendant fields
    facilityId: zod_1.z.string().uuid().optional(),
    shiftInfo: zod_1.z.string().optional(),
});
// Login Validation Schema
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
// Forgot Password Validation Schema
const forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
});
// Reset Password Validation Schema
const resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string(),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
});
const register = async (req, res, next) => {
    try {
        const validated = registerSchema.parse(req.body);
        // 1. Check if email already exists
        const userExists = await (0, database_1.query)('SELECT id FROM users WHERE email = $1', [validated.email]);
        if (userExists.rows.length > 0) {
            return next(new appError_1.AppError('A user with this email address already exists.', 400));
        }
        // 2. Fetch Role ID
        const roleRes = await (0, database_1.query)('SELECT id FROM roles WHERE name = $1', [validated.role]);
        if (roleRes.rows.length === 0) {
            return next(new appError_1.AppError('Invalid role specified.', 400));
        }
        const roleId = roleRes.rows[0].id;
        // 3. Hash password
        const hashedPassword = await bcryptjs_1.default.hash(validated.password, 10);
        // 4. Create User
        const userRes = await (0, database_1.query)(`INSERT INTO users (role_id, name, email, phone, password_hash, is_verified, status)
       VALUES ($1, $2, $3, $4, $5, false, 'active')
       RETURNING id, name, email, phone, status`, [roleId, validated.name, validated.email, validated.phone || null, hashedPassword]);
        const user = userRes.rows[0];
        // 5. Create Profile according to role
        if (validated.role === 'DRIVER') {
            await (0, database_1.query)('INSERT INTO driver_profiles (user_id) VALUES ($1)', [user.id]);
        }
        else if (validated.role === 'OPERATOR') {
            await (0, database_1.query)('INSERT INTO operator_profiles (user_id, company_name, business_license) VALUES ($1, $2, $3)', [user.id, validated.companyName || null, validated.businessLicense || null]);
        }
        else if (validated.role === 'ATTENDANT') {
            await (0, database_1.query)('INSERT INTO attendant_profiles (user_id, facility_id, shift_info) VALUES ($1, $2, $3)', [user.id, validated.facilityId || null, validated.shiftInfo || null]);
        }
        // 6. Generate Tokens
        const accessToken = (0, jwt_1.generateAccessToken)({ userId: user.id, role: validated.role });
        const refreshToken = (0, jwt_1.generateRefreshToken)({ userId: user.id, role: validated.role });
        // 7. Store Refresh Token in DB
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
        await (0, database_1.query)('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)', [user.id, refreshToken, expiresAt]);
        // 8. Generate Email verification token
        const verificationToken = crypto_1.default.randomBytes(32).toString('hex');
        await (0, database_1.query)('UPDATE users SET verification_token = $1 WHERE id = $2', [verificationToken, user.id]);
        // Send Simulated Verification Email
        const verifyUrl = `${env_1.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
        await (0, email_1.sendEmail)({
            to: user.email,
            subject: 'Verify your Parka account',
            text: `Welcome to Parka, ${user.name}! Please verify your account by visiting: ${verifyUrl}`,
            html: `<p>Welcome to Parka, ${user.name}!</p><p>Please click <a href="${verifyUrl}">here</a> to verify your account.</p>`,
        });
        res.status(201).json({
            status: 'success',
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: validated.role,
                    status: user.status,
                },
                accessToken,
                refreshToken,
            },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
};
exports.register = register;
const login = async (req, res, next) => {
    try {
        const validated = loginSchema.parse(req.body);
        // 1. Get user details
        const userRes = await (0, database_1.query)(`SELECT u.id, u.name, u.email, u.phone, u.password_hash, u.status, r.name as role,
              ap.facility_id as "facilityId", ap.shift_info as "shiftInfo",
              f.name as "facilityName"
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN attendant_profiles ap ON u.id = ap.user_id
       LEFT JOIN parking_facilities f ON ap.facility_id = f.id
       WHERE u.email = $1`, [validated.email]);
        if (userRes.rows.length === 0) {
            return next(new appError_1.AppError('Invalid email or password.', 401));
        }
        const user = userRes.rows[0];
        // 2. Validate password
        const isPasswordValid = await bcryptjs_1.default.compare(validated.password, user.password_hash);
        if (!isPasswordValid) {
            return next(new appError_1.AppError('Invalid email or password.', 401));
        }
        // 3. Check status
        if (user.status === 'suspended') {
            return next(new appError_1.AppError('Your account has been suspended. Please contact support.', 403));
        }
        // 4. Generate Tokens
        const accessToken = (0, jwt_1.generateAccessToken)({ userId: user.id, role: user.role });
        const refreshToken = (0, jwt_1.generateRefreshToken)({ userId: user.id, role: user.role });
        // 5. Store Refresh Token
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        await (0, database_1.query)('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)', [user.id, refreshToken, expiresAt]);
        res.status(200).json({
            status: 'success',
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    status: user.status,
                    facilityId: user.facilityId || undefined,
                    facilityName: user.facilityName || undefined,
                    shiftInfo: user.shiftInfo || undefined,
                },
                accessToken,
                refreshToken,
            },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
};
exports.login = login;
const logout = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return next(new appError_1.AppError('Refresh token is required.', 400));
        }
        // Revoke token in DB
        await (0, database_1.query)('UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token = $1', [refreshToken]);
        res.status(200).json({
            status: 'success',
            message: 'Logged out successfully.',
        });
    }
    catch (err) {
        next(err);
    }
};
exports.logout = logout;
const refresh = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return next(new appError_1.AppError('Refresh token is required.', 400));
        }
        // 1. Verify refresh token signature
        let decoded;
        try {
            decoded = (0, jwt_1.verifyRefreshToken)(refreshToken);
        }
        catch {
            return next(new appError_1.AppError('Invalid refresh token.', 401));
        }
        // 2. Query token from DB
        const tokenRes = await (0, database_1.query)(`SELECT id, user_id, revoked_at, expires_at 
       FROM refresh_tokens 
       WHERE token = $1`, [refreshToken]);
        if (tokenRes.rows.length === 0) {
            return next(new appError_1.AppError('Refresh token not found.', 401));
        }
        const tokenData = tokenRes.rows[0];
        // 3. Check revocation and expiry
        if (tokenData.revoked_at) {
            return next(new appError_1.AppError('Refresh token has been revoked.', 401));
        }
        if (new Date(tokenData.expires_at) < new Date()) {
            return next(new appError_1.AppError('Refresh token has expired.', 401));
        }
        // 4. Retrieve user info
        const userRes = await (0, database_1.query)(`SELECT u.id, r.name as role 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = $1`, [tokenData.user_id]);
        if (userRes.rows.length === 0) {
            return next(new appError_1.AppError('User not found.', 401));
        }
        const user = userRes.rows[0];
        // 5. Rotate refresh token (revoke old one, create new one)
        await (0, database_1.query)('UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1', [tokenData.id]);
        const newAccessToken = (0, jwt_1.generateAccessToken)({ userId: user.id, role: user.role });
        const newRefreshToken = (0, jwt_1.generateRefreshToken)({ userId: user.id, role: user.role });
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        await (0, database_1.query)('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)', [user.id, newRefreshToken, expiresAt]);
        res.status(200).json({
            status: 'success',
            data: {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
            },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.refresh = refresh;
const getMe = async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new appError_1.AppError('User session not found.', 401));
        }
        res.status(200).json({
            status: 'success',
            data: {
                user: req.user,
            },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getMe = getMe;
const forgotPassword = async (req, res, next) => {
    try {
        const validated = forgotPasswordSchema.parse(req.body);
        const userRes = await (0, database_1.query)('SELECT id, name, email FROM users WHERE email = $1', [validated.email]);
        if (userRes.rows.length === 0) {
            // Avoid letting users enumerate emails, return 200 regardless
            res.status(200).json({
                status: 'success',
                message: 'If the email exists, a password reset link has been sent.',
            });
            return;
        }
        const user = userRes.rows[0];
        // Generate crypto token
        const resetToken = crypto_1.default.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 3600000); // 1 hour
        await (0, database_1.query)('UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3', [resetToken, resetExpires, user.id]);
        const resetUrl = `${env_1.env.CLIENT_URL}/reset-password?token=${resetToken}`;
        await (0, email_1.sendEmail)({
            to: user.email,
            subject: 'Reset your Parka password',
            text: `Hello ${user.name},\n\nYou requested a password reset. Please click the link to reset your password: ${resetUrl}\n\nThis link is valid for 1 hour.`,
            html: `<p>Hello ${user.name},</p><p>You requested a password reset. Please click <a href="${resetUrl}">here</a> to reset your password.</p><p>This link is valid for 1 hour.</p>`,
        });
        res.status(200).json({
            status: 'success',
            message: 'If the email exists, a password reset link has been sent.',
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
};
exports.forgotPassword = forgotPassword;
const resetPassword = async (req, res, next) => {
    try {
        const validated = resetPasswordSchema.parse(req.body);
        // Find user with non-expired token
        const userRes = await (0, database_1.query)(`SELECT id FROM users 
       WHERE reset_token = $1 AND reset_token_expires > CURRENT_TIMESTAMP`, [validated.token]);
        if (userRes.rows.length === 0) {
            return next(new appError_1.AppError('Invalid reset token or token has expired.', 400));
        }
        const user = userRes.rows[0];
        // Hash password
        const hashedPassword = await bcryptjs_1.default.hash(validated.password, 10);
        // Save and clear tokens
        await (0, database_1.query)(`UPDATE users 
       SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL 
       WHERE id = $2`, [hashedPassword, user.id]);
        res.status(200).json({
            status: 'success',
            message: 'Password has been reset successfully. You can now login.',
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
};
exports.resetPassword = resetPassword;
