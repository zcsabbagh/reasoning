// Simple script to seed the database with V1 exam data
import https from 'https';

const data = JSON.stringify({});

const options = {
  hostname: '30aba30c-9c88-491e-a23e-76e57f3164b6-00-18ryppe813hfo.riker.replit.dev',
  port: 443,
  path: '/api/v1/seed-exam',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'Cookie': 'connect.sid=s%3AIZIrnkDO9SAqI3-6WD3GWNWvzqfxTR2B.StM8%2FyQmCpsHqrBw1FqstwkLwKNHVlC0TbWf8Zn9EI4'
  }
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.write(data);
req.end();