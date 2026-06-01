import { PaymentGateway, InitiatePaymentResult, VerifyPaymentResult } from './PaymentGateway';
import crypto from 'crypto';

export class AirtelMoneyGateway implements PaymentGateway {
  public async initiatePayment(params: {
    userId: string;
    amount: number;
    phone: string;
    description: string;
  }): Promise<InitiatePaymentResult> {
    // Generate a unique transaction reference prefixed with ATL
    const transactionReference = `ATL-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

    // Simulate calling Airtel Money merchants API
    return {
      success: true,
      transactionReference,
      providerStatus: 'PENDING_PIN_ENTRY',
      message: 'USSD prompt sent to Airtel subscriber phone.',
    };
  }

  public async verifyPayment(transactionReference: string): Promise<VerifyPaymentResult> {
    // Simulate checking Airtel Money status
    return {
      success: true,
      status: 'completed',
      amount: 4000,
      transactionReference,
    };
  }
}
