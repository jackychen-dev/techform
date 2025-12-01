import React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { NEST_TO_PART_MAP } from '../utils/constants';
import type { AirgapPoint } from '../utils/types';

// Reverse mapping: part name -> nest number
const PART_TO_NEST_MAP: { [key: string]: number } = {};
Object.entries(NEST_TO_PART_MAP).forEach(([nestNum, partName]) => {
  PART_TO_NEST_MAP[partName] = Number(nestNum);
});

interface AdvancedPartScatterChartProps {
  data: AirgapPoint[];
  part: string;
  state: 'pre' | 'post';
}

// Colors for different airgap positions
const AIRGAP_COLORS = [
  '#3b82f6', // Blue
  '#f59e0b', // Orange
  '#6b7280', // Gray
  '#eab308', // Yellow
  '#10b981', // Green
  '#8b5cf6', // Purple
  '#ef4444', // Red
  '#06b6d4', // Cyan
];

const MARKER_SHAPES = ['circle', 'square', 'triangle', 'diamond'] as const;

export default function AdvancedPartScatterChart({ data, part, state: initialState }: AdvancedPartScatterChartProps) {
  // Add toggle state for this chart
  const [currentState, setCurrentState] = React.useState<'pre' | 'post'>(initialState);
  
  // Basic threshold filters (same as original)
  const [filterThresholds, setFilterThresholds] = React.useState<{ [position: string]: string }>({});
  
  // Advanced comparison filters: filter if airgap(s) X > airgap(s) Y by margin
  const [comparisonFilters, setComparisonFilters] = React.useState<{
    leftAirgaps: string[]; // positions (N, O, P, Q) - can be multiple
    rightAirgaps: string[]; // positions (N, O, P, Q) - can be multiple
    margin: string; // numeric margin
    enabled: boolean;
  }[]>([]);
  
  // Filter data for this part and current state
  const allDataForPart = data.filter(
    (p) => p.part === part && p.state === currentState && p.value !== null
  );
  
  // Get all unique positions first
  const allPositions = [...new Set(allDataForPart.map(p => p.position))].sort();
  
  // Group by position to track rejections per airgap
  const positionGroupsBeforeFilter = new Map<string, AirgapPoint[]>();
  for (const point of allDataForPart) {
    if (!positionGroupsBeforeFilter.has(point.position)) {
      positionGroupsBeforeFilter.set(point.position, []);
    }
    positionGroupsBeforeFilter.get(point.position)!.push(point);
  }
  
  // Initialize rejection stats for all positions
  const rejectionStats: { [position: string]: { rejected: number; total: number; percentage: number } } = {};
  allPositions.forEach(position => {
    rejectionStats[position] = { rejected: 0, total: 0, percentage: 0 };
  });
  
  // Group data by serial number for per-serial filtering
  const serialGroups = new Map<string, AirgapPoint[]>();
  for (const point of allDataForPart) {
    if (!serialGroups.has(point.serial)) {
      serialGroups.set(point.serial, []);
    }
    serialGroups.get(point.serial)!.push(point);
  }
  
  // Track which serials are rejected per position and overall
  const rejectedSerialsByPositionIndependent = new Map<string, Set<string>>();
  const rejectedSerialsByPosition = new Map<string, Set<string>>();
  const overallRejectedSerials = new Set<string>();
  const comparisonRejectedSerials = new Set<string>();
  
  // Initialize rejected serials maps for each position
  allPositions.forEach(position => {
    rejectedSerialsByPositionIndependent.set(position, new Set<string>());
    rejectedSerialsByPosition.set(position, new Set<string>());
  });
  
  // Helper function to normalize and parse threshold value
  const parseThreshold = (threshold: string | undefined | null): number | null => {
    if (threshold === null || threshold === undefined) {
      return null;
    }
    
    const thresholdStr = String(threshold).trim();
    
    if (thresholdStr === '' || thresholdStr === '0' || thresholdStr === '0.0' || thresholdStr === '0.00') {
      return null;
    }
    
    let normalizedStr = thresholdStr;
    if (normalizedStr.startsWith('.')) {
      normalizedStr = '0' + normalizedStr;
    }
    
    if (normalizedStr.startsWith('-.')) {
      normalizedStr = '-0' + normalizedStr.substring(1);
    }
    
    const thresholdNum = parseFloat(normalizedStr);
    
    if (isNaN(thresholdNum) || !isFinite(thresholdNum) || thresholdNum <= 0) {
      return null;
    }
    
    return thresholdNum;
  };
  
  // First, calculate independent rejection stats (as if only each filter was on)
  allPositions.forEach(position => {
    const threshold = filterThresholds[position];
    const thresholdNum = parseThreshold(threshold);
    
    if (thresholdNum !== null) {
      serialGroups.forEach((points, serial) => {
        const point = points.find(p => p.position === position);
        if (!point) return;
        
        if (point.value !== null && point.value !== undefined) {
          const absValue = Math.abs(Number(point.value));
          if (absValue > thresholdNum) {
            rejectedSerialsByPositionIndependent.get(position)!.add(serial);
          }
        }
      });
    }
  });
  
  // Apply comparison filters
  serialGroups.forEach((points, serial) => {
    for (const filter of comparisonFilters) {
      if (!filter.enabled) continue;
      
      const margin = parseThreshold(filter.margin);
      if (margin === null) continue;
      
      // Get all left airgap values
      const leftPoints = filter.leftAirgaps
        .map(pos => points.find(p => p.position === pos))
        .filter(p => p && p.value !== null && p.value !== undefined);
      
      // Get all right airgap values
      const rightPoints = filter.rightAirgaps
        .map(pos => points.find(p => p.position === pos))
        .filter(p => p && p.value !== null && p.value !== undefined);
      
      // Skip if we don't have all required values
      if (leftPoints.length !== filter.leftAirgaps.length || 
          rightPoints.length !== filter.rightAirgaps.length) {
        continue;
      }
      
      // Check if any left airgap >= any right airgap + margin
      let shouldReject = false;
      for (const leftPoint of leftPoints) {
        if (!leftPoint || leftPoint.value === null) continue;
        for (const rightPoint of rightPoints) {
          if (!rightPoint || rightPoint.value === null) continue;
          const leftVal = Math.abs(Number(leftPoint.value));
          const rightVal = Math.abs(Number(rightPoint.value));
          
          if (leftVal >= rightVal + margin) {
            shouldReject = true;
            break;
          }
        }
        if (shouldReject) break;
      }
      
      if (shouldReject) {
        comparisonRejectedSerials.add(serial);
      }
    }
  });
  
  // Then, calculate combined rejection stats (with all filters applied)
  serialGroups.forEach((points, serial) => {
    let serialRejected = false;
    
    // Check each position's threshold for this serial
    for (const position of allPositions) {
      const point = points.find(p => p.position === position);
      if (!point) continue;
      
      const threshold = filterThresholds[position];
      const thresholdNum = parseThreshold(threshold);
      
      if (thresholdNum !== null && point.value !== null && point.value !== undefined) {
        const absValue = Math.abs(Number(point.value));
        if (absValue > thresholdNum) {
          rejectedSerialsByPosition.get(position)!.add(serial);
          serialRejected = true;
          break;
        }
      }
    }
    
    // Also check comparison filters (includes both comparison and chain modes)
    if (comparisonRejectedSerials.has(serial)) {
      serialRejected = true;
    }
    
    if (serialRejected) {
      overallRejectedSerials.add(serial);
    }
  });
  
  // Apply filtering: only include points from serials that passed all filters
  let filteredData: AirgapPoint[] = [];
  serialGroups.forEach((points, serial) => {
    if (!overallRejectedSerials.has(serial)) {
      filteredData.push(...points);
    }
  });
  
  // Calculate rejection stats per position
  allPositions.forEach(position => {
    const rejectedSerialsForPositionIndependent = rejectedSerialsByPositionIndependent.get(position) || new Set();
    const totalSerialsForPosition = new Set(
      (positionGroupsBeforeFilter.get(position) || []).map(p => p.serial)
    ).size;
    const rejectedCount = rejectedSerialsForPositionIndependent.size;
    
    rejectionStats[position] = {
      rejected: rejectedCount,
      total: totalSerialsForPosition,
      percentage: totalSerialsForPosition > 0 ? (rejectedCount / totalSerialsForPosition) * 100 : 0
    };
  });

  // Calculate total part count (unique serials for this part)
  const uniqueSerials = new Set(filteredData.map(p => p.serial));
  const totalPartCount = uniqueSerials.size;
  
  // Check if we have any data with fixture measurements
  const dataWithMeasurements = filteredData.filter(p => p.measurement !== null && p.measurement !== undefined);
  const hasMeasurements = dataWithMeasurements.length > 0;

  // Group filtered data by position for charting
  const positionGroupsFiltered = new Map<string, AirgapPoint[]>();
  for (const point of filteredData) {
    if (!positionGroupsFiltered.has(point.position)) {
      positionGroupsFiltered.set(point.position, []);
    }
    positionGroupsFiltered.get(point.position)!.push(point);
  }

  // Prepare scatter data
  const scatterData: any[] = [];
  const positions = filteredData.length > 0 
    ? Array.from(positionGroupsFiltered.keys()).sort()
    : allPositions;
  
  positions.forEach((position) => {
    const points = positionGroupsFiltered.get(position) || [];
    
    points.forEach((point) => {
      // ONLY use fixture measurement for X-axis
      // Do NOT use index as fallback - skip points without fixture measurement
      if (point.measurement === null || point.measurement === undefined) {
        return; // Skip this point - no fixture measurement available
      }
      
      scatterData.push({
        x: point.measurement,
        y: point.value,
        position: position,
        serial: point.serial,
        part: point.part,
        sheetName: point.sheetName,
      });
    });
  });

  // Calculate averages for each position
  const averages: { [position: string]: number } = {};
  positions.forEach((position) => {
    const points = positionGroupsFiltered.get(position) || [];
    const values = points.map((p) => p.value!).filter((v) => v !== null);
    if (values.length > 0) {
      averages[position] = values.reduce((a, b) => a + b, 0) / values.length;
    }
  });

  // Calculate fixture statistics
  const fixtureMeasurements = filteredData
    .map(p => p.measurement)
    .filter(m => m !== null && m !== undefined && !isNaN(Number(m)))
    .map(m => Number(m));
  
  let fixtureRange = 'N/A';
  let fixtureMedian = 'N/A';
  let fixtureAverage = 'N/A';
  let fixtureSpan = 'N/A';
  
  if (fixtureMeasurements.length > 0) {
    const sorted = [...fixtureMeasurements].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    fixtureRange = `${min.toFixed(2)} to ${max.toFixed(2)}`;
    
    const span = max - min;
    fixtureSpan = span.toFixed(2);
    
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
    fixtureMedian = median.toFixed(2);
    
    const sum = fixtureMeasurements.reduce((a, b) => a + b, 0);
    const avg = sum / fixtureMeasurements.length;
    fixtureAverage = avg.toFixed(2);
  }

  // Create series data for each position
  const seriesData = positions.map((position, index) => {
    const points = positionGroupsFiltered.get(position) || [];
    
    // Filter out points without fixture measurements
    const validPoints = points.filter(p => p.measurement !== null && p.measurement !== undefined);
    
    return {
      name: `Airgap ${index + 1} (${position})`,
      data: validPoints.map((point) => ({
        x: point.measurement!,
        y: point.value,
        serial: point.serial,
        position: position,
        airgapNumber: index + 1,
        sheetName: point.sheetName,
      })),
      color: AIRGAP_COLORS[index % AIRGAP_COLORS.length],
      average: averages[position] || 0,
    };
  });

  // Check if both pre and post data exist
  const hasPreData = data.some(p => p.part === part && p.state === 'pre' && p.value !== null);
  const hasPostData = data.some(p => p.part === part && p.state === 'post' && p.value !== null);

  // Handler to add a new comparison filter
  const addComparisonFilter = () => {
    setComparisonFilters([...comparisonFilters, {
      leftAirgaps: [allPositions[0] || 'N'],
      rightAirgaps: [allPositions[1] || 'O'],
      margin: '',
      enabled: true
    }]);
  };

  // Handler to remove a comparison filter
  const removeComparisonFilter = (index: number) => {
    setComparisonFilters(comparisonFilters.filter((_, i) => i !== index));
  };

  // Handler to update a comparison filter
  const updateComparisonFilter = (index: number, field: string, value: any) => {
    const updated = [...comparisonFilters];
    updated[index] = { ...updated[index], [field]: value };
    setComparisonFilters(updated);
  };
  
  // Handler to toggle airgap in left or right side
  const toggleAirgap = (filterIndex: number, side: 'left' | 'right', position: string) => {
    const updated = [...comparisonFilters];
    const filter = updated[filterIndex];
    const airgapsKey = side === 'left' ? 'leftAirgaps' : 'rightAirgaps';
    const currentAirgaps = filter[airgapsKey];
    
    if (currentAirgaps.includes(position)) {
      // Remove if already selected (but keep at least one)
      if (currentAirgaps.length > 1) {
        filter[airgapsKey] = currentAirgaps.filter(p => p !== position);
      }
    } else {
      // Add if not selected
      filter[airgapsKey] = [...currentAirgaps, position].sort();
    }
    
    setComparisonFilters(updated);
  };

  // If there's data but no fixture measurements, show warning
  if (filteredData.length > 0 && !hasMeasurements) {
    return (
      <div className="rounded-lg shadow-sm border-2 border-red-400 p-6" style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(254, 242, 242, 0.98) 100%)' }}>
        <h3 className="text-lg font-semibold text-red-900 mb-2">
          Part Type {PART_TO_NEST_MAP[part] || '?'}: {part} ({currentState === 'pre' ? 'Pre' : 'Post'} Toggle)
        </h3>
        <div className="p-4 bg-red-50 border border-red-300 rounded">
          <p className="text-red-700 font-medium mb-2">⚠️ No Fixture Measurements Available</p>
          <p className="text-sm text-red-600">
            Found {filteredData.length} data points for this part, but none have fixture measurement values.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg shadow-sm border-2 border-purple-400 p-6" style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.98) 100%)' }}>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">
            Part Type {PART_TO_NEST_MAP[part] || '?'}: {part} ({currentState === 'pre' ? 'Pre' : 'Post'} Toggle) - Advanced Filters
          </h3>
          <div className="flex items-center space-x-3">
            {/* Toggle buttons */}
            {hasPreData && hasPostData && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentState('pre')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentState === 'pre'
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                  }`}
                >
                  Pre Toggle
                </button>
                <button
                  onClick={() => setCurrentState('post')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentState === 'post'
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                  }`}
                >
                  Post Toggle
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Basic threshold filters */}
        <div className="mt-3 p-3 border border-blue-300 rounded-lg bg-blue-50">
          <div className="flex items-center space-x-2 flex-wrap mb-2">
            <span className="text-sm text-gray-700 font-medium">Basic Filters:</span>
            {allPositions.map((position, index) => {
              const threshold = filterThresholds[position] || '';
              const stats = rejectionStats[position] || { rejected: 0, total: 0, percentage: 0 };
              return (
                <div key={position} className="flex items-center space-x-1">
                  <label htmlFor={`filter-${part}-${currentState}-${position}`} className="text-xs text-gray-600">
                    Airgap {index + 1}:
                  </label>
                  <input
                    id={`filter-${part}-${currentState}-${position}`}
                    type="text"
                    inputMode="decimal"
                    step="0.01"
                    value={threshold}
                    onChange={(e) => {
                      setFilterThresholds({ ...filterThresholds, [position]: e.target.value });
                    }}
                    placeholder="No filter"
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-xs bg-white text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none"
                  />
                  {(() => {
                    const thresholdNum = parseThreshold(threshold);
                    return thresholdNum !== null && stats.rejected > 0 ? (
                      <span className="text-xs font-semibold text-red-600">
                        ({stats.rejected} - {stats.percentage.toFixed(1)}%)
                      </span>
                    ) : null;
                  })()}
                </div>
              );
            })}
          </div>
        </div>

        {/* Advanced comparison filters */}
        <div className="mt-3 p-3 border border-purple-300 rounded-lg bg-purple-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-700 font-medium">Advanced Comparison Filters:</span>
            <button
              onClick={addComparisonFilter}
              className="px-3 py-1 bg-purple-500 text-white text-xs rounded-md hover:bg-purple-600 transition-colors"
            >
              + Add Filter
            </button>
          </div>
          {comparisonFilters.length === 0 ? (
            <p className="text-xs text-gray-500 italic">No comparison filters added. Click "+ Add Filter" to add one.</p>
          ) : (
            <div className="space-y-3">
              {comparisonFilters.map((filter, filterIndex) => (
                <div key={filterIndex} className="bg-white p-3 rounded border border-purple-200">
                  <div className="flex items-start space-x-2">
                    <input
                      type="checkbox"
                      checked={filter.enabled}
                      onChange={(e) => updateComparisonFilter(filterIndex, 'enabled', e.target.checked)}
                      className="h-4 w-4 mt-1"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="text-xs text-gray-600 font-medium">If</span>
                        {/* Left side airgaps */}
                        <div className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded">
                          {allPositions.map((pos, idx) => (
                            <label key={pos} className="inline-flex items-center space-x-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={filter.leftAirgaps.includes(pos)}
                                onChange={() => toggleAirgap(filterIndex, 'left', pos)}
                                className="h-3 w-3"
                              />
                              <span className="text-xs text-gray-700">AG{idx + 1}</span>
                            </label>
                          ))}
                        </div>
                        <span className="text-xs text-gray-600 font-medium">&gt;</span>
                        {/* Right side airgaps */}
                        <div className="inline-flex items-center space-x-1 px-2 py-1 bg-orange-50 border border-orange-200 rounded">
                          {allPositions.map((pos, idx) => (
                            <label key={pos} className="inline-flex items-center space-x-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={filter.rightAirgaps.includes(pos)}
                                onChange={() => toggleAirgap(filterIndex, 'right', pos)}
                                className="h-3 w-3"
                              />
                              <span className="text-xs text-gray-700">AG{idx + 1}</span>
                            </label>
                          ))}
                        </div>
                        <span className="text-xs text-gray-600 font-medium">by</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={filter.margin}
                          onChange={(e) => updateComparisonFilter(filterIndex, 'margin', e.target.value)}
                          placeholder="margin"
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                        />
                        <button
                          onClick={() => removeComparisonFilter(filterIndex)}
                          className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                        >
                          Remove
                        </button>
                      </div>
                      
                      {/* Display selected condition in readable format */}
                      <div className="text-xs text-gray-500 italic">
                        {filter.leftAirgaps.length > 0 && filter.rightAirgaps.length > 0 && (
                          <>
                            Rejects if any of [{filter.leftAirgaps.map((p) => `Airgap ${allPositions.indexOf(p) + 1}`).join(', ')}] 
                            {' > '}
                            any of [{filter.rightAirgaps.map((p) => `Airgap ${allPositions.indexOf(p) + 1}`).join(', ')}]
                            {filter.margin && ` by ${filter.margin} or more`}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {comparisonRejectedSerials.size > 0 && (
            <div className="mt-2 text-xs text-purple-700 font-semibold">
              Comparison Filters Rejected: {comparisonRejectedSerials.size} parts
            </div>
          )}
        </div>

        {/* Overall rejection stats */}
        {(() => {
          const totalRejected = overallRejectedSerials.size;
          const totalSerials = serialGroups.size;
          const rejectionPercentage = totalSerials > 0 ? (totalRejected / totalSerials) * 100 : 0;
          
          return totalRejected > 0 ? (
            <div className="mt-3 p-2 bg-red-50 border border-red-300 rounded">
              <span className="text-sm font-semibold text-red-600">
                Total Rejected Parts: {totalRejected} / {totalSerials} ({rejectionPercentage.toFixed(1)}%)
              </span>
            </div>
          ) : null;
        })()}

        <div className="mt-3 text-sm text-gray-700">
          <div className="mb-2 font-medium">
            Total Parts Passing All Filters: {totalPartCount}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            {positions.map((position, index) => (
              <div key={position} className="text-gray-600">
                Avg Airgap {index + 1}: {averages[position]?.toFixed(2) || 'N/A'}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-2 border-t border-gray-200">
            <div>
              <span className="font-medium">Fixture Range: </span>
              <span className="text-gray-600">{fixtureRange}</span>
            </div>
            <div>
              <span className="font-medium">Fixture Span: </span>
              <span className="text-gray-600">{fixtureSpan}</span>
            </div>
            <div>
              <span className="font-medium">Fixture Median: </span>
              <span className="text-gray-600">{fixtureMedian}</span>
            </div>
            <div>
              <span className="font-medium">Fixture Average: </span>
              <span className="text-gray-600">{fixtureAverage}</span>
            </div>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            type="number"
            dataKey="x"
            name="Fixture Measurement"
            label={{ value: 'Fixture Measurement', position: 'insideBottom', offset: -5 }}
            stroke="#6b7280"
            tick={{ fill: '#6b7280' }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Air Gap"
            label={{ value: 'Air Gap', angle: -90, position: 'insideLeft', offset: 5 }}
            stroke="#6b7280"
            tick={{ fill: '#6b7280' }}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length > 0) {
                const data = payload[0].payload;
                const measurement = data.x !== null && data.x !== undefined 
                  ? Number(data.x).toFixed(2) 
                  : 'N/A';
                const airgap = data.y !== null && data.y !== undefined 
                  ? Number(data.y).toFixed(2) 
                  : 'N/A';
                const serial = data.serial || 'N/A';
                
                const airgapNumber = data.airgapNumber || 
                  (data.position ? String(positions.indexOf(data.position) + 1) : 'N/A');
                const sheetName = data.sheetName || 'N/A';
                
                return (
                  <div className="bg-white border border-gray-300 rounded-lg shadow-md p-3">
                    <p className="font-medium text-gray-900">Serial: {serial}</p>
                    <p className="text-sm text-gray-600">Airgap: {airgapNumber}</p>
                    <p className="text-sm text-gray-600">Measurement: {measurement}</p>
                    <p className="text-sm text-gray-600">Airgap Value: {airgap}</p>
                    <p className="text-sm text-gray-600">Sheet: {sheetName}</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend />
          {seriesData.length > 0 ? (
            seriesData.map((series, index) => {
              const shapeType = MARKER_SHAPES[index % MARKER_SHAPES.length];
              
              const CustomShape = (props: any) => {
                const { cx, cy } = props;
                const size = 6;
                
                switch (shapeType) {
                  case 'circle':
                    return <circle cx={cx} cy={cy} r={size} fill={series.color} />;
                  case 'square':
                    return <rect x={cx - size} y={cy - size} width={size * 2} height={size * 2} fill={series.color} />;
                  case 'triangle':
                    return (
                      <polygon
                        points={`${cx},${cy - size} ${cx - size},${cy + size} ${cx + size},${cy + size}`}
                        fill={series.color}
                      />
                    );
                  case 'diamond':
                    return (
                      <polygon
                        points={`${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${cx - size},${cy}`}
                        fill={series.color}
                      />
                    );
                  default:
                    return <circle cx={cx} cy={cy} r={size} fill={series.color} />;
                }
              };
              
              return (
                <Scatter
                  key={series.name}
                  name={series.name}
                  data={series.data}
                  fill={series.color}
                  shape={CustomShape}
                />
              );
            })
          ) : (
            <text x="50%" y="50%" textAnchor="middle" fill="#999">
              No data to display
            </text>
          )}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

