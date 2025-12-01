// Column configuration for Techform files (Raw Airgap files)
export const TECHFORM_SERIAL_COL = "Serial";
export const TECHFORM_SERIAL_NUMBER_COL = "Serial Number"; // Alternative name used in raw airgap files
export const TECHFORM_PART_COL = "Part";
export const TECHFORM_NEST_COL = "Nest"; // Raw airgap files use "Nest" instead of "Part"

// Column configuration for Eclipse files (Checked Fixture files)
export const ECLIPSE_SERIAL_COL = "Serial";
export const ECLIPSE_PART_COL = "Part";

// Nest to Part mapping (Raw airgap files)
// Nest 1 = FRU, Nest 2 = FRL, Nest 3 = FLU, Nest 4 = FLL
// Nest 5 = RRU, Nest 6 = RRL, Nest 7 = RLU, Nest 8 = RLL
export const NEST_TO_PART_MAP: { [key: number]: string } = {
  1: "FRU",
  2: "FRL",
  3: "FLU",
  4: "FLL",
  5: "RRU",
  6: "RRL",
  7: "RLU",
  8: "RLL",
};

// Valid parts filter (using the actual part names)
export const VALID_PARTS = [
  "FRU", "FRL", "FLU", "FLL",
  "RRU", "RRL", "RLU", "RLL"
];

// Pre-toggle airgap columns (P, Q, R, S)
export const PRE_TOGGLE_COLS = ["P", "Q", "R", "S"];

// Post-toggle airgap columns (T, U, V, W)
export const POST_TOGGLE_COLS = ["T", "U", "V", "W"];

// File name patterns
export const TECHFORM_FILE_PREFIX = "Techform Read Probe Values";
export const ECLIPSE_FILE_PREFIX = "Eclipse Check Fixture Sheet Share";

