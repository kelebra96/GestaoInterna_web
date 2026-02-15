import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<800'],
  },
};

export default function () {
  const baseUrl = __ENV.APP_URL || __ENV.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';
  http.get(`${baseUrl}/api/monitoring`);
  sleep(1);
}
