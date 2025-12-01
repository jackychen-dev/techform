import { useState, useEffect } from 'react';
import FileUploader from './components/FileUploader';
import SummaryStats from './components/SummaryStats';
import PartDashboard from './components/PartDashboard';
import DataScienceDashboard from './components/DataScienceDashboard';
import Tabs from './components/Tabs';
import {
  parseTechformFile,
} from './utils/parseExcel';
import {
  parseAllCheckedFixtureFiles,
} from './utils/parseCheckedFixture';
import { mergeData } from './utils/matchSerials';
import {
  extractAirgapValues,
  toTidyFormat,
  techformDataToAirgapPoints,
} from './utils/extractAirgap';
import type {
  FileUploadResult,
  MergedData,
  AirgapPoint,
} from './utils/types';

function App() {
  const [activeTab, setActiveTab] = useState<string>('upload');
  const [rawAirgapFiles, setRawAirgapFiles] = useState<File[]>([]);
  const [checkedFixtureFiles, setCheckedFixtureFiles] = useState<File[]>([]);
  const [mergedData, setMergedData] = useState<MergedData[]>([]);
  const [airgapPoints, setAirgapPoints] = useState<AirgapPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedFixtureSheetCount, setCheckedFixtureSheetCount] = useState(0);
  const [missingColumns] = useState<string[]>([]);
  const [unmatchedCount, setUnmatchedCount] = useState<number>(0);

  // Handle file selection
  const handleFilesSelected = (result: FileUploadResult) => {
    setRawAirgapFiles(result.rawAirgapFiles);
    setCheckedFixtureFiles(result.checkedFixtureFiles);
    setMergedData([]);
    setAirgapPoints([]);
    setError(null);
  };

  // Parse files when they change
  useEffect(() => {
    const parseFiles = async () => {
      // For now, treat rawAirgapFiles as Techform and checkedFixtureFiles as Eclipse
      // You can adjust this logic based on your actual file structure
      if (rawAirgapFiles.length === 0 || checkedFixtureFiles.length === 0) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Parse first raw airgap file
        console.log('=== PARSING RAW AIRGAP FILE ===');
        const techformData = await parseTechformFile(rawAirgapFiles[0]);
        console.log(`Parsed ${techformData.length} rows from raw airgap file`);
        
        // Count parts in raw airgap data
        const rawPartCounts: { [key: string]: number } = {};
        techformData.forEach(item => {
          rawPartCounts[item.part] = (rawPartCounts[item.part] || 0) + 1;
        });
        console.log('Raw airgap part counts:', rawPartCounts);
        if (techformData.length > 0) {
          console.log('Sample raw airgap data:', {
            serial: techformData[0].serial,
            part: techformData[0].part,
            keys: Object.keys(techformData[0]).slice(0, 10)
          });
        }

        // Parse all checked fixture files using the new parser
        console.log('=== PARSING CHECKED FIXTURE FILES ===');
        const eclipseData = await parseAllCheckedFixtureFiles(checkedFixtureFiles);
        console.log(`Parsed ${eclipseData.length} rows from checked fixture files`);
        
        // Count parts in checked fixture data
        const fixturePartCounts: { [key: string]: number } = {};
        eclipseData.forEach(item => {
          fixturePartCounts[item.part] = (fixturePartCounts[item.part] || 0) + 1;
        });
        console.log('Checked fixture part counts:', fixturePartCounts);
        console.log(`Nest 6 (RRL) in fixture: ${fixturePartCounts['RRL'] || 0} parts`);
        console.log(`Nest 8 (RLL) in fixture: ${fixturePartCounts['RLL'] || 0} parts`);
        
        if (eclipseData.length > 0) {
          console.log('Sample checked fixture data:', {
            serial: eclipseData[0].serial,
            part: eclipseData[0].part,
            sourceFile: eclipseData[0].sourceFile,
            sheetName: eclipseData[0].sheetName,
            keys: Object.keys(eclipseData[0]).slice(0, 10)
          });
          console.log('Unique parts in checked fixture:', [...new Set(eclipseData.map(d => d.part))]);
          console.log('Sample serials:', [...new Set(eclipseData.map(d => d.serial))].slice(0, 5));
        }

        // Count sheets (each checked fixture file may have multiple sheets)
        const sheetCount = new Set(
          eclipseData.map((d) => `${d.sourceFile}|${d.sheetName}`)
        ).size;
        setCheckedFixtureSheetCount(sheetCount);

        // Merge data
        console.log('=== MERGING DATA ===');
        console.log(`Raw airgap: ${techformData.length} rows, Checked fixture: ${eclipseData.length} rows`);
        const mergeResult = mergeData(techformData, eclipseData);
        const merged = mergeResult.merged;
        const unmatchedCount = mergeResult.unmatchedCount;
        console.log(`Merged result: ${merged.length} rows`);
        
        // Set unmatched count for display
        setUnmatchedCount(unmatchedCount);
        if (merged.length === 0 && techformData.length > 0 && eclipseData.length > 0) {
          console.warn('⚠️ No matches found! Checking why...');
          
          const rawSerials = [...new Set(techformData.map(d => d.serial).filter(s => s && s.trim() !== ''))];
          const checkedSerials = [...new Set(eclipseData.map(d => d.serial).filter(s => s && s.trim() !== ''))];
          
          console.log('Raw airgap serials (first 20):', rawSerials.slice(0, 20));
          console.log('Raw airgap parts:', [...new Set(techformData.map(d => d.part))]);
          console.log('Checked fixture serials (first 20):', checkedSerials.slice(0, 20));
          console.log('Checked fixture parts:', [...new Set(eclipseData.map(d => d.part))]);
          
          // Check for any overlap
          const checkedSerialSet = new Set(checkedSerials);
          const overlap = rawSerials.filter(s => checkedSerialSet.has(s));
          console.log('Overlapping serials:', overlap.length > 0 ? overlap.slice(0, 10) : 'NONE FOUND');
          
          // Show sample keys that would be used for matching
          console.log('Sample raw airgap keys (serial|part):', 
            techformData.slice(0, 5).map(d => `${d.serial}|${d.part}`));
          console.log('Sample checked fixture keys (serial|part):', 
            eclipseData.slice(0, 5).map(d => `${d.serial}|${d.part}`));
          
          // Check if serials are in different formats (string vs number)
          const rawSerialTypes = new Set(rawSerials.slice(0, 10).map(s => typeof s));
          const checkedSerialTypes = new Set(checkedSerials.slice(0, 10).map(s => typeof s));
          console.log('Raw airgap serial types:', Array.from(rawSerialTypes));
          console.log('Checked fixture serial types:', Array.from(checkedSerialTypes));
        }

        // Extract airgap values
        const withAirgap = extractAirgapValues(merged);
        console.log('Merged data with airgap:', withAirgap.length, 'items');
        if (withAirgap.length > 0) {
          console.log('First item columns:', Object.keys(withAirgap[0]));
          console.log('First item preToggle:', withAirgap[0].preToggle);
          console.log('First item postToggle:', withAirgap[0].postToggle);
        }

        // Convert to tidy format
        let points = toTidyFormat(withAirgap);
        console.log('=== DATA EXTRACTION SUMMARY ===');
        console.log('Merged items:', withAirgap.length);
        console.log('Airgap points created:', points.length);
        
        // If no matches found, use raw airgap data directly
        if (points.length === 0 && techformData.length > 0) {
          console.warn('⚠️ No matches found - displaying raw airgap data instead');
          points = techformDataToAirgapPoints(techformData);
        }
        
        if (points.length > 0) {
          console.log('Sample points:', points.slice(0, 5));
          console.log('Unique parts:', [...new Set(points.map(p => p.part))]);
          console.log('Unique positions:', [...new Set(points.map(p => p.position))]);
          console.log('Points by state:', {
            pre: points.filter(p => p.state === 'pre').length,
            post: points.filter(p => p.state === 'post').length
          });
        } else {
          console.warn('⚠️ NO AIRGAP POINTS CREATED!');
          console.log('First merged item:', withAirgap[0]);
          console.log('First item preToggle:', withAirgap[0]?.preToggle);
          console.log('First item postToggle:', withAirgap[0]?.postToggle);
        }
        console.log('==============================');

        setMergedData(withAirgap);
        setAirgapPoints(points);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse files');
        console.error('Parse error:', err);
      } finally {
        setLoading(false);
      }
    };

    parseFiles();
  }, [rawAirgapFiles, checkedFixtureFiles]);

  // Calculate summary stats
  const uniqueSerials = new Set(mergedData.map((d) => d.serial)).size;
  const uniqueParts = new Set(mergedData.map((d) => d.part)).size;

  // Define tabs
  const tabs = [
    { id: 'upload', label: 'File Upload' },
    { id: 'dashboard', label: 'Dashboard', count: uniqueParts },
    { id: 'heatmap', label: 'Heatmap' },
    { id: 'datascience', label: 'Data Science' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Airgap Comparison Dashboard
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs Navigation */}
        <div className="rounded-lg shadow-sm border-2 border-gray-300 mb-6" style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.98) 100%)' }}>
          <Tabs activeTab={activeTab} onTabChange={setActiveTab} tabs={tabs} />
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8 rounded-lg shadow-sm border-2 border-blue-400" style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.98) 100%)' }}>
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-gray-700">Parsing files...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            <p className="font-medium">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Tab Content */}
        <div className="space-y-8">
          {/* File Upload Tab */}
          {activeTab === 'upload' && (
            <div className="rounded-lg shadow-sm border-2 border-gray-300 p-6" style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.98) 100%)' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  File Upload
                </h2>
                <button
                  onClick={() => {
                    if (mergedData.length > 0) {
                      // Regenerate dashboard data
                      const withAirgap = extractAirgapValues(mergedData);
                      const points = toTidyFormat(withAirgap);
                      setAirgapPoints(points);
                      console.log('Dashboard regenerated:', points.length, 'points');
                      // Switch to dashboard tab after generation
                      setActiveTab('dashboard');
                    } else {
                      // If no merged data yet, just switch to dashboard tab
                      setActiveTab('dashboard');
                    }
                  }}
                  disabled={loading || (rawAirgapFiles.length === 0 && checkedFixtureFiles.length === 0)}
                  className={`
                    px-6 py-2 rounded-lg font-medium text-white shadow-sm
                    transition-all duration-200
                    ${loading || (rawAirgapFiles.length === 0 && checkedFixtureFiles.length === 0)
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600 hover:shadow-md active:scale-95'
                    }
                  `}
                >
                  {loading ? 'Generating...' : mergedData.length > 0 ? 'Generate Dashboard' : 'View Dashboard'}
                </button>
              </div>
              <FileUploader
                onFilesSelected={handleFilesSelected}
                rawAirgapFiles={rawAirgapFiles}
                checkedFixtureFiles={checkedFixtureFiles}
              />
              
              {/* Summary Stats */}
              {mergedData.length > 0 && (
                <div className="mt-8">
                  <SummaryStats
                    eclipseSheetCount={checkedFixtureSheetCount}
                    matchedSerials={uniqueSerials}
                    matchedParts={uniqueParts}
                    missingColumns={missingColumns}
                    unmatchedCount={unmatchedCount}
                  />
                </div>
              )}
            </div>
          )}

          {/* Dashboard Tab - 8 Part Graphs */}
          {activeTab === 'dashboard' && (
            <div>
              {airgapPoints.length > 0 ? (
                <PartDashboard data={airgapPoints} />
              ) : (
                <div className="rounded-lg shadow-sm border-2 border-blue-400 p-12 text-center" style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.98) 100%)' }}>
                  <p className="text-gray-700 text-lg mb-4">
                    {mergedData.length > 0
                      ? 'Click "Generate Dashboard" in the File Upload tab to create visualizations'
                      : 'No data available. Please upload files in the File Upload tab.'}
                  </p>
                  {mergedData.length > 0 && (
                    <p className="text-sm text-gray-500">
                      {mergedData.length} merged records ready to visualize
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Heatmap Tab */}
          {activeTab === 'heatmap' && (
            <div>
              {airgapPoints.length > 0 ? (
                <div className="rounded-lg shadow-sm border-2 border-blue-400 p-6" style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.98) 100%)' }}>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Heatmap Visualization
                  </h2>
                  <div className="rounded-lg p-12 text-center border-2 border-dashed border-blue-400" style={{ background: 'linear-gradient(135deg, rgba(249, 250, 251, 0.6) 0%, rgba(243, 244, 246, 0.4) 100%)' }}>
                    <p className="text-gray-700 text-lg mb-2">
                      Heatmap visualization coming soon
                    </p>
                    <p className="text-gray-500 text-sm">
                      {airgapPoints.length} data points available for visualization
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg shadow-sm border-2 border-blue-400 p-12 text-center" style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.98) 100%)' }}>
                  <p className="text-gray-700 text-lg">
                    No data available. Please upload files in the File Upload tab.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Data Science Tab */}
          {activeTab === 'datascience' && (
            <div>
              {airgapPoints.length > 0 ? (
                <DataScienceDashboard data={airgapPoints} />
              ) : (
                <div className="rounded-lg shadow-sm border-2 border-purple-400 p-12 text-center" style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.98) 100%)' }}>
                  <p className="text-gray-700 text-lg mb-4">
                    {mergedData.length > 0
                      ? 'Click "Generate Dashboard" in the File Upload tab to create visualizations'
                      : 'No data available. Please upload files in the File Upload tab.'}
                  </p>
                  {mergedData.length > 0 && (
                    <p className="text-sm text-gray-500">
                      {mergedData.length} merged records ready to visualize
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;

