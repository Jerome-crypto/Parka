export interface InitiatePaymentResult {
  success: boolean;
  transactionReference: string;
  providerStatus: string;
  message: string;
}

export interface VerifyPaymentResult {
  success: boolean;
  status: 'completed' | 'failed' | 'pending';
  amount: number;
  transactionReference: string;
}

export interface PaymentGateway {
  initiatePayment(params: {
    userId: string;
    amount: number;
    phone: string;
    description: string;
  }): Promise<InitiatePaymentResult>;

  verifyPayment(transactionReference: string): Promise<VerifyPaymentResult>;
}
