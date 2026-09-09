import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration');
const successCount = new Counter('success_count');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_PREFIX = '/api/v1';

// Stress test configuration - ramp up and down
export const options = {
  stages: [
    { duration: '1m', target: 20 },   // Ramp up to 20 VUs
    { duration: '2m', target: 50 },   // Ramp up to 50 VUs
    { duration: '5m', target: 50 },   // Stay at 50 VUs for 5 min
    { duration: '2m', target: 100 },  // Ramp up to 100 VUs
    { duration: '3m', target: 100 },  // Stay at 100 VUs for 3 min
    { duration: '2m', target: 50 },   // Ramp down to 50 VUs
    { duration: '1m', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],  // 95% under 1s
    http_req_failed: ['rate<0.15'],     // Less than 15% failures
    errors: ['rate<0.15'],
  },
};

// Setup function
export function setup() {
  console.log('Starting stress test...');
  
  // Create test user
  const registerRes = http.post(
    `${BASE_URL}${API_PREFIX}/auth/register`,
    JSON.stringify({
      email: `stresstest_${Date.now()}@test.com`,
      password: 'StressTest123!',
      firstName: 'Stress',
      lastName: 'Test',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  let token = '';
  if (registerRes.status === 201) {
    const body = JSON.parse(registerRes.body);
    token = body.data?.token || '';
  } else {
    const loginRes = http.post(
      `${BASE_URL}${API_PREFIX}/auth/login`,
      JSON.stringify({
        email: 'admin@sathapana.com.kh',
        password: 'password123',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (loginRes.status === 200) {
      const body = JSON.parse(loginRes.body);
      token = body.data?.token || '';
    }
  }
  
  return { token };
}

// Default function - mixed workload
export default function(data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`,
  };

  // Simulate real user behavior with different weights
  const rand = Math.random();
  
  if (rand < 0.3) {
    // 30% - Browse campaigns
    group('Browse Campaigns', () => {
      const res = http.get(`${BASE_URL}${API_PREFIX}/campaigns`, { headers });
      check(res, {
        'browse campaigns success': (r) => r.status === 200,
      });
      apiDuration.add(res.timings.duration);
      errorRate.add(res.status !== 200);
    });
  } else if (rand < 0.5) {
    // 20% - View campaign details
    group('View Campaign', () => {
      const res = http.get(`${BASE_URL}${API_PREFIX}/campaigns/campaign-1`, { headers });
      check(res, {
        'view campaign success': (r) => r.status === 200 || r.status === 404,
      });
      apiDuration.add(res.timings.duration);
      errorRate.add(res.status >= 500);
    });
  } else if (rand < 0.7) {
    // 20% - Submit entry
    group('Submit Entry', () => {
      const entryData = {
        campaignId: 'campaign-1',
        transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        transactionAmount: Math.floor(Math.random() * 500) + 100,
      };
      
      const res = http.post(
        `${BASE_URL}${API_PREFIX}/entries`,
        JSON.stringify(entryData),
        { headers }
      );
      check(res, {
        'submit entry success': (r) => r.status === 201 || r.status === 400,
      });
      apiDuration.add(res.timings.duration);
      errorRate.add(res.status >= 500);
    });
  } else if (rand < 0.9) {
    // 20% - Check entries
    group('Check Entries', () => {
      const res = http.get(`${BASE_URL}${API_PREFIX}/entries`, { headers });
      check(res, {
        'check entries success': (r) => r.status === 200,
      });
      apiDuration.add(res.timings.duration);
      errorRate.add(res.status !== 200);
    });
  } else {
    // 10% - Check dashboard
    group('Dashboard', () => {
      const res = http.get(`${BASE_URL}${API_PREFIX}/admin/dashboard`, { headers });
      check(res, {
        'dashboard success': (r) => r.status === 200 || r.status === 401,
      });
      apiDuration.add(res.timings.duration);
      errorRate.add(res.status >= 500);
    });
  }

  // Random think time between requests
  sleep(Math.random() * 2 + 1);
}

// Teardown
export function teardown(data) {
  console.log('Stress test completed');
}

// Handle summary
export function handleSummary(data) {
  console.log('\n📊 Stress Test Summary:');
  console.log(`Total Requests: ${data.metrics.http_reqs?.values?.count || 0}`);
  console.log(`Failed Requests: ${data.metrics.http_req_failed?.values?.rate || 0}`);
  console.log(`Avg Response Time: ${data.metrics.http_req_duration?.values?.avg || 0}ms`);
  console.log(`p95 Response Time: ${data.metrics.http_req_duration?.values?.['p(95)'] || 0}ms`);
  console.log(`Max Response Time: ${data.metrics.http_req_duration?.values?.max || 0}ms`);
  
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'loadtests/stress-summary.json': JSON.stringify(data),
  };
}
