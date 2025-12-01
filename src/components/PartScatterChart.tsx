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

interface PartScatterChartProps {
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

export default function PartScatterChart({ data, part, state: initialState }: PartScatterChartProps) {
  // Add toggle state for this chart
  const [currentState, setCurrentState] = React.useState<'pre' | 'post'>(initialState);
  
  // Add filter thresholds for each airgap position (N, O, P, Q or R, S, T, U)
  const [filterThresholds, setFilterThresholds] = React.useState<{ [position: string]: string }>({});
  
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
  
  // Initialize rejection stats for all positions (even if they have no data)
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
  
  // Track which serials are rejected per position (independently, as if only that filter was on)
  const rejectedSerialsByPositionIndependent = new Map<string, Set<string>>();
  // Track which serials are rejected per position and overall (with all filters combined)
  const rejectedSerialsByPosition = new Map<string, Set<string>>();
  const overallRejectedSerials = new Set<string>();
  
  // Initialize rejected serials maps for each position
  allPositions.forEach(position => {
    rejectedSerialsByPositionIndependent.set(position, new Set<string>());
    rejectedSerialsByPosition.set(position, new Set<string>());
  });
  
  // Helper function to normalize and parse threshold value
  // This function is used consistently for ALL positions to ensure identical behavior
  const parseThreshold = (threshold: string | undefined | null): number | null => {
    // Handle empty/null/undefined - return null to indicate no filter
    if (threshold === null || threshold === undefined) {
      return null;
    }
    
    // Convert to string and trim
    const thresholdStr = String(threshold).trim();
    
    // Handle empty string
    if (thresholdStr === '' || thresholdStr === '0' || thresholdStr === '0.0' || thresholdStr === '0.00') {
      return null;
    }
    
    // Handle cases like ".1" (no leading zero) by normalizing the string
    // This ensures ".1", "0.1", ".5", "0.5" all work the same way
    let normalizedStr = thresholdStr;
    if (normalizedStr.startsWith('.')) {
      normalizedStr = '0' + normalizedStr;
    }
    
    // Also handle negative signs at start (shouldn't happen but be safe)
    if (normalizedStr.startsWith('-.')) {
      normalizedStr = '-0' + normalizedStr.substring(1);
    }
    
    // Use parseFloat to handle decimal numbers properly
    const thresholdNum = parseFloat(normalizedStr);
    
    // Return null if invalid (NaN, Infinity, or <= 0), otherwise return the number
    // This ensures 0 means "no filter" but 0.1, 0.5, etc. all work
    if (isNaN(thresholdNum) || !isFinite(thresholdNum) || thresholdNum <= 0) {
      return null;
    }
    
    return thresholdNum;
  };
  
  // First, calculate independent rejection stats (as if only each filter was on)
  allPositions.forEach(position => {
    const threshold = filterThresholds[position];
    const thresholdNum = parseThreshold(threshold);
    
    // Only calculate if this position has a valid threshold
    if (thresholdNum !== null) {
      serialGroups.forEach((points, serial) => {
        const point = points.find(p => p.position === position);
        if (!point) return;
        
        if (point.value !== null && point.value !== undefined) {
          const absValue = Math.abs(Number(point.value));
          if (absValue > thresholdNum) {
            // This serial would be rejected if only this filter was on
            rejectedSerialsByPositionIndependent.get(position)!.add(serial);
          }
        }
      });
    }
  });
  
  // Then, calculate combined rejection stats (with all filters applied)
  // Check each serial: if ANY airgap value exceeds its threshold, reject the entire serial
  // Process ALL positions for each serial to ensure consistent behavior
  serialGroups.forEach((points, serial) => {
    let serialRejected = false;
    
    // Check each position's threshold for this serial
    // Iterate through allPositions to ensure we check them in a consistent order
    for (const position of allPositions) {
      // Find the point for this position in this serial's points
      const point = points.find(p => p.position === position);
      if (!point) continue; // Skip if this serial doesn't have data for this position
      
      const threshold = filterThresholds[position];
      
      // Parse the threshold value (handles ".1", "0.1", etc.) - SAME FUNCTION FOR ALL POSITIONS
      const thresholdNum = parseThreshold(threshold);
      
      // Only apply filter if threshold is valid and point has a value
      if (thresholdNum !== null && point.value !== null && point.value !== undefined) {
        const absValue = Math.abs(Number(point.value));
        // Use direct comparison - should work for all positive numbers including 0.1
        if (absValue > thresholdNum) {
          // This airgap value exceeds threshold - mark this serial as rejected for this position
          rejectedSerialsByPosition.get(position)!.add(serial);
          serialRejected = true;
          break; // Once any airgap fails, reject the entire serial
        }
      }
    }
    if (serialRejected) {
      overallRejectedSerials.add(serial);
    }
  });
  
  // Apply filtering: only include points from serials that passed all filters
  let filteredData: AirgapPoint[] = [];
  serialGroups.forEach((points, serial) => {
    if (!overallRejectedSerials.has(serial)) {
      // Serial passed all filters, include all its points
      filteredData.push(...points);
    }
  });
  
  // Calculate rejection stats per position (count of unique rejected serials)
  // Use independent rejection counts (as if only that filter was on) for display
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

  // Don't return early if filteredData is empty - show empty graph instead

  // Group filtered data by position (airgap measurement point) for charting
  const positionGroupsFiltered = new Map<string, AirgapPoint[]>();
  for (const point of filteredData) {
    if (!positionGroupsFiltered.has(point.position)) {
      positionGroupsFiltered.set(point.position, []);
    }
    positionGroupsFiltered.get(point.position)!.push(point);
  }

  // Prepare scatter data - each position is a series
  const scatterData: any[] = [];
  // If no filtered data, use allPositions to show empty chart with all axes
  const positions = filteredData.length > 0 
    ? Array.from(positionGroupsFiltered.keys()).sort()
    : allPositions;
  
  // Create data points for scatter plot
  // X-axis: fixture measurement value (small decimals -0.80 to 0.80) from nest column
  // Y-axis: airgap sensor reading (can be larger range, up to 80+)
  positions.forEach((position, posIndex) => {
    const points = positionGroupsFiltered.get(position) || [];
    
    // Debug: log first few points to see measurement values
    if (posIndex === 0 && points.length > 0) {
      const samplePoints = points.slice(0, 5).map(p => ({
        serial: p.serial,
        measurement: p.measurement,
        measurementType: typeof p.measurement,
        value: p.value,
        hasMeasurement: p.measurement !== null && p.measurement !== undefined
      }));
      console.log(`Sample points for position ${position} (first 5):`, JSON.stringify(samplePoints, null, 2));
    }
    
    points.forEach((point, pointIndex) => {
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

  // Calculate fixture statistics (from measurement values)
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
    
    // Calculate span (difference between max and min)
    const span = max - min;
    fixtureSpan = span.toFixed(2);
    
    // Calculate median
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
    fixtureMedian = median.toFixed(2);
    
    // Calculate average
    const sum = fixtureMeasurements.reduce((a, b) => a + b, 0);
    const avg = sum / fixtureMeasurements.length;
    fixtureAverage = avg.toFixed(2);
  }

  // Create series data for each position
  const seriesData = positions.map((position, index) => {
    const points = positionGroupsFiltered.get(position) || [];
    
    // Debug: show what X values we're using
    if (index === 0 && points.length > 0) {
      const xAxisDebug = points.slice(0, 10).map((p, idx) => ({
        index: idx,
        measurement: p.measurement,
        measurementType: typeof p.measurement,
        usingMeasurement: p.measurement !== null && p.measurement !== undefined,
        finalX: p.measurement !== null && p.measurement !== undefined ? p.measurement : idx,
        serial: p.serial
      }));
      console.log(`X-axis values for position ${position} (first 10):`, JSON.stringify(xAxisDebug, null, 2));
    }
    
    // Filter out points without fixture measurements
    const validPoints = points.filter(p => p.measurement !== null && p.measurement !== undefined);
    
    return {
      name: `Airgap ${index + 1} (${position})`,
      data: validPoints.map((point) => ({
        x: point.measurement!,
        y: point.value,
        serial: point.serial,
        position: position,
        airgapNumber: index + 1, // Store airgap number (1, 2, 3, 4)
        sheetName: point.sheetName, // Include sheet name from fixture data
      })),
      color: AIRGAP_COLORS[index % AIRGAP_COLORS.length],
      average: averages[position] || 0,
    };
  });

  // Check if both pre and post data exist
  const hasPreData = data.some(p => p.part === part && p.state === 'pre' && p.value !== null);
  const hasPostData = data.some(p => p.part === part && p.state === 'post' && p.value !== null);

  return (
    <div className="rounded-lg shadow-sm border-2 border-blue-400 p-6" style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.98) 100%)' }}>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">
            Part Type {PART_TO_NEST_MAP[part] || '?'}: {part} ({currentState === 'pre' ? 'Pre' : 'Post'} Toggle)
          </h3>
          <div className="flex items-center space-x-3">
            {/* Filter threshold inputs for each airgap position */}
            <div className="flex items-center space-x-2 flex-wrap">
              <span className="text-sm text-gray-700 font-medium">Filters:</span>
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
                        // Store the raw value - parseThreshold will handle normalization
                        setFilterThresholds({ ...filterThresholds, [position]: e.target.value });
                      }}
                      placeholder="No filter"
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-xs bg-white text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none"
                    />
                    {(() => {
                      // Use the same parseThreshold helper to check if threshold is valid
                      const thresholdNum = parseThreshold(threshold);
                      // Show independent rejection count (as if only this filter was on) with percentage
                      return thresholdNum !== null && stats.rejected > 0 ? (
                        <span className="text-xs font-semibold text-red-600">
                          ({stats.rejected} - {stats.percentage.toFixed(1)}%)
                        </span>
                      ) : null;
                    })()}
                  </div>
                );
              })}
              {/* Cumulative rejection count (unique serials) with percentage */}
              {(() => {
                const totalRejected = overallRejectedSerials.size;
                const totalSerials = serialGroups.size;
                const rejectionPercentage = totalSerials > 0 ? (totalRejected / totalSerials) * 100 : 0;
                
                return totalRejected > 0 ? (
                  <span className="text-sm font-semibold text-red-600 ml-2">
                    Total Rejected Parts: {totalRejected} ({rejectionPercentage.toFixed(1)}%)
                  </span>
                ) : null;
              })()}
            </div>
            {/* Toggle buttons */}
            {hasPreData && hasPostData && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentState('pre')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentState === 'pre'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                  }`}
                >
                  Pre Toggle
                </button>
                <button
                  onClick={() => setCurrentState('post')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentState === 'post'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                  }`}
                >
                  Post Toggle
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-700">
          <div className="mb-2 font-medium">
            Total Parts: {totalPartCount}
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
                
                // Get airgap number (1, 2, 3, 4) from data
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
              // Use different shapes for each airgap position (1, 2, 3, 4)
              const shapeType = MARKER_SHAPES[index % MARKER_SHAPES.length];
              
              // Custom shape component based on type
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

