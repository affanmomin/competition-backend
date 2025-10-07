export interface PaymentRequest {
  amount: number;
  productInfo: string;
  firstName: string;
  email: string;
  phone: string;
  orderId?: string;
  successUrl?: string;
  failureUrl?: string;
  additionalCharges?: number;
  userDefined1?: string;
  userDefined2?: string;
  userDefined3?: string;
  userDefined4?: string;
  userDefined5?: string;
}

export interface PaymentResponse {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  hash: string;
  service_provider?: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}

export interface PaymentVerificationRequest {
  mihpayid: string;
  status: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  hash: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}

export interface TransactionDetails {
  mihpayid: string;
  request_id: string;
  bank_ref_num: string;
  amt: string;
  txnid: string;
  status: string;
  unmappedstatus: string;
  cardnum: string;
  addedon: string;
  productinfo: string;
  firstname: string;
  lastname: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  country: string;
  zipcode: string;
  email: string;
  phone: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  field2?: string;
  field9?: string;
  payment_source?: string;
  PG_TYPE?: string;
  bank_ref_no?: string;
  bankcode?: string;
  error?: string;
  error_Message?: string;
}

export enum PaymentStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PENDING = 'pending',
  CANCELLED = 'cancelled'
}