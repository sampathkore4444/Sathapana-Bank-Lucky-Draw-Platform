import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('draw_errors');
const drawDuration = new Trend('draw_duration');
const drawSuccess = new Counter('draw_success');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_PREFIX = '/api/v1';

// Draw-specific load test
export const options = {
  vus: 10,
  duration: '2m',
  thresholds: {
    draw_duration: ['p(95)<5000'],   // 95% under 5s
    draw_errors: ['rate<0.05'],       // Less than 5% failures
  },
};

// Setup
export function setup() {
  console.log('Starting draw load test...');
  
  // Get admin token
  const loginRes = http.post(
    `${BASE_URL}${API_PREFIX}/auth/login`,
    JSON.stringify({
      email: 'admin@sathapana.com.kh',
      password: 'password123',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  let adminToken = '';
  if (loginRes.status === 200) {
    const body = JSON.parse(loginRes.body);
    adminToken = body.data?.token || '';
  }
  
  // Create multiple test users
  const userTokens = [];
  for (let i = 0; i < 5; i++) {
    const regRes = http.post(
      `${BASE_URL}${API_PREFIX}/auth/register`,
      JSON.stringify({
        email: `drawuser_${i}_${Date.now()}@test.com`,
        password: 'DrawTest123!',
        firstName: 'Draw',
        lastName: `User${i}`,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    if (regRes.status === 201) {
      const body = JSON.parse(regRes.body);
      userTokens.push(body.data?.token || '');
    }
  }
  
  // Create test entries
  for (const token of userTokens) {
    for (let j = 0; j < 10; j++) {
      http.post(
        `${BASE_URL}${API_PREFIX}/entries`,
        JSON.stringify({
          campaignId: 'campaign-1',
          transactionId: `DRAW-TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          transactionAmount: 150,
        }),
        { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
      );
    }
  }
  
  return { adminToken, userTokens };
}

// Default function - simulate draw scenario
export default function(data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.adminToken}`,
  };

  group('Draw Operations', () => {
    // 1. Get campaign stats
    const statsRes = http.get(
      `${BASE_URL}${API_PREFIX}/campaigns/campaign-1/stats`,
      { headers }
    );
    check(statsRes, {
      'get stats success': (r) => r.status === 200,
    });

    sleep(1);

    // 2. Get eligible participants
    const participantsRes = http.get(
      `${BASE_URL}${API_PREFIX}/draws/campaign-1/participants`,
      { headers }
    );
    check(participantsRes, {
      'get participants success': (r) => r.status === 200 || r.status === 404,
    });

    sleep(2);

    // 3. Execute draw (limited frequency)
    if (Math.random() < 0.1) {  // 10% chance to execute draw
      const drawRes = http.post(
        `${BASE_URL}${API_PREFIX}/draws/campaign-1/execute`,
        JSON.stringify({
          numberOfWinners: 3,
          numberOfAlternates: 5,
          allowMultipleWins: false,
          notes: 'Load test draw',
        }),
        { headers }
      );
      
      check(drawRes, {
        'draw execution success': (r) => r.status === 200 || r.status === 400,
      });
      
      drawDuration.add(drawRes.timings.duration);
      
      if (drawRes.status === 200) {
        drawSuccess.add(1);
      } else {
        drawErrors.add(1);
      }
    }
  });

  sleep(3);
}

// Teardown
export function teardown(data) {
  console.log('Draw load test completed');
}

// Handle summary
export function handleSummary(data) {
  console.log('\n📊 Draw Load Test Summary:');
  console.log(`Total Requests: ${data.metrics.http_reqs?.values?.count || 0}`);
  console.log(`Draw Success: ${data.metrics.draw_success?.values?.count || 0}`);
  console.log(`Avg Draw Duration: ${data.metrics.draw_duration?.values?.avg || 0}ms`);
  console.log(`p95 Draw Duration: ${data.metrics.draw_duration?.values?.['p(95)'] || 0}ms`);
  
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'loadtests/draw-summary.json': JSON.stringify(data),
  };
}
