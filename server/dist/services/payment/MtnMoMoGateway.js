"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MtnMoMoGateway = void 0;
const crypto_1 = __importDefault(require("crypto"));
class MtnMoMoGateway {
    async initiatePayment(params) {
        // Generate a unique transaction reference prefixed with MTN
        const transactionReference = `MTN-${crypto_1.default.randomBytes(8).toString('hex').toUpperCase()}`;
        // Simulate calling MTN MoMo collections endpoint
        // In a real implementation: Send POST /collection/v1_0/requesttopay
        return {
            success: true,
            transactionReference,
            providerStatus: 'PENDING_USER_CONFIRMATION',
            message: 'USSD Push prompt sent to MTN subscriber phone.',
        };
    }
    async verifyPayment(transactionReference) {
        // Simulate checking MTN MoMo status
        // In a real implementation: Send GET /collection/v1_0/requesttopay/{referenceId}
        // We mock that it is completed successfully
        return {
            success: true,
            status: 'completed',
            amount: 4000, // example
            transactionReference,
        };
    }
}
exports.MtnMoMoGateway = MtnMoMoGateway;
