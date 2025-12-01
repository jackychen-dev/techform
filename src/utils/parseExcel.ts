import * as XLSX from 'xlsx';
import {
  TECHFORM_PART_COL,
  TECHFORM_NEST_COL,
  ECLIPSE_SERIAL_COL,
  ECLIPSE_PART_COL,
  TECHFORM_FILE_PREFIX,
  ECLIPSE_FILE_PREFIX,
  NEST_TO_PART_MAP,
  VALID_PARTS,
} from './constants';
import type { ExcelRow, TechformData, EclipseData, FileUploadResult } from './types';

/**
 * Detects if a file is a Techform file based on filename
 */
export function isTechformFile(filename: string): boolean {
  return filename.startsWith(TECHFORM_FILE_PREFIX);
}

/**
 * Detects if a file is an Eclipse file based on filename
 */
export function isEclipseFile(filename: string): boolean {
  return filename.startsWith(ECLIPSE_FILE_PREFIX);
}

/**
 * Categorizes uploaded files into Techform and Eclipse files
 */
export function categorizeFiles(files: File[]): FileUploadResult {
  const result: FileUploadResult = {
    rawAirgapFiles: [],
    checkedFixtureFiles: [],
  };

  for (const file of files) {
    if (isTechformFile(file.name)) {
      result.rawAirgapFiles.push(file);
    } else if (isEclipseFile(file.name)) {
      result.checkedFixtureFiles.push(file);
    }
  }

  if (result.rawAirgapFiles.length === 0) {
    throw new Error('No Techform file detected. Please upload a file starting with "Techform Read Probe Values".');
  }

  return result;
}

/**
 * Finds a column name in a case-insensitive way, with trimming
 * Also handles partial matches for common variations
 */
function findColumnKey(columns: string[], targetName: string): string | null {
  const normalizedTarget = targetName.toLowerCase().trim();
  
  // First try exact match (case-insensitive, trimmed)
  for (const col of columns) {
    if (col.toLowerCase().trim() === normalizedTarget) {
      return col;
    }
  }
  
  // If exact match fails, try partial match for "Serial Number" variations
  if (normalizedTarget.includes('serial') && normalizedTarget.includes('number')) {
    for (const col of columns) {
      const colLower = col.toLowerCase().trim();
      if (colLower.includes('serial') && colLower.includes('number')) {
        return col;
      }
      // Also check for "Serial Num" (truncated)
      if (colLower.includes('serial') && colLower.includes('num')) {
        return col;
      }
    }
  }
  
  // For "Serial" alone, try to find any column containing "serial"
  if (normalizedTarget === 'serial') {
    for (const col of columns) {
      const colLower = col.toLowerCase().trim();
      if (colLower === 'serial' || colLower.startsWith('serial ')) {
        return col;
      }
    }
  }
  
  return null;
}

/**
 * Parses a CSV file and converts it to the same format as Excel
 */
async function parseCSVFile(file: File): Promise<TechformData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          reject(new Error('Failed to read CSV file'));
          return;
        }
        
        // Parse CSV manually - split by lines and commas
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        
        if (lines.length === 0) {
          reject(new Error('CSV file is empty'));
          return;
        }
        
        // Parse each line - handle quoted values
        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };
        
        const rows = lines.map(line => parseCSVLine(line));
        
        // Skip header row (first row)
        const dataRows = rows.slice(1);
        
        console.log(`📋 CSV file structure: ${dataRows.length} data rows`);
        console.log(`  - Column C (index 2): Serial Number`);
        console.log(`  - Column D (index 3): Part Type`);
        console.log(`  - Columns P, Q, R, S (indices 15-18): Pre-toggle airgap values`);
        console.log(`  - Columns T, U, V, W (indices 19-22): Post-toggle airgap values`);
        
        const serialColIndex = 2; // Column C
        const nestColIndex = 3; // Column D
        
        const columnLetterToIndex = (colLetter: string): number => {
          let colIndex = 0;
          for (let i = 0; i < colLetter.length; i++) {
            colIndex = colIndex * 26 + (colLetter.charCodeAt(i) - 64);
          }
          return colIndex - 1;
        };
        
        const airgapColIndices = {
          P: columnLetterToIndex('P'), // 15
          Q: columnLetterToIndex('Q'), // 16
          R: columnLetterToIndex('R'), // 17
          S: columnLetterToIndex('S'), // 18
          T: columnLetterToIndex('T'), // 19
          U: columnLetterToIndex('U'), // 20
          V: columnLetterToIndex('V'), // 21
          W: columnLetterToIndex('W'), // 22
        };
        
        const validateAirgapValue = (value: any): number | null => {
          if (value === null || value === undefined || value === '') return null;
          const numValue = Number(value);
          if (isNaN(numValue) || !isFinite(numValue)) return null;
          if (Number.isInteger(numValue) && numValue >= 1000) return null;
          return numValue;
        };
        
        const parsed: TechformData[] = dataRows.map((row) => {
          const serialRaw = row[serialColIndex];
          let serial = '';
          
          if (serialRaw !== null && serialRaw !== undefined && serialRaw !== '') {
            const serialStr = String(serialRaw).trim();
            const serialNum = Number(serialStr);
            if (!isNaN(serialNum) && Number.isInteger(serialNum) && serialNum > 0) {
              serial = String(serialNum);
            } else {
              const cleanedSerial = serialStr.replace(/[^0-9]/g, '');
              if (cleanedSerial && cleanedSerial.length > 0) {
                const cleanedNum = Number(cleanedSerial);
                if (!isNaN(cleanedNum) && Number.isInteger(cleanedNum) && cleanedNum > 0) {
                  serial = String(cleanedNum);
                }
              }
            }
          }
          
          const partValueRaw = row[nestColIndex];
          let part: string = '';
          
          if (partValueRaw !== null && partValueRaw !== undefined && partValueRaw !== '') {
            const partValueStr = String(partValueRaw).trim();
            
            let nestNum: number | null = null;
            
            if (typeof partValueRaw === 'number') {
              nestNum = partValueRaw;
            } else {
              const numMatch = partValueStr.match(/\b([1-8])\b/);
              if (numMatch) {
                nestNum = parseInt(numMatch[1], 10);
              } else {
                const parsed = parseInt(partValueStr, 10);
                if (!isNaN(parsed) && parsed >= 1 && parsed <= 8) {
                  nestNum = parsed;
                }
              }
            }
            
            if (nestNum !== null && NEST_TO_PART_MAP[nestNum]) {
              part = NEST_TO_PART_MAP[nestNum];
            } else {
              const upperPart = partValueStr.toUpperCase();
              if (VALID_PARTS.includes(upperPart)) {
                part = upperPart;
              } else {
                part = partValueStr;
              }
            }
          }
          
          const airgapValues = {
            P: validateAirgapValue(row[airgapColIndices.P]),
            Q: validateAirgapValue(row[airgapColIndices.Q]),
            R: validateAirgapValue(row[airgapColIndices.R]),
            S: validateAirgapValue(row[airgapColIndices.S]),
            T: validateAirgapValue(row[airgapColIndices.T]),
            U: validateAirgapValue(row[airgapColIndices.U]),
            V: validateAirgapValue(row[airgapColIndices.V]),
            W: validateAirgapValue(row[airgapColIndices.W]),
          };
          
          return {
            serial,
            part,
            rawRow: row,
            // Include both pre-toggle (P, Q, R, S) and post-toggle (T, U, V, W) columns
            P: airgapValues.P,
            Q: airgapValues.Q,
            R: airgapValues.R,
            S: airgapValues.S,
            T: airgapValues.T,
            U: airgapValues.U,
            V: airgapValues.V,
            W: airgapValues.W,
          };
        }).filter((item) => {
          return item.serial && item.serial.trim() !== '' && item.part && item.part.trim() !== '';
        });
        
        const partCounts: { [key: string]: number } = {};
        parsed.forEach(item => {
          partCounts[item.part] = (partCounts[item.part] || 0) + 1;
        });
        
        console.log(`\n=== CSV FILE PARSING SUMMARY ===`);
        console.log(`Parsed ${parsed.length} rows from CSV file`);
        console.log(`Part counts:`, partCounts);
        console.log(`================================\n`);
        
        resolve(parsed);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read CSV file'));
    reader.readAsText(file);
  });
}

/**
 * Parses a Techform Excel file
 */
export async function parseTechformFile(file: File): Promise<TechformData[]> {
  // Check if it's a CSV file
  if (file.name.toLowerCase().endsWith('.csv')) {
    return parseCSVFile(file);
  }
  
  // Otherwise parse as Excel
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
        
        // Find the "Passed Parts" sheet - case insensitive search
        let worksheet = null;
        let sheetName = null;
        for (const name of workbook.SheetNames) {
          if (name.toLowerCase().includes('passed parts') || name.toLowerCase() === 'passed parts') {
            worksheet = workbook.Sheets[name];
            sheetName = name;
            break;
          }
        }
        
        // If "Passed Parts" not found, try first sheet as fallback
        if (!worksheet) {
          console.warn(`⚠️ "Passed Parts" sheet not found. Available sheets: ${workbook.SheetNames.join(', ')}`);
          console.warn(`Using first sheet "${workbook.SheetNames[0]}" as fallback`);
          sheetName = workbook.SheetNames[0];
          worksheet = workbook.Sheets[sheetName];
        } else {
          console.log(`✓ Found "Passed Parts" sheet: "${sheetName}"`);
        }
        
        // Parse with headers for easy access
        const rows: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet, { defval: null });
        // Parse as raw arrays for column index access
        const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

        // Validate columns exist
        if (rows.length === 0) {
          reject(new Error('Raw airgap file is empty'));
          return;
        }

        // Raw airgap file structure:
        // Column C (index 2): Serial Number
        // Column D (index 3): Part Type/Nest Number
        // Columns P, Q, R, S: Pre-toggle airgap values
        // Columns T, U, V, W: Post-toggle airgap values
        
        // Use column C directly for serial numbers (index 2)
        const serialColIndex = 2; // Column C
        const nestColIndex = 3; // Column D (Part Type/Nest Number)
        
        // Also find by name as fallback for validation
        const firstRow = rows[0];
        const availableColumns = Object.keys(firstRow);
        // Find columns for validation (not used in parsing but kept for potential future use)
        findColumnKey(availableColumns, TECHFORM_NEST_COL);
        findColumnKey(availableColumns, TECHFORM_PART_COL);
        
        // Validate that we have data
        if (rows.length === 0) {
          reject(new Error('Raw airgap file is empty'));
          return;
        }
        
        // Log what we're using
        console.log(`📋 Raw airgap file structure:`);
        console.log(`  - Column C (index ${serialColIndex}): Serial Number`);
        console.log(`  - Column D (index ${nestColIndex}): Part Type/Nest Number`);
        console.log(`  - Columns P, Q, R, S: Pre-toggle airgap values`);
        console.log(`  - Columns T, U, V, W: Post-toggle airgap values`);
        
        // Debug: show first few raw rows to verify structure
        if (rawRows.length > 1) {
          console.log(`Sample raw rows (first 3):`, rawRows.slice(0, 3).map((row, idx) => ({
            rowIndex: idx,
            columnC: row[2],
            columnD: row[3],
            columnP: row[15],
            columnQ: row[16],
            columnR: row[17],
            columnS: row[18]
          })));
        }

        // Helper function to convert column letter to index (A=0, B=1, ..., N=13, O=14, P=15, Q=16)
        const columnLetterToIndex = (colLetter: string): number => {
          let colIndex = 0;
          for (let i = 0; i < colLetter.length; i++) {
            colIndex = colIndex * 26 + (colLetter.charCodeAt(i) - 64);
          }
          return colIndex - 1;
        };

        // Get indices for columns P, Q, R, S (pre-toggle) and T, U, V, W (post-toggle)
        const airgapColIndices = {
          P: columnLetterToIndex('P'), // 15
          Q: columnLetterToIndex('Q'), // 16
          R: columnLetterToIndex('R'), // 17
          S: columnLetterToIndex('S'), // 18
          T: columnLetterToIndex('T'), // 19
          U: columnLetterToIndex('U'), // 20
          V: columnLetterToIndex('V'), // 21
          W: columnLetterToIndex('W'), // 22
        };

        // Map rows with ONLY columns P, Q, R, S, T, U, V, W from raw data
        // Use rawRows to access by column index (C=2, D=3, P=15, Q=16, R=17, S=18, T=19, U=20, V=21, W=22)
        const parsed: TechformData[] = rows.map((_row, index) => {
          // rawRows[0] is the header row, so data starts at rawRows[1]
          const rawRow = rawRows[index + 1] || []; // +1 to skip header row
          
          // Debug: show what's in the first few columns for first few rows
          if (index < 3) {
            console.log(`Raw row ${index + 1} structure:`, {
              length: rawRow.length,
              column0: rawRow[0],
              column1: rawRow[1],
              column2: rawRow[2],
              column3: rawRow[3],
              first10Columns: rawRow.slice(0, 10)
            });
          }
          
          // Get serial from column B (index 1) using raw row data
          const serialRaw = rawRow[serialColIndex];
          let serial = '';
          
          if (serialRaw !== null && serialRaw !== undefined && serialRaw !== '') {
            const serialStr = String(serialRaw).trim();
            // Accept any positive integer from column B - no threshold limits
            const serialNum = Number(serialStr);
            if (!isNaN(serialNum) && Number.isInteger(serialNum) && serialNum > 0) {
              serial = String(serialNum);
            } else {
              // If it's not a valid integer, log it for debugging
              // Also check if it might be a number stored as text with extra characters
              const cleanedSerial = serialStr.replace(/[^0-9]/g, ''); // Remove non-numeric characters
              if (cleanedSerial && cleanedSerial.length > 0) {
                const cleanedNum = Number(cleanedSerial);
                if (!isNaN(cleanedNum) && Number.isInteger(cleanedNum) && cleanedNum > 0) {
                  serial = String(cleanedNum);
                  if (index < 10) {
                    console.log(`✓ Row ${index + 1}: Cleaned serial "${serialStr}" -> "${serial}"`);
                  }
                } else {
                  if (index < 10) {
                    console.warn(`⚠️ Row ${index + 1}: Column B value "${serialStr}" is not a positive integer. Skipping row.`);
                  }
                }
              } else {
                if (index < 10) {
                  console.warn(`⚠️ Row ${index + 1}: Column B value "${serialStr}" is not a positive integer. Skipping row.`);
                }
              }
            }
          }
          
          // Get Nest/Part from column A (index 0) using raw row data
          const partValueRaw = rawRow[nestColIndex];
          const partValue = partValueRaw !== null && partValueRaw !== undefined && partValueRaw !== ''
            ? partValueRaw
            : null;
          
          // Convert Nest number to part name if needed
          // Column A contains "Part Type/Nest Number" - could be a number (1-8) or part name
          let part: string = '';
          if (partValue !== null && partValue !== undefined && partValue !== '') {
            const partValueStr = String(partValue).trim();
            
            // Try to parse as nest number first (could be "6", "8", 6, 8, etc.)
            let nestNum: number | null = null;
            
            // If it's already a number, use it directly
            if (typeof partValue === 'number') {
              nestNum = partValue;
            } else {
              // Try to extract number from string (e.g., "6", "Nest 6", "6 (Slot)", etc.)
              const numMatch = partValueStr.match(/\b([1-8])\b/);
              if (numMatch) {
                nestNum = parseInt(numMatch[1], 10);
              } else {
                // Try direct parseInt
                const parsed = parseInt(partValueStr, 10);
                if (!isNaN(parsed) && parsed >= 1 && parsed <= 8) {
                  nestNum = parsed;
                }
              }
            }
            
            // If we found a valid nest number, map it to part name
            if (nestNum !== null && NEST_TO_PART_MAP[nestNum]) {
              part = NEST_TO_PART_MAP[nestNum];
            } else {
              // If not a valid nest number, check if it's already a part name (RRL, RLL, etc.)
              const upperPart = partValueStr.toUpperCase();
              if (VALID_PARTS.includes(upperPart)) {
                part = upperPart;
              } else {
                // Use the value as-is (might be a part name we don't recognize)
                part = partValueStr;
              }
            }
          }
          
          // Debug: log first few serials to verify we're reading from column B
          if (index < 5) {
            console.log(`Row ${index + 1}: Column A (part/nest) = "${partValue}", Column B (serial) = "${serial}", Extracted part = "${part}"`);
          }
          
          // Special debug for part type 6 to catch all rows BEFORE filtering
          if (partValue === 6 || partValue === '6' || String(partValue).trim() === '6') {
            console.log(`Part Type 6 Row ${index + 1}: raw partValue="${partValue}" (type: ${typeof partValue}), extracted part="${part}", serial="${serial}", colA="${rawRow[0]}", colB="${rawRow[1]}"`);
          }
          
          // Debug: log ALL rows for Nest 6 and Nest 8 specifically to catch missing ones
          if (part === 'RRL' || part === 'RLL') {
            console.log(`Nest 6/8 Debug - Row ${index + 1}: partValue="${partValue}", part="${part}", serial="${serial}", colA="${rawRow[0]}", colB="${rawRow[1]}"`);
          }
          
          // Extract ONLY columns P, Q, R, S, T, U, V, W from raw row
          // Validate that values are airgap measurements, not serial numbers
          // rawRow is already defined above, so we can use it here
          
          const validateAirgapValue = (value: any): number | null => {
            if (value === null || value === undefined || value === '') return null;
            const numValue = Number(value);
            if (isNaN(numValue) || !isFinite(numValue)) return null;
            // Exclude serial numbers (integers >= 1000) - but allow all other numeric values
            // Airgap sensor readings can be larger numbers, not just -0.80 to 0.80
            if (Number.isInteger(numValue) && numValue >= 1000) return null; // Serial number
            return numValue; // Allow any other numeric value
          };
          
          // Extract values by index to avoid header name issues
          const airgapValues = {
            P: validateAirgapValue(rawRow[airgapColIndices.P]),
            Q: validateAirgapValue(rawRow[airgapColIndices.Q]),
            R: validateAirgapValue(rawRow[airgapColIndices.R]),
            S: validateAirgapValue(rawRow[airgapColIndices.S]),
            T: validateAirgapValue(rawRow[airgapColIndices.T]),
            U: validateAirgapValue(rawRow[airgapColIndices.U]),
            V: validateAirgapValue(rawRow[airgapColIndices.V]),
            W: validateAirgapValue(rawRow[airgapColIndices.W]),
          };
          
          // Debug: log airgap values for first few rows
          if (index < 3) {
            console.log(`Excel Row ${index + 1} airgap extraction:`, {
              serial,
              part,
              P: airgapValues.P,
              Q: airgapValues.Q,
              R: airgapValues.R,
              S: airgapValues.S,
              T: airgapValues.T,
              U: airgapValues.U,
              V: airgapValues.V,
              W: airgapValues.W,
              rawRowLength: rawRow.length
            });
          }
          
          return {
            serial,
            part,
            rawRow: rawRow, // Keep raw row for reference
            // Include both pre-toggle (P, Q, R, S) and post-toggle (T, U, V, W) columns
            // Store with column letter keys for consistent access
            P: airgapValues.P,
            Q: airgapValues.Q,
            R: airgapValues.R,
            S: airgapValues.S,
            T: airgapValues.T,
            U: airgapValues.U,
            V: airgapValues.V,
            W: airgapValues.W,
          };
        }).filter((item) => {
          // Filter: require both serial AND part to be present (as per user requirement)
          // If serial number isn't in raw airgap data, don't include the row
          return item.serial && item.serial.trim() !== '' && item.part && item.part.trim() !== '';
        });

        // Debug: count parts by type
        const partCounts: { [key: string]: number } = {};
        const serialsByPart: { [key: string]: string[] } = {};
        parsed.forEach(item => {
          partCounts[item.part] = (partCounts[item.part] || 0) + 1;
          if (!serialsByPart[item.part]) {
            serialsByPart[item.part] = [];
          }
          serialsByPart[item.part].push(item.serial);
        });
        console.log(`\n=== RAW AIRGAP FILE PARSING SUMMARY ===`);
        console.log(`Parsed ${parsed.length} rows from raw airgap file (expected up to 180)`);
        console.log(`Part counts:`, partCounts);
        console.log(`Nest 6 (RRL): ${partCounts['RRL'] || 0} parts`);
        console.log(`Nest 8 (RLL): ${partCounts['RLL'] || 0} parts`);
        if (serialsByPart['RRL']) {
          console.log(`RRL serials (ALL ${serialsByPart['RRL'].length}):`, serialsByPart['RRL'].sort((a, b) => Number(a) - Number(b)));
        }
        if (serialsByPart['RLL']) {
          console.log(`RLL serials (ALL ${serialsByPart['RLL'].length}):`, serialsByPart['RLL'].sort((a, b) => Number(a) - Number(b)));
        }
        console.log(`========================================\n`);
        if (parsed.length > 180) {
          console.warn(`⚠️ Got more than 180 rows (${parsed.length}). Expected at most 180.`);
        }
        resolve(parsed);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
}

/**
 * Parses all sheets from an Eclipse Excel file
 */
export async function parseEclipseFile(file: File): Promise<EclipseData[]> {
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

        // Parse every sheet in the workbook
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          
          // Parse with headers for easy access
          const rows: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet, { defval: null });
          // Parse as raw arrays for column index access
          const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

          if (rows.length === 0) continue;

          const firstRow = rows[0];
          const availableColumns = Object.keys(firstRow);
          
          // Find columns with case-insensitive matching
          const serialCol = findColumnKey(availableColumns, ECLIPSE_SERIAL_COL);
          const partCol = findColumnKey(availableColumns, ECLIPSE_PART_COL);

          if (!serialCol || !partCol) {
            console.warn(
              `Sheet "${sheetName}" in file "${file.name}" missing required columns: ${ECLIPSE_SERIAL_COL} or ${ECLIPSE_PART_COL}. ` +
              `Available columns: ${availableColumns.slice(0, 10).join(', ')}`
            );
            continue;
          }

          // Map rows with raw data (skip header row in rawRows)
          const parsed: EclipseData[] = rows.map((row, index) => ({
            serial: String(row[serialCol] || '').trim(),
            part: String(row[partCol] || '').trim(),
            sourceFile: file.name,
            sheetName,
            rawRow: rawRows[index + 1] || [], // +1 to skip header row
            ...row,
          })).filter((item) => item.serial && item.part);

          allData.push(...parsed);
        }

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
 * Parses all Eclipse files and combines their data
 */
export async function parseAllEclipseFiles(files: File[]): Promise<EclipseData[]> {
  const allData: EclipseData[] = [];

  for (const file of files) {
    try {
      const fileData = await parseEclipseFile(file);
      allData.push(...fileData);
    } catch (error) {
      console.error(`Error parsing Eclipse file ${file.name}:`, error);
      throw error;
    }
  }

  return allData;
}

