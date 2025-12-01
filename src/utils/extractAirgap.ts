import { 
  PRE_TOGGLE_COLS, 
  POST_TOGGLE_COLS,
} from './constants';
import type { MergedData, AirgapPoint, TechformData } from './types';


// Removed extractAllNumericColumns - we only use columns P, Q, R, S now

/**
 * Extracts pre-toggle airgap values from merged data
 * ONLY uses columns P, Q, R, S from the raw airgap data sheet
 * Focuses on pre-toggle only for now
 */
export function extractAirgapValues(mergedData: MergedData[]): MergedData[] {
  if (mergedData.length === 0) {
    console.warn('extractAirgapValues: No merged data to extract from');
    return mergedData;
  }

  console.log(`Extracting airgap values from ${mergedData.length} merged items`);
  
  const result = mergedData.map((item, index) => {
    const preToggle: { [col: string]: number | null } = {};
    const postToggle: { [col: string]: number | null } = {};
    
    // ONLY extract from columns P, Q, R, S (the 4 airgap columns from raw airgap data)
    for (const col of PRE_TOGGLE_COLS) {
      const value = (item as any)[col];
      if (value !== null && value !== undefined && value !== '') {
        const numValue = Number(value);
        // Airgap sensor readings can be larger numbers (up to 80+), not just -0.80 to 0.80
        // Only exclude serial numbers (integers >= 1000) - allow all other numeric values
        if (!isNaN(numValue) && isFinite(numValue)) {
          // Exclude serial numbers (integers >= 1000) - these are not airgap readings
          if (Number.isInteger(numValue) && numValue >= 1000) {
            preToggle[col] = null; // Skip serial numbers
          } else {
            preToggle[col] = numValue; // Valid airgap sensor reading (can be any range)
          }
        } else {
          preToggle[col] = null;
        }
      } else {
        preToggle[col] = null;
      }
    }
    
    // Extract post-toggle values from columns R, S, T, U (from raw airgap data)
    for (const col of POST_TOGGLE_COLS) {
      const value = (item as any)[col];
      if (value !== null && value !== undefined && value !== '') {
        const numValue = Number(value);
        // Airgap sensor readings can be larger numbers (up to 80+), not just -0.80 to 0.80
        // Only exclude serial numbers (integers >= 1000) - allow all other numeric values
        if (!isNaN(numValue) && isFinite(numValue)) {
          // Exclude serial numbers (integers >= 1000) - these are not airgap readings
          if (Number.isInteger(numValue) && numValue >= 1000) {
            postToggle[col] = null; // Skip serial numbers
          } else {
            postToggle[col] = numValue; // Valid airgap sensor reading (can be any range)
          }
        } else {
          postToggle[col] = null;
        }
      } else {
        postToggle[col] = null;
      }
    }

    // Debug first item
    if (index === 0) {
      console.log('First item extraction:', {
        serial: item.serial,
        part: item.part,
        hasN: 'N' in item,
        hasO: 'O' in item,
        hasP: 'P' in item,
        hasQ: 'Q' in item,
        N: (item as any).N,
        O: (item as any).O,
        P: (item as any).P,
        Q: (item as any).Q,
        preToggle,
        allKeys: Object.keys(item).slice(0, 15)
      });
    }

    return {
      ...item,
      preToggle,
      postToggle,
    };
  });
  
  // Count how many items have valid airgap values
  const itemsWithData = result.filter(item => {
    const hasData = Object.values(item.preToggle).some(v => v !== null);
    return hasData;
  });
  
  console.log(`Extraction complete: ${itemsWithData.length} items have airgap data out of ${result.length} total`);

  return result;
}

/**
 * Converts merged data into tidy AirgapPoint format for charting
 */
export function toTidyFormat(mergedData: MergedData[]): AirgapPoint[] {
  const points: AirgapPoint[] = [];

  console.log(`Converting ${mergedData.length} items to tidy format`);
  
  // Debug: check if merged data has fixtureMeasurement
  if (mergedData.length > 0) {
    const sampleItem = mergedData[0];
    console.log('Sample merged item before conversion:', {
      serial: sampleItem.serial,
      part: sampleItem.part,
      hasFixtureMeasurement: 'fixtureMeasurement' in sampleItem,
      fixtureMeasurement: (sampleItem as any).fixtureMeasurement,
      fixtureMeasurementType: typeof (sampleItem as any).fixtureMeasurement,
      allKeys: Object.keys(sampleItem).slice(0, 15)
    });
  }

  for (const item of mergedData) {
    // Get all pre-toggle columns that have values
    const preCols = Object.keys(item.preToggle).filter(col => item.preToggle[col] !== null);
    // Get all post-toggle columns that have values
    const postCols = Object.keys(item.postToggle).filter(col => item.postToggle[col] !== null);

    // Get fixture measurement from merged data (for X-axis) - get once per item
    const fixtureMeasurement = (item as any).fixtureMeasurement ?? null;
    
    // Debug: log fixture measurement for first few items
    if (points.length < 5) {
      console.log(`Fixture measurement for item ${points.length}:`, {
        serial: item.serial,
        part: item.part,
        fixtureMeasurement: fixtureMeasurement,
        hasFixtureMeasurement: 'fixtureMeasurement' in item,
        allKeys: Object.keys(item).filter(k => k.includes('measurement') || k.includes('Measurement'))
      });
    }

    // Add pre-toggle points
    for (const col of preCols) {
      const value = item.preToggle[col];
      // Airgap values can be any numeric value (not restricted to -0.80 to 0.80)
      // Just ensure it's not a serial number (already filtered in extractAirgapValues)
      if (value !== null && value !== undefined) {
        points.push({
          part: item.part,
          serial: item.serial,
          position: col,
          state: 'pre',
          value: value,  // Airgap sensor reading (Y-axis) - can be larger range
          measurement: fixtureMeasurement,  // Fixture measurement (X-axis) - should be small decimals
          sourceFile: item.sourceFile,
          sheetName: item.sheetName,
        });
      }
    }

    // Add post-toggle points
    for (const col of postCols) {
      const value = item.postToggle[col];
      // Airgap values can be any numeric value (not restricted to -0.80 to 0.80)
      // Just ensure it's not a serial number (already filtered in extractAirgapValues)
      if (value !== null && value !== undefined) {
        points.push({
          part: item.part,
          serial: item.serial,
          position: col,
          state: 'post',
          value: value,  // Airgap sensor reading (Y-axis) - can be larger range
          measurement: fixtureMeasurement,  // Fixture measurement (X-axis) - should be small decimals
          sourceFile: item.sourceFile,
          sheetName: item.sheetName,
        });
      }
    }
  }

  console.log(`Created ${points.length} airgap points from ${mergedData.length} items`);
  if (points.length > 0) {
    console.log('Sample points:', points.slice(0, 3));
    console.log('Unique parts:', [...new Set(points.map(p => p.part))]);
    console.log('Unique positions:', [...new Set(points.map(p => p.position))]);
  } else {
    console.warn('⚠️ No airgap points created!');
  }

  return points;
}

/**
 * Converts raw TechformData directly to AirgapPoint format (for when there are no matches)
 * This allows us to display raw airgap data even if it doesn't match checked fixture data
 */
export function techformDataToAirgapPoints(techformData: TechformData[]): AirgapPoint[] {
  const points: AirgapPoint[] = [];

  for (const item of techformData) {
    // Extract pre-toggle values from P, Q, R, S columns
    const preCols = PRE_TOGGLE_COLS.filter(col => {
      const value = (item as any)[col];
      return value !== null && value !== undefined && value !== '';
    });

    for (const col of preCols) {
      const value = (item as any)[col];
      const numValue = Number(value);
      
      // Only include valid airgap measurements: -0.80 to 0.80
      // Exclude serial numbers (integers >= 1000) and values outside range
      if (!isNaN(numValue) && isFinite(numValue)) {
        // Exclude serial numbers (integers >= 1000) and values outside airgap range
        if (Number.isInteger(numValue) && numValue >= 1000) {
          continue; // Skip serial numbers
        }
        if (Math.abs(numValue) > 0.80) {
          continue; // Skip values outside valid airgap range
        }
        
        points.push({
          part: item.part,
          serial: item.serial,
          position: col,
          state: 'pre',
          value: numValue,
          sourceFile: 'raw_airgap',
        });
      }
    }
  }

  console.log(`Created ${points.length} airgap points from ${techformData.length} raw airgap items (no matches found)`);
  
  return points;
}

/**
 * Filters airgap points by serial and optionally part
 */
export function filterBySerial(
  points: AirgapPoint[],
  serial: string,
  part?: string
): AirgapPoint[] {
  return points.filter(
    (p) => p.serial === serial && (!part || p.part === part)
  );
}

/**
 * Calculates aggregate statistics (average difference post - pre) for each position
 */
export function calculateAggregateStats(points: AirgapPoint[]): {
  position: string;
  avgDifference: number;
  count: number;
}[] {
  // Group by position
  const positionMap = new Map<string, { pre: number[]; post: number[] }>();

  for (const point of points) {
    if (!positionMap.has(point.position)) {
      positionMap.set(point.position, { pre: [], post: [] });
    }

    const data = positionMap.get(point.position)!;
    if (point.value !== null) {
      if (point.state === 'pre') {
        data.pre.push(point.value);
      } else {
        data.post.push(point.value);
      }
    }
  }

  const stats: { position: string; avgDifference: number; count: number }[] = [];

  for (const [position] of positionMap.entries()) {
    // Match pre and post values by serial+part
    const serialPartMap = new Map<string, { pre?: number; post?: number }>();

    for (const point of points) {
      if (point.position === position && point.value !== null) {
        const key = `${point.serial}|${point.part}`;
        if (!serialPartMap.has(key)) {
          serialPartMap.set(key, {});
        }
        const entry = serialPartMap.get(key)!;
        if (point.state === 'pre') {
          entry.pre = point.value;
        } else {
          entry.post = point.value;
        }
      }
    }

    // Calculate differences
    const differences: number[] = [];
    for (const entry of serialPartMap.values()) {
      if (entry.pre !== undefined && entry.post !== undefined) {
        differences.push(entry.post - entry.pre);
      }
    }

    const avgDifference =
      differences.length > 0
        ? differences.reduce((a, b) => a + b, 0) / differences.length
        : 0;

    stats.push({
      position,
      avgDifference,
      count: differences.length,
    });
  }

  return stats.sort((a, b) => a.position.localeCompare(b.position));
}

