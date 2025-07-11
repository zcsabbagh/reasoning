// Test script to check V1 exam endpoints
import https from 'https';

const cookie = 'connect.sid=s%3AIZIrnkDO9SAqI3-6WD3GWNWvzqfxTR2B.StM8%2FyQmCpsHqrBw1FqstwkLwKNHVlC0TbWf8Zn9EI4';

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '30aba30c-9c88-491e-a23e-76e57f3164b6-00-18ryppe813hfo.riker.replit.dev',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie
      }
    };

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log(`\n=== ${method} ${path} ===`);
        console.log(`Status: ${res.statusCode}`);
        console.log(`Response: ${responseData}`);
        resolve({ status: res.statusCode, data: responseData });
      });
    });

    req.on('error', (error) => {
      console.error(`Error with ${path}:`, error);
      reject(error);
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function testEndpoints() {
  try {
    // Test 1: Get all exams
    await makeRequest('/api/v1/exams');
    
    // Test 2: Get exam questions for exam 1
    await makeRequest('/api/v1/exams/1/questions');
    
    // Test 3: Force reseed with DELETE first
    await makeRequest('/api/v1/seed-exam', 'DELETE');
    
    // Test 4: Seed exam again
    await makeRequest('/api/v1/seed-exam', 'POST', JSON.stringify({}));
    
    // Test 5: Get exam questions again
    await makeRequest('/api/v1/exams/1/questions');
    
    // Test 6: Get stage 1 directly
    await makeRequest('/api/v1/stages/5/1');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testEndpoints();