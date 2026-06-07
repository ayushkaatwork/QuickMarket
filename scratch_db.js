const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgres://postgres.yujsfdqtcsbojjukvoyg:b13eb7a0-efb8-48af-af0b-783bfa5d220f@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to Supabase PostgreSQL database...');
    await client.connect();
    console.log('Connected successfully!');

    console.log('Reading setup.sql...');
    const sqlPath = path.join(__dirname, 'setup.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing SQL schema... This might take a few seconds.');
    await client.query(sql);
    console.log('Database tables and seed data created successfully!');
  } catch (err) {
    console.error('Failed to execute SQL setup script:', err.message);
  } finally {
    await client.end();
  }
}

run();
