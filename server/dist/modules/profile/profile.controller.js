"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.savePushSubscription = exports.deletePaymentMethod = exports.updatePaymentMethod = exports.createPaymentMethod = exports.getPaymentMethods = exports.updatePreferences = exports.changePassword = exports.updateProfile = exports.getProfile = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const database_1 = require("../../config/database");
const appError_1 = require("../../utils/appError");
const updateProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    phone: zod_1.z.string().optional(),
    licenseNumber: zod_1.z.string().optional(),
    companyName: zod_1.z.string().optional(),
    businessLicense: zod_1.z.string().optional(),
    shiftInfo: zod_1.z.string().optional(),
    facilityId: zod_1.z.string().uuid().nullable().optional(),
});
const passwordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1),
    newPassword: zod_1.z.string().min(6),
});
const preferencesSchema = zod_1.z.object({
    pushNotifications: zod_1.z.boolean().optional(),
    emailInvoices: zod_1.z.boolean().optional(),
    offlineMode: zod_1.z.boolean().optional(),
    darkMode: zod_1.z.boolean().optional(),
    language: zod_1.z.string().optional(),
});
const paymentMethodSchema = zod_1.z.object({
    provider: zod_1.z.enum(['mtn', 'airtel', 'cash']),
    label: zod_1.z.string().min(2).max(80).optional(),
    phone: zod_1.z.string().optional(),
    isDefault: zod_1.z.boolean().default(false),
});
const pushSubscriptionSchema = zod_1.z.object({
    endpoint: zod_1.z.string().url(),
    keys: zod_1.z.record(zod_1.z.unknown()),
});
const getProfileDetails = async (userId, role) => {
    if (role === 'DRIVER') {
        const result = await (0, database_1.query)(`SELECT license_number as "licenseNumber", balance_ugx as "balanceUgx", preferences
       FROM driver_profiles WHERE user_id = $1`, [userId]);
        return result.rows[0] || { preferences: {} };
    }
    if (role === 'OPERATOR') {
        const result = await (0, database_1.query)(`SELECT company_name as "companyName", business_license as "businessLicense"
       FROM operator_profiles WHERE user_id = $1`, [userId]);
        return result.rows[0] || {};
    }
    if (role === 'ATTENDANT') {
        const result = await (0, database_1.query)(`SELECT ap.facility_id as "facilityId", ap.shift_info as "shiftInfo", f.name as "facilityName"
       FROM attendant_profiles ap
       LEFT JOIN parking_facilities f ON f.id = ap.facility_id
       WHERE ap.user_id = $1`, [userId]);
        return result.rows[0] || {};
    }
    return {};
};
const getProfile = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const userRes = await (0, database_1.query)(`SELECT u.id, u.name, u.email, u.phone, u.status, r.name as role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`, [req.user.id]);
        if (userRes.rows.length === 0) {
            return next(new appError_1.AppError('User not found.', 404));
        }
        const user = userRes.rows[0];
        const details = await getProfileDetails(user.id, user.role);
        res.status(200).json({
            status: 'success',
            data: { profile: { ...user, ...details } },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getProfile = getProfile;
const updateProfile = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const validated = updateProfileSchema.parse(req.body);
        if (validated.name !== undefined || validated.phone !== undefined) {
            await (0, database_1.query)(`UPDATE users
         SET name = COALESCE($1, name), phone = COALESCE($2, phone), updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`, [validated.name ?? null, validated.phone ?? null, req.user.id]);
        }
        if (req.user.role === 'DRIVER' && validated.licenseNumber !== undefined) {
            await (0, database_1.query)(`UPDATE driver_profiles SET license_number = $1 WHERE user_id = $2`, [validated.licenseNumber || null, req.user.id]);
        }
        if (req.user.role === 'OPERATOR') {
            await (0, database_1.query)(`UPDATE operator_profiles
         SET company_name = COALESCE($1, company_name), business_license = COALESCE($2, business_license)
         WHERE user_id = $3`, [validated.companyName ?? null, validated.businessLicense ?? null, req.user.id]);
        }
        if (req.user.role === 'ATTENDANT') {
            await (0, database_1.query)(`UPDATE attendant_profiles
         SET facility_id = COALESCE($1, facility_id), shift_info = COALESCE($2, shift_info)
         WHERE user_id = $3`, [validated.facilityId ?? null, validated.shiftInfo ?? null, req.user.id]);
        }
        const profile = await getProfileDetails(req.user.id, req.user.role);
        const user = await (0, database_1.query)('SELECT id, name, email, phone, status FROM users WHERE id = $1', [req.user.id]);
        res.status(200).json({
            status: 'success',
            data: { profile: { ...user.rows[0], role: req.user.role, ...profile } },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
};
exports.updateProfile = updateProfile;
const changePassword = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const validated = passwordSchema.parse(req.body);
        const userRes = await (0, database_1.query)('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
        if (userRes.rows.length === 0)
            return next(new appError_1.AppError('User not found.', 404));
        const isValid = await bcryptjs_1.default.compare(validated.currentPassword, userRes.rows[0].password_hash);
        if (!isValid)
            return next(new appError_1.AppError('Current password is incorrect.', 400));
        const hashedPassword = await bcryptjs_1.default.hash(validated.newPassword, 10);
        await (0, database_1.query)('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
            hashedPassword,
            req.user.id,
        ]);
        res.status(200).json({
            status: 'success',
            message: 'Password updated successfully.',
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
};
exports.changePassword = changePassword;
const updatePreferences = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        if (req.user.role !== 'DRIVER') {
            return next(new appError_1.AppError('Preferences are currently available for drivers only.', 403));
        }
        const validated = preferencesSchema.parse(req.body);
        const result = await (0, database_1.query)(`UPDATE driver_profiles
       SET preferences = COALESCE(preferences, '{}'::JSONB) || $1::JSONB
       WHERE user_id = $2
       RETURNING preferences`, [JSON.stringify(validated), req.user.id]);
        res.status(200).json({
            status: 'success',
            data: { preferences: result.rows[0]?.preferences || {} },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
};
exports.updatePreferences = updatePreferences;
const getPaymentMethods = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const result = await (0, database_1.query)(`SELECT id, provider, label, phone, is_default as "isDefault", created_at
       FROM user_payment_methods
       WHERE user_id = $1
       ORDER BY is_default DESC, created_at DESC`, [req.user.id]);
        res.status(200).json({
            status: 'success',
            data: { paymentMethods: result.rows },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getPaymentMethods = getPaymentMethods;
const createPaymentMethod = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const validated = paymentMethodSchema.parse(req.body);
        if (validated.provider !== 'cash' && !validated.phone) {
            return next(new appError_1.AppError('Phone number is required for mobile money methods.', 400));
        }
        if (validated.isDefault) {
            await (0, database_1.query)('UPDATE user_payment_methods SET is_default = false WHERE user_id = $1', [req.user.id]);
        }
        const label = validated.label ||
            (validated.provider === 'mtn'
                ? 'MTN Mobile Money'
                : validated.provider === 'airtel'
                    ? 'Airtel Money'
                    : 'Cash');
        const result = await (0, database_1.query)(`INSERT INTO user_payment_methods (user_id, provider, label, phone, is_default)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, provider, label, phone, is_default as "isDefault", created_at`, [req.user.id, validated.provider, label, validated.phone || null, validated.isDefault]);
        res.status(201).json({
            status: 'success',
            data: { paymentMethod: result.rows[0] },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
};
exports.createPaymentMethod = createPaymentMethod;
const updatePaymentMethod = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const validated = paymentMethodSchema.partial().parse(req.body);
        const { id } = req.params;
        if (validated.isDefault) {
            await (0, database_1.query)('UPDATE user_payment_methods SET is_default = false WHERE user_id = $1', [req.user.id]);
        }
        const result = await (0, database_1.query)(`UPDATE user_payment_methods
       SET provider = COALESCE($1, provider),
           label = COALESCE($2, label),
           phone = COALESCE($3, phone),
           is_default = COALESCE($4, is_default),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND user_id = $6
       RETURNING id, provider, label, phone, is_default as "isDefault", created_at`, [
            validated.provider ?? null,
            validated.label ?? null,
            validated.phone ?? null,
            validated.isDefault ?? null,
            id,
            req.user.id,
        ]);
        if (result.rows.length === 0) {
            return next(new appError_1.AppError('Payment method not found.', 404));
        }
        res.status(200).json({
            status: 'success',
            data: { paymentMethod: result.rows[0] },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
};
exports.updatePaymentMethod = updatePaymentMethod;
const deletePaymentMethod = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const result = await (0, database_1.query)('DELETE FROM user_payment_methods WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.user.id]);
        if (result.rows.length === 0) {
            return next(new appError_1.AppError('Payment method not found.', 404));
        }
        res.status(200).json({
            status: 'success',
            message: 'Payment method deleted successfully.',
        });
    }
    catch (err) {
        next(err);
    }
};
exports.deletePaymentMethod = deletePaymentMethod;
const savePushSubscription = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const validated = pushSubscriptionSchema.parse(req.body);
        const result = await (0, database_1.query)(`INSERT INTO push_subscriptions (user_id, endpoint, keys)
       VALUES ($1, $2, $3)
       ON CONFLICT (endpoint)
       DO UPDATE SET user_id = EXCLUDED.user_id, keys = EXCLUDED.keys, updated_at = CURRENT_TIMESTAMP
       RETURNING id, endpoint, keys`, [req.user.id, validated.endpoint, JSON.stringify(validated.keys)]);
        res.status(201).json({
            status: 'success',
            data: { subscription: result.rows[0] },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
};
exports.savePushSubscription = savePushSubscription;
