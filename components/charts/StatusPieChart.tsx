'use client';
import React from 'react';

interface DataPoint {
  name: string;
  value: number;
  color: string;
}

interface StatusPieChartProps {
  data: DataPoint[];
}

const StatusPieChart: React.FC<StatusPieChartProps> = ({ data }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        Nenhum dado disponível
      </div>
    );
  }

  // SVG dimensions
  const size = 180;
  const center = size / 2;
  const outerRadius = 70;
  const innerRadius = 45;

  // Calculate segments
  let currentAngle = -90; // Start from top
  const segments = data.map(d => {
    const percentage = d.value / total;
    const angle = percentage * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    // Convert angles to radians
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    // Calculate arc points
    const x1 = center + outerRadius * Math.cos(startRad);
    const y1 = center + outerRadius * Math.sin(startRad);
    const x2 = center + outerRadius * Math.cos(endRad);
    const y2 = center + outerRadius * Math.sin(endRad);
    const x3 = center + innerRadius * Math.cos(endRad);
    const y3 = center + innerRadius * Math.sin(endRad);
    const x4 = center + innerRadius * Math.cos(startRad);
    const y4 = center + innerRadius * Math.sin(startRad);

    const largeArcFlag = angle > 180 ? 1 : 0;

    const path = [
      `M ${x1} ${y1}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
      'Z'
    ].join(' ');

    return {
      ...d,
      path,
      percentage: (percentage * 100).toFixed(1)
    };
  });

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((seg, idx) => (
          <path
            key={idx}
            d={seg.path}
            fill={seg.color}
            className="hover:opacity-80 transition-opacity cursor-pointer"
          />
        ))}
        {/* Center text */}
        <text x={center} y={center - 5} textAnchor="middle" fill="#424242" fontSize="18" fontWeight="bold">
          {total > 1000 ? `${(total / 1000).toFixed(1)}k` : total}
        </text>
        <text x={center} y={center + 12} textAnchor="middle" fill="#94a3b8" fontSize="10">
          Total
        </text>
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {segments.map((seg, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-xs text-gray-600">
              {seg.name}: <span className="font-semibold">{seg.percentage}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatusPieChart;
