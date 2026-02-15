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

interface ResponseTimeChartProps {
  systemHealth: SystemHealth[];
}

const ResponseTimeChart: React.FC<ResponseTimeChartProps> = ({ systemHealth }) => {
  const serviceTypes = Array.from(new Set(systemHealth.map(item => item.check_type)));

  const processData = () => {
    // This function can be improved to aggregate data by time intervals if needed
    return systemHealth.map(item => ({
      time: new Date(item.checked_at).getTime(),
      [item.check_type]: item.response_time_ms,
    }));
  };
  
  const formattedData = processData();

  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#FF8042', '#0088FE', '#00C49F'];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border border-gray-300 rounded shadow-lg">
          <p className="font-bold">{`Time: ${new Date(label).toLocaleString()}`}</p>
          {payload.map((p: any, index: number) => (
            <p key={index} style={{ color: p.color }}>{`${p.name}: ${p.value}ms`}</p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <Title>API Response Time (ms)</Title>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={formattedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(unixTime) => new Date(unixTime).toLocaleTimeString()}
          />
          <YAxis unit="ms" />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {serviceTypes.map((service, index) => (
            <Line 
              key={service}
              type="monotone" 
              dataKey={service} 
              stroke={colors[index % colors.length]} 
              dot={false}
              connectNulls 
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

export default ResponseTimeChart;
