import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://postgres:comp:123@db.bkljjtrevcfpztsfkwwt.supabase.co:5432/postgres',
  ssl: {
    rejectUnauthorized: false // Supabase requires SSL
  }
});

export default client;