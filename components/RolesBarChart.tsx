"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';

interface RolesBarChartProps {
  roles: {
    admin: number;
    fieldAgent: number;
    storeManager: number;
    commercialAnalyst: number;
    commercialManager: number;
  };
}

export default function RolesBarChart({ roles }: RolesBarChartProps) {
  const data = [
    { name: 'Administradores', value: roles.admin, color: '#1F53A2' },
    { name: 'Agentes de Campo', value: roles.fieldAgent, color: '#4CAF50' },
    { name: 'Gerentes de Loja', value: roles.storeManager, color: '#5C94CC' },
    { name: 'Analistas Comerciais', value: roles.commercialAnalyst, color: '#9C27B0' },
    { name: 'Gestores Comerciais', value: roles.commercialManager, color: '#FF9800' },
  ];

  return (
    <div className="bg-[#FFFFFF] rounded-xl shadow-md p-6 border border-[#E0E0E0]">
      <h3 className="text-lg font-bold text-[#212121] mb-4">Usuários por Função</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#757575' }} stroke="#BFC7C9" />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#757575' }} stroke="#BFC7C9" />
          <Tooltip
            formatter={(value: number) => [value, 'Usuários']}
            contentStyle={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E0E0E0',
              borderRadius: '8px',
              padding: '12px',
            }}
          />
          <Legend />
          <Bar dataKey="value" name="Quantidade" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
