import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  stages: [
    { duration: '15s', target: 20 },
    { duration: '15s', target: 50 },
    { duration: '15s', target: 100 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.1'],
    http_req_duration: ['p(95)<1500'],
  },
};

export default function () {
  const baseUrl = __ENV.APP_URL || __ENV.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';
  http.get(`${baseUrl}/api/monitoring`);
  sleep(1);
}
