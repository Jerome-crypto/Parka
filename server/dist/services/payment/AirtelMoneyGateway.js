"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AirtelMoneyGateway = void 0;
const crypto_1 = __importDefault(require("crypto"));
class AirtelMoneyGateway {
    async initiatePayment(params) {
        // Generate a unique transaction reference prefixed with ATL
        const transactionReference = `ATL-${crypto_1.default.randomBytes(8).toString('hex').toUpperCase()}`;
        // Simulate calling Airtel Money merchants API
        return {
            success: true,
            transactionReference,
            providerStatus: 'PENDING_PIN_ENTRY',
            message: 'USSD prompt sent to Airtel subscriber phone.',
        };
    }
    async verifyPayment(transactionReference) {
        // Simulate checking Airtel Money status
        return {
            success: true,
            status: 'completed',
            amount: 4000,
            transactionReference,
        };
    }
}
exports.AirtelMoneyGateway = AirtelMoneyGateway;
