import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { calculateAggregateStats } from '../utils/extractAirgap';
import type { AirgapPoint } from '../utils/types';

interface AggregateChartProps {
  data: AirgapPoint[];
  threshold?: number;
}

export default function AggregateChart({
  data,
  threshold = 0.1,
}: AggregateChartProps) {
  const stats = calculateAggregateStats(data);

  const chartData = stats.map((stat) => ({
    position: stat.position,
    avgDifference: stat.avgDifference,
    count: stat.count,
    exceedsThreshold: Math.abs(stat.avgDifference) > threshold,
  }));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        Aggregate Performance (Post - Pre Toggle)
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Average difference across all matched serials. Threshold: ±{threshold}
      </p>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="position"
            label={{ value: 'Probe Position', position: 'insideBottom', offset: -5 }}
          />
          <YAxis
            label={{ value: 'Average Difference', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            formatter={(value: number, name: string, props: any) => {
              if (name === 'avgDifference') {
                return [
                  `${value.toFixed(4)} (n=${props.payload.count})`,
                  'Average Difference',
                ];
              }
              return value;
            }}
          />
          <Legend />
          <Bar dataKey="avgDifference" name="Post - Pre Toggle">
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.exceedsThreshold ? '#ef4444' : '#3b82f6'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {chartData.some((d) => d.exceedsThreshold) && (
        <div className="mt-4 text-sm text-red-600">
          ⚠️ Some positions exceed the threshold of ±{threshold}
        </div>
      )}
    </div>
  );
}

