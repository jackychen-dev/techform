import { VALID_PARTS } from './constants';
import type { TechformData, EclipseData, MergedData } from './types';

/**
 * Merges Techform and Eclipse data on serial and part
 * ONLY matches serials that exist in raw airgap data (techformData)
 * If a serial isn't in raw airgap data, it won't be matched
 */
export function mergeData(
  techformData: TechformData[],
  eclipseData: EclipseData[]
): { merged: MergedData[]; unmatchedCount: number } {
  console.log('mergeData called with:', {
    techformCount: techformData.length,
    eclipseCount: eclipseData.length
  });
  
  // Helper to normalize serial (handle string/number, trim whitespace)
  const normalizeSerial = (serial: any): string => {
    if (serial === null || serial === undefined) return '';
    const str = String(serial).trim();
    // Remove any leading zeros if it's a numeric string (e.g., "022678" -> "22678")
    if (/^\d+$/.test(str)) {
      return String(Number(str)); // Convert to number then back to string to remove leading zeros
    }
    return str;
  };

  // Create map of raw airgap data by serial+part
  // Only serials in this map will be matched
  const techformMapBySerialPart = new Map<string, TechformData>();
  
  for (const item of techformData) {
    // Only include items with valid serials (non-empty)
    const normalizedSerial = normalizeSerial(item.serial);
    if (normalizedSerial !== '') {
      const key = `${normalizedSerial}|${item.part}`;
      techformMapBySerialPart.set(key, item);
    }
  }
  
  console.log(`Created techform map with ${techformMapBySerialPart.size} entries (only serials from raw airgap)`);
  console.log('Sample techform keys:', Array.from(techformMapBySerialPart.keys()).slice(0, 10));
  
  // Debug: Show actual serial values from both sources
  const techformSerials = new Set(techformData.map(item => normalizeSerial(item.serial)).filter(s => s !== ''));
  const eclipseSerials = new Set(eclipseData.map(item => normalizeSerial(item.serial)).filter(s => s !== ''));
  
  console.log('=== SERIAL COMPARISON ===');
  console.log('Raw airgap unique serials (first 20):', Array.from(techformSerials).slice(0, 20));
  console.log('Checked fixture unique serials (first 20):', Array.from(eclipseSerials).slice(0, 20));
  
  const overlapping = Array.from(techformSerials).filter(s => eclipseSerials.has(s));
  console.log('Overlapping serials:', overlapping.length > 0 ? overlapping.slice(0, 20) : 'NONE FOUND');
  
  if (overlapping.length === 0 && techformSerials.size > 0 && eclipseSerials.size > 0) {
    console.warn('⚠️ NO OVERLAPPING SERIALS FOUND!');
    console.log('Raw airgap serial range:', {
      min: Math.min(...Array.from(techformSerials).map(s => Number(s)).filter(n => !isNaN(n))),
      max: Math.max(...Array.from(techformSerials).map(s => Number(s)).filter(n => !isNaN(n)))
    });
    console.log('Checked fixture serial range:', {
      min: Math.min(...Array.from(eclipseSerials).map(s => Number(s)).filter(n => !isNaN(n))),
      max: Math.max(...Array.from(eclipseSerials).map(s => Number(s)).filter(n => !isNaN(n)))
    });
  }

  const merged: MergedData[] = [];
  let exactMatchCount = 0;
  let noMatchCount = 0;
  let invalidPartCount = 0;
  let missingSerialCount = 0;

  // Match Eclipse data with Techform data
  // ONLY match if the serial exists in raw airgap data
  // ONLY include rows that have matches in BOTH files
  for (const eclipseItem of eclipseData) {
    // Only process if part is in VALID_PARTS
    if (!VALID_PARTS.includes(eclipseItem.part)) {
      invalidPartCount++;
      continue;
    }

    // Skip if eclipse item doesn't have a serial
    const normalizedEclipseSerial = normalizeSerial(eclipseItem.serial);
    if (normalizedEclipseSerial === '') {
      missingSerialCount++;
      continue;
    }

    // Try to match by serial+part (using normalized serials)
    // ONLY if this serial exists in raw airgap data
    const exactKey = `${normalizedEclipseSerial}|${eclipseItem.part}`;
    const techformItem = techformMapBySerialPart.get(exactKey);

    if (techformItem) {
      // Exact match found - serial exists in both files
      exactMatchCount++;
      
      // Merge the data
      // IMPORTANT: Spread order matters - eclipseItem last so fixtureMeasurement is preserved
      const mergedItem: MergedData = {
        serial: techformItem.serial, // Use raw airgap serial (source of truth)
        part: techformItem.part,
        sourceFile: eclipseItem.sourceFile,
        sheetName: eclipseItem.sheetName,
        preToggle: {},
        postToggle: {},
        rawRow: techformItem.rawRow || eclipseItem.rawRow,
        ...techformItem, // Preserve all raw airgap data (has the measurements N, O, P, Q)
        ...eclipseItem, // Then overlay Eclipse data (has metadata including fixtureMeasurement)
      };
      
      // Debug: log fixtureMeasurement preservation for first few matches
      if (exactMatchCount < 3) {
        console.log(`Merge item ${exactMatchCount}:`, {
          serial: mergedItem.serial,
          part: mergedItem.part,
          hasFixtureMeasurement: 'fixtureMeasurement' in mergedItem,
          fixtureMeasurement: (mergedItem as any).fixtureMeasurement,
          eclipseFixtureMeasurement: (eclipseItem as any).fixtureMeasurement,
          allKeys: Object.keys(mergedItem).filter(k => k.includes('measurement') || k.includes('Measurement') || k === 'N' || k === 'O' || k === 'P' || k === 'Q')
        });
      }
      
      merged.push(mergedItem);
    } else {
      // Serial not found in raw airgap data - skip it (don't try to match)
      noMatchCount++;
      continue;
    }
  }

  // Count parts in merged data
  const mergedPartCounts: { [key: string]: number } = {};
  merged.forEach(item => {
    mergedPartCounts[item.part] = (mergedPartCounts[item.part] || 0) + 1;
  });

  // Count unmatched raw airgap items (items that exist in raw airgap but not in checked fixture)
  const unmatchedCount = techformData.length - exactMatchCount;

  console.log(`\n=== MERGE RESULTS SUMMARY ===`);
  console.log(`Merge results: ${merged.length} total matches`);
  console.log(`  - Exact matches (serial+part): ${exactMatchCount}`);
  console.log(`  - No match (serial not in raw airgap): ${noMatchCount}`);
  console.log(`  - Invalid parts: ${invalidPartCount}`);
  console.log(`  - Missing serials in checked fixture: ${missingSerialCount}`);
  console.log(`  - Unmatched raw airgap items (no fixture data): ${unmatchedCount}`);
  console.log(`\nMerged part counts:`, mergedPartCounts);
  console.log(`Nest 6 (RRL) after merge: ${mergedPartCounts['RRL'] || 0} parts`);
  console.log(`Nest 8 (RLL) after merge: ${mergedPartCounts['RLL'] || 0} parts`);
  console.log(`=============================\n`);

  // Return both merged data and unmatched count
  return { merged, unmatchedCount };
}

/**
 * Gets unique parts from merged data
 */
export function getUniqueParts(mergedData: MergedData[]): string[] {
  const parts = new Set<string>();
  for (const item of mergedData) {
    parts.add(item.part);
  }
  return Array.from(parts).sort();
}

/**
 * Gets unique serials from merged data, optionally filtered by part
 */
export function getUniqueSerials(mergedData: MergedData[], part?: string): string[] {
  const serials = new Set<string>();
  for (const item of mergedData) {
    if (!part || item.part === part) {
      serials.add(item.serial);
    }
  }
  return Array.from(serials).sort();
}

