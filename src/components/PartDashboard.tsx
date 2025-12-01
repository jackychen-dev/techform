import { VALID_PARTS } from '../utils/constants';
import type { AirgapPoint } from '../utils/types';
import PartScatterChart from './PartScatterChart';

interface PartDashboardProps {
  data: AirgapPoint[];
}

export default function PartDashboard({ data }: PartDashboardProps) {
  // Group data by part
  const partDataMap = new Map<string, AirgapPoint[]>();
  
  for (const point of data) {
    if (!partDataMap.has(point.part)) {
      partDataMap.set(point.part, []);
    }
    partDataMap.get(point.part)!.push(point);
  }


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

