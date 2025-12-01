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
import { VALID_PARTS } from '../utils/constants';
import type { AirgapPoint } from '../utils/types';
import PartScatterChart from './PartScatterChart';

interface PartDashboardProps {
  data: AirgapPoint[];
}

// Color palette for the 8 parts
const PART_COLORS: { [key: string]: { pre: string; post: string; bg: string } } = {
  FRU: { pre: '#3b82f6', post: '#10b981', bg: 'bg-blue-50' },
  FRL: { pre: '#8b5cf6', post: '#14b8a6', bg: 'bg-purple-50' },
  FLU: { pre: '#f59e0b', post: '#06b6d4', bg: 'bg-amber-50' },
  FLL: { pre: '#ef4444', post: '#22c55e', bg: 'bg-red-50' },
  RRU: { pre: '#6366f1', post: '#84cc16', bg: 'bg-indigo-50' },
  RRL: { pre: '#ec4899', post: '#10b981', bg: 'bg-pink-50' },
  RLU: { pre: '#14b8a6', post: '#f59e0b', bg: 'bg-teal-50' },
  RLL: { pre: '#06b6d4', post: '#8b5cf6', bg: 'bg-cyan-50' },
};

export default function PartDashboard({ data }: PartDashboardProps) {
  // Group data by part
  const partDataMap = new Map<string, AirgapPoint[]>();
  
  for (const point of data) {
    if (!partDataMap.has(point.part)) {
      partDataMap.set(point.part, []);
    }
    partDataMap.get(point.part)!.push(point);
  }

  // Prepare chart data for each part
  const prepareChartData = (partPoints: AirgapPoint[]) => {
    // Get all unique positions from the data (handles both letter-based and named columns)
    const allPositions = [...new Set(partPoints.map(p => p.position))].sort();
    const chartData: any[] = [];

    for (const position of allPositions) {
      const prePoints = partPoints.filter(
        (p) => p.position === position && p.state === 'pre' && p.value !== null
      );
      const postPoints = partPoints.filter(
        (p) => p.position === position && p.state === 'post' && p.value !== null
      );

      // Calculate averages if multiple values exist
      const preAvg = prePoints.length > 0
        ? prePoints.reduce((sum, p) => sum + (p.value || 0), 0) / prePoints.length
        : null;
      const postAvg = postPoints.length > 0
        ? postPoints.reduce((sum, p) => sum + (p.value || 0), 0) / postPoints.length
        : null;

      chartData.push({
        position,
        pre: preAvg,
        post: postAvg,
        preCount: prePoints.length,
        postCount: postPoints.length,
      });
    }

    return chartData;
  };

  if (data.length === 0) {
    return (
      <div className="rounded-lg shadow-sm border-2 border-blue-400 p-12 text-center" style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.98) 100%)' }}>
        <p className="text-gray-700 text-lg mb-2">No data available</p>
        <p className="text-gray-500 text-sm">Please upload files and click "Generate Dashboard"</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg shadow-sm border-2 border-gray-300 p-4 mb-4" style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.98) 100%)' }}>
        <p className="text-sm text-gray-700">
          Showing {data.length} data points across {partDataMap.size} parts
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {VALID_PARTS.map((part) => {
          const partPoints = partDataMap.get(part) || [];
          const hasPreData = partPoints.some(p => p.state === 'pre' && p.value !== null);
          const hasPostData = partPoints.some(p => p.state === 'post' && p.value !== null);

          return (
            <div key={part} className="space-y-4">
              {(hasPreData || hasPostData) ? (
                <PartScatterChart 
                  data={data} 
                  part={part} 
                  state={hasPreData ? 'pre' : 'post'} 
                />
              ) : (
                <div className="rounded-lg shadow-sm border-2 border-blue-400 p-12 text-center border-dashed" style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.98) 100%)' }}>
                  <p className="text-gray-700 font-medium">No data available for {part}</p>
                  <p className="text-gray-500 text-sm mt-1">
                    {partPoints.length > 0 
                      ? `${partPoints.length} points found but no valid values`
                      : 'No data points found'}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

