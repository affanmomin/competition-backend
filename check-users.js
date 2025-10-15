const { Client } = require('pg');

async function checkUsers() {
  const client = new Client('postgresql://postgres.kzqfcjhunbbauisasppv:Fz5ITIcU59JMS7V1DCr7A3@aws-0-ap-south-1.pooler.supabase.com:6543/postgres');
  
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Check existing users
    const usersResult = await client.query('SELECT id, email, name FROM public."user" LIMIT 5');
    console.log('Existing users:', usersResult.rows);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkUsers();