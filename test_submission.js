// Test V1 submission endpoint directly
import https from 'https';

const cookie = 'connect.sid=s%3AwB0aT5a9it8bU5-Q5-NOX-sD9o08IT46.wIn7DkOwd29sDP66PPXE%2BCUGKoVGlSl7KLS8mvb5s8U';

const testData = JSON.stringify({
  sessionId: 7,
  stageNumber: 1,
  responseText: "Test assumptions about printing press impact on society",
  responseType: "assumption"
});

const options = {
  hostname: '30aba30c-9c88-491e-a23e-76e57f3164b6-00-18ryppe813hfo.riker.replit.dev',
  port: 443,
  path: '/api/v1/responses/submit',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(testData),
    'Cookie': cookie
  }
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  
  res.on('data', (d) => {
    console.log('Response:', d.toString());
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.write(testData);
req.end();