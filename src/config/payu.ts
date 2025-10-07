export interface PayUConfig {
  mode: 'test' | 'live';
  key: string;
  salt: string;
  clientId: string;
  clientSecret: string;
  urls: {
    payment: string;
    verify: string;
    refund: string;
  };
}

export const payuConfig: PayUConfig = {
  mode: (process.env.PAYU_MODE as 'test' | 'live') || 'test',
  key: process.env.PAYU_KEY || '',
  salt: process.env.PAYU_SALT || '',
  clientId: process.env.PAYU_CLIENT_ID || '',
  clientSecret: process.env.PAYU_CLIENT_SECRET || '',
  urls: {
    payment: process.env.PAYU_MODE === 'live' 
      ? 'https://secure.payu.in/_payment'
      : 'https://test.payu.in/_payment',
    verify: process.env.PAYU_MODE === 'live'
      ? 'https://info.payu.in/merchant/postservice.php'
      : 'https://test.payu.in/merchant/postservice.php',
    refund: process.env.PAYU_MODE === 'live'
      ? 'https://info.payu.in/merchant/postservice.php'
      : 'https://test.payu.in/merchant/postservice.php'
  }
};

export const validatePayUConfig = (): boolean => {
  const required = ['PAYU_KEY', 'PAYU_SALT', 'PAYU_CLIENT_ID', 'PAYU_CLIENT_SECRET'];
  
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing required PayU environment variable: ${key}`);
      return false;
    }
  }
  
  return true;
};