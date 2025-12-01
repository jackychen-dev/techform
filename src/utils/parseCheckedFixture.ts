import * as XLSX from 'xlsx';
import type { EclipseData } from './types';
import { NEST_TO_PART_MAP } from './constants';

/**
 * Converts Excel column letter to 0-based index
 */
function columnLetterToIndex(colLetter: string): number {
  let colIndex = 0;
  for (let i = 0; i < colLetter.length; i++) {
    colIndex = colIndex * 26 + (colLetter.charCodeAt(i) - 64);
  }
  return colIndex - 1;
}

/**
 * Converts 0-based index to Excel column letter
 */
function indexToColumnLetter(index: number): string {
  let result = '';
  index++;
  while (index > 0) {
    index--;
    result = String.fromCharCode(65 + (index % 26)) + result;
    index = Math.floor(index / 26);
  }
  return result;
}

/**
 * Gets cell value from worksheet by column letter and row number (1-based)
 */
function getCellValue(worksheet: XLSX.WorkSheet, colLetter: string, row: number): any {
  const colIndex = columnLetterToIndex(colLetter);
  const cellAddress = XLSX.utils.encode_cell({ c: colIndex, r: row - 1 });
  const cell = worksheet[cellAddress];
  return cell ? cell.v : null;
}

/**
 * Finds nest positions by scanning multiple rows for nest patterns like "FLU [3] (Hole)"
 * Tries rows 10-20 to find where nest information is located
 */
function findNestPositions(worksheet: XLSX.WorkSheet, sheetName: string): Map<number, string> {
  const nestPositions = new Map<number, string>();
  
  // Try multiple rows (10-20) to find nest positions
  for (let row = 10; row <= 20; row++) {
    for (let col = 0; col < 50; col++) { // Check first 50 columns
      const colLetter = indexToColumnLetter(col);
      const value = getCellValue(worksheet, colLetter, row);
      
      if (value !== null && value !== undefined) {
        const strValue = String(value).trim();
        let nestNum: number | null = null;
        
        // Look for pattern like "FLU [3] (Hole)" or "FRU [1] (Hole)"
        // Extract number from brackets - this is the primary format
        const bracketMatch = strValue.match(/\[(\d+)\]/);
        if (bracketMatch) {
          nestNum = Number(bracketMatch[1]);
          // Validate it's a valid nest number (1-8)
          if (nestNum >= 1 && nestNum <= 8) {
            // Found a valid nest in bracket format
          } else {
            nestNum = null; // Invalid nest number
          }
        } else {
          // Fallback: try as direct number (in case format is just "3")
          nestNum = Number(strValue);
          if (isNaN(nestNum) || nestNum < 1 || nestNum > 8) {
            // Try extracting any number from the string as last resort
            const numMatch = strValue.match(/(\d+)/);
            if (numMatch) {
              const extracted = Number(numMatch[1]);
              if (extracted >= 1 && extracted <= 8) {
                nestNum = extracted;
              } else {
                nestNum = null;
              }
            } else {
              nestNum = null;
            }
          }
        }
        
        if (nestNum !== null && !isNaN(nestNum) && nestNum >= 1 && nestNum <= 8) {
          // Only set if we haven't found this nest number yet, or if this is row 13 (preferred)
          if (!nestPositions.has(nestNum) || row === 13) {
            nestPositions.set(nestNum, colLetter);
            console.log(`Found Nest ${nestNum} (${strValue}) at ${colLetter}${row} in sheet "${sheetName}"`);
          }
        }
      }
    }
    
    // If we found all 8 nests, we can stop
    if (nestPositions.size === 8) {
      break;
    }
  }
  
  // Debug: show what we found
  if (nestPositions.size === 0) {
    console.warn(`No nest positions found in sheet "${sheetName}". Searching for nest patterns...`);
    
    // Search more thoroughly - check all rows 1-30 and all columns
    const foundPatterns: string[] = [];
    for (let row = 1; row <= 30; row++) {
      for (let col = 0; col < 30; col++) {
        const colLetter = indexToColumnLetter(col);
        const value = getCellValue(worksheet, colLetter, row);
        if (value !== null && value !== undefined) {
          const strValue = String(value).trim();
          // Look for any pattern with brackets containing numbers
          if (strValue.includes('[') && strValue.includes(']')) {
            foundPatterns.push(`${colLetter}${row}: "${strValue}"`);
          }
        }
      }
    }
    
    if (foundPatterns.length > 0) {
      console.log(`Found ${foundPatterns.length} cells with bracket patterns:`, foundPatterns.slice(0, 10));
    } else {
      console.log('No cells with bracket patterns found. Showing row 13 values:');
      // Show first 30 columns of row 13 for debugging
      const row13Values: string[] = [];
      for (let col = 0; col < 30; col++) {
        const colLetter = indexToColumnLetter(col);
        const value = getCellValue(worksheet, colLetter, 13);
        if (value !== null && value !== undefined) {
          row13Values.push(`${colLetter}13: "${String(value)}"`);
        }
      }
      console.log('Row 13 values:', row13Values.slice(0, 20).join(', '));
    }
  } else {
    console.log(`✓ Found ${nestPositions.size} nest positions in sheet "${sheetName}":`, 
      Array.from(nestPositions.entries()).map(([n, c]) => `Nest ${n} at ${c}`).join(', '));
  }
  
  return nestPositions;
}

/**
 * Parses a checked fixture sheet with the specific structure:
 * - Nest numbers at row 13 in various columns (D13, I13, N13, etc.)
 * - Fixture measurement value directly below nest number (row 14+)
 * - Serial number to the right of measurement (typically F14 for Nest 3)
 * 
 * NOTE: This parser ONLY extracts:
 * 1. Serial numbers
 * 2. Part types (from nest numbers)
 * 3. Fixture measurement values (from nest column)
 * 4. Metadata (sourceFile, sheetName)
 * 
 * It does NOT extract airgap sensor values - those come from raw airgap data files only!
 */
export function parseCheckedFixtureSheet(
  worksheet: XLSX.WorkSheet,
  sheetName: string,
  fileName: string
): EclipseData[] {
  const results: EclipseData[] = [];
  
  // Find all nest positions (searches rows 10-20)
  const nestPositions = findNestPositions(worksheet, sheetName);
  
  if (nestPositions.size === 0) {
    console.warn(`No nest positions found in sheet "${sheetName}"`);
    return results;
  }
  
  // Determine the header row - it's the row where we found the nests
  // We'll assume data starts 1 row below the nest positions
  // But first, let's find which row has the nests
  let headerRow = 13; // Default
  // Check if nests are in a different row by scanning
  for (let row = 10; row <= 20; row++) {
    let nestsInRow = 0;
    for (const [nestNum, colLetter] of nestPositions.entries()) {
      const value = getCellValue(worksheet, colLetter, row);
      const numValue = Number(value);
      if (!isNaN(numValue) && numValue === nestNum) {
        nestsInRow++;
      }
    }
    if (nestsInRow >= 3) { // If we find at least 3 nests in this row, it's likely the header
      headerRow = row;
      break;
    }
  }
  
  console.log(`Using row ${headerRow} as header row for sheet "${sheetName}"`);
  
  // NOTE: We do NOT extract airgap columns from checked fixture files!
  // The checked fixture file only provides fixture measurement (from nest column)
  // Airgap sensor readings (P, Q, R, S, T, U, V, W) ONLY come from raw airgap data files
  // These columns in the checked fixture file contain fixture measurements, not airgap sensors
  
  // Find the data range - look for rows with data starting from headerRow + 1
  const dataStartRow = headerRow + 1;
  console.log(`Starting data extraction from row ${dataStartRow} for sheet "${sheetName}"`);
  
  // Debug: show what's in the first data row for one nest to understand structure
  if (nestPositions.size > 0) {
    const firstNest = Array.from(nestPositions.entries())[0];
    const [firstNestNum, firstNestCol] = firstNest;
    console.log(`\n=== DEBUG: Row ${dataStartRow} structure for Nest ${firstNestNum} at ${firstNestCol} ===`);
    for (let offset = 0; offset <= 6; offset++) {
      const colIndex = columnLetterToIndex(firstNestCol) + offset;
      const colLetter = indexToColumnLetter(colIndex);
      const value = getCellValue(worksheet, colLetter, dataStartRow);
      const headerValue = getCellValue(worksheet, colLetter, headerRow);
      console.log(`  ${colLetter}${headerRow}: ${headerValue !== null ? JSON.stringify(String(headerValue).substring(0, 30)) : 'empty'} | ${colLetter}${dataStartRow}: ${value !== null ? JSON.stringify(String(value).substring(0, 30)) : 'empty'}`);
    }
    console.log(`=== End debug ===\n`);
  }
  
  // Continue until we find empty rows
  for (let row = dataStartRow; row <= 1000; row++) {
    let hasData = false;
    
    // Check each nest position
    for (const [nestNum, nestCol] of nestPositions.entries()) {
      // Get fixture measurement value (directly below nest number, same column)
      // This is the X-axis value - small decimals like -0.07, 0.04, etc.
      // SPECIAL CASE: "Oct 23rd New gauge" sheet has different layout - measurement might be in different column
      const isSpecialSheet = sheetName.toLowerCase().includes('oct 23rd new gauge') || 
                            sheetName.toLowerCase().includes('new gauge');
      
      let measurement = null;
      if (isSpecialSheet) {
        // For special sheets, try to find measurement in nearby columns
        // Check the column directly below nest, and also columns to the left/right
        const baseMeasurement = getCellValue(worksheet, nestCol, row);
        const numBase = baseMeasurement !== null ? Number(baseMeasurement) : null;
        
        // If base value is a large number (like 25), it's probably not the measurement
        // Look for a small decimal in nearby columns
        if (numBase !== null && !isNaN(numBase) && Math.abs(numBase) > 1) {
          // Try columns to the left and right
          const offsets = [-1, 1, -2, 2, -3, 3];
          for (const offset of offsets) {
            const testColIndex = columnLetterToIndex(nestCol) + offset;
            if (testColIndex >= 0) {
              const testCol = indexToColumnLetter(testColIndex);
              const testValue = getCellValue(worksheet, testCol, row);
              const testNum = testValue !== null ? Number(testValue) : null;
              if (testNum !== null && !isNaN(testNum) && Math.abs(testNum) <= 0.80 && !Number.isInteger(testNum)) {
                measurement = testValue;
                if (row <= dataStartRow + 3 && nestNum === 1) {
                  console.log(`⚠️ Special sheet "${sheetName}": Found measurement ${testNum} at ${testCol}${row} instead of ${nestCol}${row} (value: ${numBase})`);
                }
                break;
              }
            }
          }
          // If no small decimal found, try dividing by 100 or 1000 (in case it's a scale issue)
          if (measurement === null && numBase !== null) {
            const scaledDown = numBase / 100;
            if (Math.abs(scaledDown) <= 0.80) {
              measurement = scaledDown;
              if (row <= dataStartRow + 3 && nestNum === 1) {
                console.log(`⚠️ Special sheet "${sheetName}": Scaled measurement ${numBase} -> ${scaledDown} for Nest ${nestNum} at ${nestCol}${row}`);
              }
            } else {
              const scaledDown2 = numBase / 1000;
              if (Math.abs(scaledDown2) <= 0.80) {
                measurement = scaledDown2;
                if (row <= dataStartRow + 3 && nestNum === 1) {
                  console.log(`⚠️ Special sheet "${sheetName}": Scaled measurement ${numBase} -> ${scaledDown2} for Nest ${nestNum} at ${nestCol}${row}`);
                }
              } else {
                // Use the base value anyway (might be correct)
                measurement = baseMeasurement;
              }
            }
          } else if (measurement === null) {
            measurement = baseMeasurement;
          }
        } else {
          measurement = baseMeasurement;
        }
      } else {
        measurement = getCellValue(worksheet, nestCol, row);
      }
      
      // Get serial number - based on debug output, serial is 1 column to the right
      // N13 (Nest 7) -> O14 (Serial), I13 (Nest 4) -> J14 (Serial)
      // So offset is 1, not 2!
      let serial = null;
      let serialCol = null;
      
      // Invalid serial patterns to skip
      const invalidSerials = new Set(['n/a', 'fail', 'pass', 'na', 'n/a', '', '0', 'null', 'undefined', 'p']);
      
      // Try different column offsets to find serial number
      // IMPORTANT: Only accept serial at offset 1 (the expected location)
      // If serial is found at wrong offset, disregard the row to avoid measurement confusion
      const expectedOffset = 1; // Serial should be 1 column to the right of nest
      const serialColIndex = columnLetterToIndex(nestCol) + expectedOffset;
      const testSerialCol = indexToColumnLetter(serialColIndex);
      const testSerial = getCellValue(worksheet, testSerialCol, row);
      
      if (testSerial !== null && testSerial !== undefined) {
        const serialStr = String(testSerial).trim();
        const serialLower = serialStr.toLowerCase();
        
        // Skip invalid serial values
        if (!invalidSerials.has(serialLower) && serialStr !== '') {
          // Accept any positive integer as a serial number - no threshold limits
          // Just ensure it's a positive integer (not a decimal or negative)
          const numValue = Number(testSerial);
          if (!isNaN(numValue) && Number.isInteger(numValue) && numValue > 0) {
            // This is a valid numeric serial at the expected location
            serial = String(Math.round(numValue)); // Round to remove decimals
            serialCol = testSerialCol;
            if (row === dataStartRow && nestNum === 3) {
              console.log(`✓ Found serial "${serial}" at ${testSerialCol}${row} for Nest ${nestNum} (offset ${expectedOffset})`);
            }
          } else if (serialStr.length >= 3 && 
                     !serialLower.includes('nest') &&
                     !serialLower.includes('hole') &&
                     !serialLower.includes('pass') &&
                     !serialLower.includes('fail') &&
                     !serialLower.includes('pin')) {
            // Accept text serials that aren't common invalid values
            // But skip if it's a small decimal number (likely a measurement)
            const testNum = Number(serialStr);
            if (isNaN(testNum) || Math.abs(testNum) >= 100 || Number.isInteger(testNum)) {
              serial = serialStr;
              serialCol = testSerialCol;
            }
          }
        }
      }
      
      // Skip if no valid serial found at expected location
      // This prevents using wrong columns which could confuse measurement extraction
      if (!serial) {
        continue;
      }
      
      // Extract fixture measurement from nest column - this is the X-axis value
      // Should be small decimals (-0.80 to 0.80), not whole numbers or serial numbers
      let validMeasurement = null;
      if (measurement !== null && measurement !== undefined && measurement !== '') {
        const numValue = Number(measurement);
        if (!isNaN(numValue) && isFinite(numValue)) {
          // Fixture measurements are small decimals: -0.80 to 0.80
          // Exclude serial numbers (integers >= 100) and values outside range
          // Accept small decimals like -0.07, 0.04, -0.11, etc.
          // Also accept 0, -0, 0.00, etc.
          if (Math.abs(numValue) <= 0.80) {
            // Exclude serial numbers - if it's an integer >= 100, it's likely a serial
            // But accept all other values (decimals, small integers like 0, 1, -1)
            if (Number.isInteger(numValue) && Math.abs(numValue) >= 100) {
              // Skip - this is likely a serial number, not a measurement
            } else {
              // Accept: small decimals or small integers (0, 1, -1, etc. are valid measurements)
              validMeasurement = numValue;
            }
          }
        }
      }
      
      // Debug: log measurement extraction for first few rows
      if (row <= dataStartRow + 5 && nestNum === 3) {
        const numVal = measurement !== null ? Number(measurement) : null;
        const isInt = numVal !== null ? Number.isInteger(numVal) : null;
        const absVal = numVal !== null ? Math.abs(numVal) : null;
        const inRange = absVal !== null ? absVal <= 0.80 : null;
        const isSerial = isInt && numVal !== null && Math.abs(numVal) >= 100;
        
        // Expand the object for better debugging
        const debugInfo = {
          rawValue: measurement,
          rawType: typeof measurement,
          numValue: numVal,
          isInteger: isInt,
          absValue: absVal,
          inRange: inRange,
          isSerial: isSerial,
          isValid: validMeasurement !== null,
          validMeasurement: validMeasurement,
          reason: validMeasurement === null 
            ? (measurement === null || measurement === undefined || measurement === '' 
                ? 'empty' 
                : numVal === null || isNaN(numVal) || !isFinite(numVal)
                  ? 'not a number'
                  : !inRange
                    ? 'out of range'
                    : isSerial
                      ? 'looks like serial'
                      : 'unknown')
            : 'valid'
        };
        console.log(`Measurement extraction for Nest ${nestNum} at ${nestCol}${row}:`, JSON.stringify(debugInfo, null, 2));
      }
      
      // NOTE: We do NOT extract airgap sensor values from the checked fixture file!
      // Airgap values (P, Q, R, S, T, U, V, W) ONLY come from the raw airgap data file.
      // The checked fixture file ONLY provides:
      // 1. Serial number
      // 2. Part type  
      // 3. Fixture measurement (from nest column)
      // 4. Metadata (sourceFile, sheetName)
      
      hasData = true;
      
      // Convert nest to part name - ensure it's a valid part
      const part = NEST_TO_PART_MAP[nestNum];
      if (!part) {
        console.warn(`Invalid nest number ${nestNum} - skipping`);
        continue;
      }
      
      // Serial should already be validated above, but double-check
      const finalSerial = String(serial).trim();
      
      // Create data object with ONLY metadata and fixture measurement
      // DO NOT include airgap sensor values - those come from raw airgap file only!
      const rowData: EclipseData = {
        serial: finalSerial,
        part: part,
        sourceFile: fileName,
        sheetName: sheetName,
        rawRow: undefined, // We'll preserve the raw row if needed
        fixtureMeasurement: validMeasurement, // Store fixture measurement for X-axis (from nest column)
        // NO airgap columns here! They come from raw airgap data only.
      };
      
      results.push(rowData);
    }
    
    // If no data found in this row after checking all nests, we might have reached the end
    if (!hasData && row > 20) {
      // Check a few more rows to be sure
      let emptyRows = 0;
      for (let checkRow = row; checkRow < row + 5; checkRow++) {
        let rowHasData = false;
        for (const nestCol of nestPositions.values()) {
          const testValue = getCellValue(worksheet, nestCol, checkRow);
          if (testValue !== null && testValue !== undefined && testValue !== '') {
            rowHasData = true;
            break;
          }
        }
        if (!rowHasData) emptyRows++;
      }
      if (emptyRows >= 3) {
        break; // Likely reached the end
      }
    }
  }
  
  console.log(`Parsed ${results.length} rows from sheet "${sheetName}"`);
  if (results.length > 0) {
    const sampleCount = Math.min(5, results.length);
    console.log(`Sample extracted data from "${sheetName}" (first ${sampleCount}):`, 
      results.slice(0, sampleCount).map(r => ({
        serial: r.serial,
        part: r.part,
        fixtureMeasurement: r.fixtureMeasurement,
        sourceFile: r.sourceFile
      })));
    
    // Show unique serials from this sheet
    const uniqueSerials = [...new Set(results.map(r => r.serial))];
    console.log(`Unique serials in "${sheetName}":`, uniqueSerials.slice(0, 10));
  }
  return results;
}

/**
 * Parses all sheets from a checked fixture file
 */
export async function parseCheckedFixtureFile(file: File): Promise<EclipseData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('Failed to read file'));
          return;
        }

        const workbook = XLSX.read(data, { type: 'binary' });
        const allData: EclipseData[] = [];

        console.log(`📊 Found ${workbook.SheetNames.length} sheets in ${file.name}:`, workbook.SheetNames);

        // Parse every sheet in the workbook
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          try {
            const sheetData = parseCheckedFixtureSheet(worksheet, sheetName, file.name);
            allData.push(...sheetData);
            console.log(`✓ Parsed sheet "${sheetName}": ${sheetData.length} rows`);
          } catch (error) {
            console.warn(`⚠️ Error parsing sheet "${sheetName}":`, error);
            // Continue with other sheets
          }
        }

        console.log(`Total rows parsed from ${file.name}: ${allData.length}`);
        resolve(allData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
}

/**
 * Parses all checked fixture files
 */
export async function parseAllCheckedFixtureFiles(files: File[]): Promise<EclipseData[]> {
  const allData: EclipseData[] = [];

  for (const file of files) {
    try {
      const fileData = await parseCheckedFixtureFile(file);
      allData.push(...fileData);
    } catch (error) {
      console.error(`Error parsing checked fixture file ${file.name}:`, error);
      throw error;
    }
  }

  return allData;
}

