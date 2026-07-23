import { useCallback, useState } from 'react';
import { Upload, X, FileText } from 'lucide-react';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  maxSize?: number;
  label?: string;
  className?: string;
}

export function FileUpload({
  onFilesSelected,
  multiple = false,
  accept = '*',
  maxSize = 10 * 1024 * 1024,
  label = 'Upload files',
  className = '',
}: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (newFiles: FileList) => {
      const fileArray = Array.from(newFiles).filter((f) => f.size <= maxSize);
      setFiles((prev) => {
        const updated = multiple ? [...prev, ...fileArray] : fileArray;
        onFilesSelected(updated);
        return updated;
      });
    },
    [maxSize, multiple, onFilesSelected]
  );

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      onFilesSelected(updated);
      return updated;
    });
  };

  return (
    <div className={className}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
          ${dragOver
            ? 'border-primary-500 bg-primary-500/5'
            : 'border-dark-600 hover:border-dark-400'}
        `}
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = multiple;
          input.accept = accept;
          input.onchange = (e) => {
            const target = e.target as HTMLInputElement;
            if (target.files) handleFiles(target.files);
          };
          input.click();
        }}
      >
        <Upload className="w-8 h-8 mx-auto mb-3 text-dark-400" />
        <p className="text-sm font-medium text-dark-300">{label}</p>
        <p className="text-xs text-dark-500 mt-1">
          Drag & drop or click to browse • Max {(maxSize / (1024 * 1024)).toFixed(0)}MB
        </p>
      </div>
      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map((file, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-dark-800/50">
              <FileText className="w-4 h-4 text-primary-400 shrink-0" />
              <span className="text-sm text-dark-300 truncate flex-1">{file.name}</span>
              <span className="text-xs text-dark-500">{(file.size / 1024).toFixed(0)}KB</span>
              <button onClick={() => removeFile(i)} className="text-dark-400 hover:text-error-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
