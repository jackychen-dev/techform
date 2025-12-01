import { getUniqueParts, getUniqueSerials } from '../utils/matchSerials';
import type { MergedData } from '../utils/types';

interface SerialSelectorProps {
  mergedData: MergedData[];
  selectedPart: string;
  selectedSerial: string;
  onPartChange: (part: string) => void;
  onSerialChange: (serial: string) => void;
}

export default function SerialSelector({
  mergedData,
  selectedPart,
  selectedSerial,
  onPartChange,
  onSerialChange,
}: SerialSelectorProps) {
  const parts = getUniqueParts(mergedData);
  const serials = getUniqueSerials(mergedData, selectedPart || undefined);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label
          htmlFor="part-select"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Part
        </label>
        <select
          id="part-select"
          value={selectedPart}
          onChange={(e) => {
            onPartChange(e.target.value);
            onSerialChange(''); // Reset serial when part changes
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select a part</option>
          {parts.map((part) => (
            <option key={part} value={part}>
              {part}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="serial-select"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Serial
        </label>
        <select
          id="serial-select"
          value={selectedSerial}
          onChange={(e) => onSerialChange(e.target.value)}
          disabled={!selectedPart}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="">Select a serial</option>
          {serials.map((serial) => (
            <option key={serial} value={serial}>
              {serial}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}


