import { PaymentGateway, InitiatePaymentResult, VerifyPaymentResult } from './PaymentGateway';
import crypto from 'crypto';

export class MtnMoMoGateway implements PaymentGateway {
  public async initiatePayment(params: {
    userId: string;
    amount: number;
    phone: string;
    description: string;
  }): Promise<InitiatePaymentResult> {
    // Generate a unique transaction reference prefixed with MTN
    const transactionReference = `MTN-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

    // Simulate calling MTN MoMo collections endpoint
    // In a real implementation: Send POST /collection/v1_0/requesttopay
    return {
      success: true,
      transactionReference,
      providerStatus: 'PENDING_USER_CONFIRMATION',
      message: 'USSD Push prompt sent to MTN subscriber phone.',
    };
  }

  public async verifyPayment(transactionReference: string): Promise<VerifyPaymentResult> {
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
