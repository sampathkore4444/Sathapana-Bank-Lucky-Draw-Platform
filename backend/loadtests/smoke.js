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

// Smoke test configuration - light load
export const options = {
  vus: 5,  // Virtual users
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],     // Less than 10% failures
    errors: ['rate<0.1'],
  },
};

// Setup function - runs once before test
export function setup() {
  console.log('Starting smoke test...');
  console.log(`Target: ${BASE_URL}`);
  
  // Create a test user and get token
  const registerRes = http.post(
    `${BASE_URL}${API_PREFIX}/auth/register`,
    JSON.stringify({
      email: `loadtest_${Date.now()}@test.com`,
      password: 'LoadTest123!',
      firstName: 'Load',
      lastName: 'Test',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  let token = '';
  if (registerRes.status === 201) {
    const body = JSON.parse(registerRes.body);
    token = body.data?.token || '';
  } else {
    // Try login if registration fails
    const loginRes = http.post(
      `${BASE_URL}${API_PREFIX}/auth/login`,
      JSON.stringify({
        email: 'loadtest@test.com',
        password: 'LoadTest123!',
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

// Default function - main test scenario
export default function(data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`,
  };

  group('Health Check', () => {
    const healthRes = http.get(`${BASE_URL}/health`);
    check(healthRes, {
      'health status is 200': (r) => r.status === 200,
      'health response time < 100ms': (r) => r.timings.duration < 100,
    });
    apiDuration.add(healthRes.timings.duration);
    errorRate.add(healthRes.status !== 200);
  });

  sleep(1);

  group('Get Campaigns', () => {
    const campaignsRes = http.get(
      `${BASE_URL}${API_PREFIX}/campaigns`,
      { headers }
    );
    check(campaignsRes, {
      'campaigns status is 200': (r) => r.status === 200,
      'campaigns has data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true;
        } catch {
          return false;
        }
      },
    });
    apiDuration.add(campaignsRes.timings.duration);
    errorRate.add(campaignsRes.status !== 200);
  });

  sleep(1);

  group('Get Campaign Details', () => {
    const campaignRes = http.get(
      `${BASE_URL}${API_PREFIX}/campaigns/campaign-1`,
      { headers }
    );
    check(campaignRes, {
      'campaign status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
    apiDuration.add(campaignRes.timings.duration);
    errorRate.add(campaignRes.status >= 500);
  });

  sleep(1);

  group('Get Entries', () => {
    const entriesRes = http.get(
      `${BASE_URL}${API_PREFIX}/entries`,
      { headers }
    );
    check(entriesRes, {
      'entries status is 200': (r) => r.status === 200,
    });
    apiDuration.add(entriesRes.timings.duration);
    errorRate.add(entriesRes.status !== 200);
  });

  sleep(2);
}

// Teardown function - runs after test
export function teardown(data) {
  console.log('Smoke test completed');
}

// Handle summary
export function handleSummary(data) {
  console.log('\n📊 Load Test Summary:');
  console.log(`Total Requests: ${data.metrics.http_reqs?.values?.count || 0}`);
  console.log(`Failed Requests: ${data.metrics.http_req_failed?.values?.rate || 0}`);
  console.log(`Avg Response Time: ${data.metrics.http_req_duration?.values?.avg || 0}ms`);
  console.log(`p95 Response Time: ${data.metrics.http_req_duration?.values?.['p(95)'] || 0}ms`);
  
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'loadtests/smoke-summary.json': JSON.stringify(data),
  };
}
