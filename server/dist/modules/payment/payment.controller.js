"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReceipt = exports.getPaymentHistory = exports.confirmPayment = exports.initiatePayment = void 0;
const zod_1 = require("zod");
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../../config/database");
const appError_1 = require("../../utils/appError");
const MtnMoMoGateway_1 = require("../../services/payment/MtnMoMoGateway");
const AirtelMoneyGateway_1 = require("../../services/payment/AirtelMoneyGateway");
const notificationService_1 = require("../../services/notificationService");
const initiateSchema = zod_1.z.object({
    amount: zod_1.z.coerce.number().int().positive(),
    phone: zod_1.z.string().optional(),
    provider: zod_1.z.enum(['mtn', 'airtel', 'cash']),
    sessionId: zod_1.z.string().uuid().optional(),
    reservationId: zod_1.z.string().uuid().optional(),
});
const confirmSchema = zod_1.z.object({
    transactionReference: zod_1.z.string(),
});
const initiatePayment = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const validated = initiateSchema.parse(req.body);
        let reference = '';
        let status = 'pending';
        let message = '';
        if (validated.provider === 'cash') {
            reference = `CSH-${crypto_1.default.randomBytes(8).toString('hex').toUpperCase()}`;
            status = 'completed';
            message = 'Cash payment recorded.';
        }
        else {
            if (!validated.phone || validated.phone.length < 10) {
                return next(new appError_1.AppError('A valid phone number is required for mobile money payments.', 400));
            }
            const gateway = validated.provider === 'mtn' ? new MtnMoMoGateway_1.MtnMoMoGateway() : new AirtelMoneyGateway_1.AirtelMoneyGateway();
            const gatewayResult = await gateway.initiatePayment({
                userId: req.user.id,
                amount: validated.amount,
                phone: validated.phone,
                description: 'Parka parking session payment',
            });
            reference = gatewayResult.transactionReference;
            status = 'pending';
            message = gatewayResult.message;
        }
        // Insert payment record
        const result = await (0, database_1.query)(`INSERT INTO payments (session_id, reservation_id, user_id, provider, status, transaction_reference, amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`, [
            validated.sessionId || null,
            validated.reservationId || null,
            req.user.id,
            validated.provider,
            status,
            reference,
            validated.amount,
        ]);
        const payment = result.rows[0];
        // If cash, generate receipt immediately since it completes instantly
        let receipt = null;
        if (validated.provider === 'cash') {
            const receiptNo = `REC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto_1.default.randomBytes(3).toString('hex').toUpperCase()}`;
            const recResult = await (0, database_1.query)(`INSERT INTO receipts (payment_id, receipt_number, details)
         VALUES ($1, $2, $3)
         RETURNING *`, [payment.id, receiptNo, JSON.stringify({ amount: validated.amount, method: 'Cash', date: new Date() })]);
            receipt = recResult.rows[0];
        }
        res.status(200).json({
            status: 'success',
            data: {
                payment,
                receipt,
                transactionReference: reference,
                message,
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
exports.initiatePayment = initiatePayment;
const confirmPayment = async (req, res, next) => {
    try {
        const validated = confirmSchema.parse(req.body);
        // Fetch pending payment details
        const paymentRes = await (0, database_1.query)('SELECT id, user_id, amount, provider, status FROM payments WHERE transaction_reference = $1', [validated.transactionReference]);
        if (paymentRes.rows.length === 0) {
            return next(new appError_1.AppError('Payment transaction not found.', 404));
        }
        const payment = paymentRes.rows[0];
        if (payment.status !== 'pending') {
            return res.status(200).json({
                status: 'success',
                message: `Payment status is already ${payment.status}`,
                data: { payment },
            });
        }
        // Call Mock Gateway verify
        const gateway = payment.provider === 'mtn' ? new MtnMoMoGateway_1.MtnMoMoGateway() : new AirtelMoneyGateway_1.AirtelMoneyGateway();
        const verifyResult = await gateway.verifyPayment(validated.transactionReference);
        if (verifyResult.status === 'completed') {
            // Update payment
            const updatedPaymentRes = await (0, database_1.query)("UPDATE payments SET status = 'completed' WHERE id = $1 RETURNING *", [payment.id]);
            const updatedPayment = updatedPaymentRes.rows[0];
            // Create Receipt
            const receiptNo = `REC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto_1.default.randomBytes(3).toString('hex').toUpperCase()}`;
            const receiptRes = await (0, database_1.query)(`INSERT INTO receipts (payment_id, receipt_number, details)
         VALUES ($1, $2, $3)
         RETURNING *`, [
                payment.id,
                receiptNo,
                JSON.stringify({
                    amount: payment.amount,
                    method: payment.provider.toUpperCase(),
                    reference: validated.transactionReference,
                    date: new Date(),
                }),
            ]);
            // Notify User
            await (0, notificationService_1.createNotification)({
                userId: payment.user_id,
                type: 'payment',
                title: 'Payment Received',
                body: `UGX ${payment.amount.toLocaleString()} payment verified successfully via ${payment.provider.toUpperCase() === 'MTN' ? 'MTN MoMo' : 'Airtel Money'}.`,
            });
            res.status(200).json({
                status: 'success',
                data: {
                    payment: updatedPayment,
                    receipt: receiptRes.rows[0],
                },
            });
        }
        else {
            res.status(200).json({
                status: 'success',
                message: 'Payment verification returned pending or failed.',
                data: { payment },
            });
        }
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
};
exports.confirmPayment = confirmPayment;
const getPaymentHistory = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        let queryStr = `
      SELECT p.*, r.code as "reservationCode", rec.id as "receiptId", rec.receipt_number as "receiptNumber"
      FROM payments p
      LEFT JOIN reservations r ON p.reservation_id = r.id
      LEFT JOIN receipts rec ON rec.payment_id = p.id
    `;
        const queryParams = [];
        // Drivers see their own history, operators/admins see everything
        if (req.user.role === 'DRIVER') {
            queryStr += ' WHERE p.user_id = $1';
            queryParams.push(req.user.id);
        }
        queryStr += ' ORDER BY p.created_at DESC';
        const payments = await (0, database_1.query)(queryStr, queryParams);
        res.status(200).json({
            status: 'success',
            data: { payments: payments.rows },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getPaymentHistory = getPaymentHistory;
const getReceipt = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const { id } = req.params;
        const receiptRes = await (0, database_1.query)(`SELECT rec.*, p.provider, p.amount, p.user_id, u.name as "userName", u.email as "userEmail"
       FROM receipts rec
       JOIN payments p ON rec.payment_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE rec.id = $1`, [id]);
        if (receiptRes.rows.length === 0) {
            return next(new appError_1.AppError('Receipt not found.', 404));
        }
        const receipt = receiptRes.rows[0];
        // Access control
        if (req.user.role === 'DRIVER' && receipt.user_id !== req.user.id) {
            return next(new appError_1.AppError('Unauthorized access to this receipt.', 403));
        }
        res.status(200).json({
            status: 'success',
            data: { receipt },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getReceipt = getReceipt;
