'use client';
import React from 'react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from 'recharts';
import { Card, Title } from '@tremor/react';

interface SystemHealth {
  check_type: string;
  endpoint: string;
  status: string;
  response_time_ms: number;
  checked_at: string;
}

interface HealthStatusChartProps {
  systemHealth: SystemHealth[];
}

const HealthStatusChart: React.FC<HealthStatusChartProps> = ({ systemHealth }) => {
  const serviceTypes = Array.from(new Set(systemHealth.map(item => item.check_type)));

  const points = systemHealth
    .map(item => ({
      time: new Date(item.checked_at).getTime(),
      service: item.check_type,
      responseTime: item.response_time_ms,
    }))
    .sort((a, b) => a.time - b.time);

  const minuteBuckets = points.reduce<Record<string, { time: number; service: string; responseTime: number }[]>>(
    (acc, item) => {
      const minuteKey = Math.floor(item.time / 60000) * 60000;
      const key = `${minuteKey}:${item.service}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push({ time: minuteKey, service: item.service, responseTime: item.responseTime });
      return acc;
    },
    {}
  );

  const aggregated = Object.values(minuteBuckets).map((bucket) => {
    const sample = bucket[0];
    const avg = Math.round(bucket.reduce((sum, b) => sum + b.responseTime, 0) / bucket.length);
    return { time: sample.time, service: sample.service, responseTime: avg };
  });

  const domain = aggregated.length
    ? [Math.min(...aggregated.map(d => d.time)), Math.max(...aggregated.map(d => d.time))]
    : [0, 1];

  const palette = ['#1F53A2', '#3B9797', '#F59E0B', '#BF092F', '#7C3AED', '#14B8A6'];
  const colorByService: Record<string, string> = {};
  serviceTypes.forEach((svc, i) => {
    colorByService[svc] = palette[i % palette.length];
  });

  const timeline = aggregated.reduce<Record<number, any>>((acc, item) => {
    const key = item.time;
    if (!acc[key]) acc[key] = { time: item.time };
    acc[key][item.service] = item.responseTime;
    return acc;
  }, {});

  const chartData = Object.values(timeline);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border border-gray-300 rounded shadow-lg">
          <p className="font-bold">{`Time: ${new Date(label).toLocaleString()}`}</p>
          {payload.map((item: any) => (
            <p key={item.dataKey} style={{ color: item.stroke }}>
              {`${item.dataKey}: ${item.value ?? '-'} ms`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <Title>System Health Timeline</Title>
      {chartData.length === 0 ? (
        <div className="text-sm text-[#757575] py-6 text-center">
          Nenhum dado de health check disponível.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }} data={chartData}>
            <CartesianGrid />
            <XAxis
              type="number"
              dataKey="time"
              name="Time"
              domain={domain}
              tickFormatter={(unixTime) => new Date(unixTime).toLocaleTimeString()}
            />
            <YAxis
              tickFormatter={(value) => `${value} ms`}
              label={{ value: 'Tempo de resposta (ms)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            <Legend />
            {serviceTypes.map((svc) => (
              <Line
                key={svc}
                type="monotone"
                dataKey={svc}
                name={svc}
                stroke={colorByService[svc]}
                dot={false}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
};

export default HealthStatusChart;
