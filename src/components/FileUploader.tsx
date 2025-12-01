import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X } from 'lucide-react';
import type { FileUploadResult } from '../utils/types';

interface FileUploaderProps {
  onFilesSelected: (result: FileUploadResult) => void;
  rawAirgapFiles: File[];
  checkedFixtureFiles: File[];
}

export default function FileUploader({
  onFilesSelected,
  rawAirgapFiles,
  checkedFixtureFiles,
}: FileUploaderProps) {
  const [error, setError] = useState<string | null>(null);

  const onDropRawAirgap = useCallback(
    (acceptedFiles: File[]) => {
      try {
        setError(null);
        onFilesSelected({
          rawAirgapFiles: acceptedFiles,
          checkedFixtureFiles,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    },
    [onFilesSelected, checkedFixtureFiles]
  );

  const onDropCheckedFixture = useCallback(
    (acceptedFiles: File[]) => {
      try {
        setError(null);
        onFilesSelected({
          rawAirgapFiles,
          checkedFixtureFiles: acceptedFiles,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    },
    [onFilesSelected, rawAirgapFiles]
  );

  const rawAirgapDropzone = useDropzone({
    onDrop: onDropRawAirgap,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm'],
      'application/vnd.ms-excel': ['.xls'],
    },
    multiple: true,
  });

  const checkedFixtureDropzone = useDropzone({
    onDrop: onDropCheckedFixture,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm'],
      'application/vnd.ms-excel': ['.xls'],
    },
    multiple: true,
  });

  const removeRawAirgapFile = (index: number) => {
    const newFiles = rawAirgapFiles.filter((_, i) => i !== index);
    onFilesSelected({
      rawAirgapFiles: newFiles,
      checkedFixtureFiles,
    });
  };

  const removeCheckedFixtureFile = (index: number) => {
    const newFiles = checkedFixtureFiles.filter((_, i) => i !== index);
    onFilesSelected({
      rawAirgapFiles,
      checkedFixtureFiles: newFiles,
    });
  };

  return (
    <div className="space-y-6">
      {/* Raw Airgap Data Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Raw Airgap Data Value
        </h3>
        <div
          {...rawAirgapDropzone.getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            rawAirgapDropzone.isDragActive
              ? 'border-blue-400'
              : 'border-gray-300 hover:border-blue-400'
          }`}
          style={rawAirgapDropzone.isDragActive 
            ? { background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(59, 130, 246, 0.05) 100%)' }
            : { background: 'linear-gradient(135deg, rgba(249, 250, 251, 0.8) 0%, rgba(243, 244, 246, 0.6) 100%)' }
          }
        >
          <input {...rawAirgapDropzone.getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-blue-500 mb-4" />
          <p className="text-lg font-medium text-gray-900">
            {rawAirgapDropzone.isDragActive
              ? 'Drop files here'
              : 'Drag & drop Excel files here'}
          </p>
          <p className="text-sm text-gray-500 mt-2">or click to select files</p>
        </div>

        {rawAirgapFiles.length > 0 && (
          <div className="mt-4 border-2 border-green-500 rounded-lg p-4" style={{ background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(34, 197, 94, 0.03) 100%)' }}>
            <p className="font-medium text-green-700 mb-2">
              Raw Airgap Files ({rawAirgapFiles.length})
            </p>
            <div className="space-y-2">
              {rawAirgapFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-white rounded p-2 border border-gray-200"
                >
                  <div className="flex items-center space-x-2">
                    <File className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-gray-700">{file.name}</span>
                  </div>
                  <button
                    onClick={() => removeRawAirgapFile(index)}
                    className="text-red-500 hover:text-red-600"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Checked Fixture Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Checked Fixture
        </h3>
        <div
          {...checkedFixtureDropzone.getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            checkedFixtureDropzone.isDragActive
              ? 'border-blue-400'
              : 'border-gray-300 hover:border-blue-400'
          }`}
          style={checkedFixtureDropzone.isDragActive 
            ? { background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(59, 130, 246, 0.05) 100%)' }
            : { background: 'linear-gradient(135deg, rgba(249, 250, 251, 0.8) 0%, rgba(243, 244, 246, 0.6) 100%)' }
          }
        >
          <input {...checkedFixtureDropzone.getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-blue-500 mb-4" />
          <p className="text-lg font-medium text-gray-900">
            {checkedFixtureDropzone.isDragActive
              ? 'Drop files here'
              : 'Drag & drop Excel files here'}
          </p>
          <p className="text-sm text-gray-500 mt-2">or click to select files</p>
        </div>

        {checkedFixtureFiles.length > 0 && (
          <div className="mt-4 border-2 border-blue-500 rounded-lg p-4" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.03) 100%)' }}>
            <p className="font-medium text-blue-700 mb-2">
              Checked Fixture Files ({checkedFixtureFiles.length})
            </p>
            <div className="space-y-2">
              {checkedFixtureFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-white rounded p-2 border border-gray-200"
                >
                  <div className="flex items-center space-x-2">
                    <File className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-gray-700">{file.name}</span>
                  </div>
                  <button
                    onClick={() => removeCheckedFixtureFile(index)}
                    className="text-red-500 hover:text-red-600"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="border-2 border-red-500 text-red-700 px-4 py-3 rounded" style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.03) 100%)' }}>
          {error}
        </div>
      )}
    </div>
  );
}
