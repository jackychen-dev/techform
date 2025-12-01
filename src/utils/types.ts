// Raw row data from Excel
export interface ExcelRow {
  [key: string]: any;
}

// Raw array row for column index access
export type RawRow = any[];

// Parsed Techform data
export interface TechformData {
  serial: string;
  part: string;
  rawRow?: RawRow; // Raw array for column index access
  [key: string]: any;
}

// Parsed Eclipse data with metadata
export interface EclipseData {
  serial: string;
  part: string;
  sourceFile: string;
  sheetName: string;
  rawRow?: RawRow; // Raw array for column index access
  [key: string]: any;
}

// Merged data combining Techform and Eclipse
export interface MergedData {
  serial: string;
  part: string;
  sourceFile: string;
  sheetName: string;
  preToggle: { [col: string]: number | null };
  postToggle: { [col: string]: number | null };
  rawRow?: RawRow; // Raw array for column index access
  [key: string]: any; // Allow additional properties
}

// Tidy airgap point for charting
export interface AirgapPoint {
  part: string;
  serial: string;
  position: string;  // N–Q (pre) or R–V (post)
  state: "pre" | "post";
  value: number | null;  // Airgap sensor reading (Y-axis) - should be -0.80 to 0.80
  measurement?: number | null;  // Fixture measurement (X-axis) - should be -0.80 to 0.80
  sourceFile?: string;
  sheetName?: string;
}

// File upload result
export interface FileUploadResult {
  rawAirgapFiles: File[];
  checkedFixtureFiles: File[];
}

