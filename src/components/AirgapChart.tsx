import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { AirgapPoint } from '../utils/types';
import { PRE_TOGGLE_COLS, POST_TOGGLE_COLS } from '../utils/constants';

interface AirgapChartProps {
  data: AirgapPoint[];
  serial: string;
}

export default function AirgapChart({ data, serial }: AirgapChartProps) {
  // Group data by position
  const chartData = [];

  // Combine pre and post positions for comparison
  const allPositions = [...new Set([...PRE_TOGGLE_COLS, ...POST_TOGGLE_COLS])];

  for (const position of allPositions) {
    const prePoint = data.find(
      (p) => p.position === position && p.state === 'pre'
    );
    const postPoint = data.find(
      (p) => p.position === position && p.state === 'post'
    );

    chartData.push({
      position,
      pre: prePoint?.value ?? null,
      post: postPoint?.value ?? null,
    });
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        Airgap Comparison - Serial: {serial}
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="position"
            label={{ value: 'Probe Position', position: 'insideBottom', offset: -5 }}
          />
          <YAxis
            label={{ value: 'Airgap', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip />
          <Legend />
          <Bar dataKey="pre" fill="#3b82f6" name="Pre Toggle" />
          <Bar dataKey="post" fill="#10b981" name="Post Toggle" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}


