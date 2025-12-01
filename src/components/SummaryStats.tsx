import { FileText, Database, Package, AlertCircle } from 'lucide-react';

interface SummaryStatsProps {
  eclipseSheetCount: number;
  matchedSerials: number;
  matchedParts: number;
  missingColumns: string[];
  unmatchedCount: number;
}

export default function SummaryStats({
  eclipseSheetCount,
  matchedSerials,
  matchedParts,
  missingColumns,
  unmatchedCount,
}: SummaryStatsProps) {
  return (
    <div className="rounded-lg shadow-sm border-2 border-gray-300 p-6" style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.98) 100%)' }}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Summary Statistics
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center space-x-3 p-4 rounded-lg border-2 border-blue-400" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.03) 100%)' }}>
          <FileText className="h-8 w-8 text-blue-600" />
          <div>
            <p className="text-sm text-gray-600">Checked Fixture Sheets Parsed</p>
            <p className="text-2xl font-bold text-gray-900">
              {eclipseSheetCount}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 p-4 rounded-lg border-2 border-green-500" style={{ background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(34, 197, 94, 0.03) 100%)' }}>
          <Database className="h-8 w-8 text-green-600" />
          <div>
            <p className="text-sm text-gray-600">Matched Serials</p>
            <p className="text-2xl font-bold text-gray-900">
              {matchedSerials}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 p-4 rounded-lg border-2 border-purple-500" style={{ background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(168, 85, 247, 0.03) 100%)' }}>
          <Package className="h-8 w-8 text-purple-600" />
          <div>
            <p className="text-sm text-gray-600">Matched Parts</p>
            <p className="text-2xl font-bold text-gray-900">
              {matchedParts}
            </p>
          </div>
        </div>
      </div>

      {unmatchedCount > 0 && (
        <div className="mt-4 p-4 border-2 border-orange-500 rounded-lg" style={{ background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(249, 115, 22, 0.03) 100%)' }}>
          <div className="flex items-center space-x-2 text-orange-700 mb-2">
            <AlertCircle className="h-5 w-5" />
            <p className="font-medium">
              {unmatchedCount} serial{unmatchedCount !== 1 ? 's' : ''} from raw data not found in measurement sheets
            </p>
          </div>
          <p className="text-sm text-gray-600">
            These serials exist in the raw airgap data but do not have corresponding measurements in the checked fixture files.
          </p>
        </div>
      )}

      {missingColumns.length > 0 && (
        <div className="mt-4 p-4 border-2 border-yellow-500 rounded-lg" style={{ background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.08) 0%, rgba(234, 179, 8, 0.03) 100%)' }}>
          <div className="flex items-center space-x-2 text-yellow-700 mb-2">
            <AlertCircle className="h-5 w-5" />
            <p className="font-medium">Missing Columns Detected</p>
          </div>
          <ul className="list-disc list-inside text-sm text-gray-600">
            {missingColumns.map((col, idx) => (
              <li key={idx}>{col}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

