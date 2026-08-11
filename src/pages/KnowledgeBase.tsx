import React, { useRef, useState } from 'react';
import { useKnowledgeBase } from '../contexts/KnowledgeBaseContext';
import { useError } from '../contexts/ErrorContext';
import ErrorDisplay from '../components/ErrorDisplay';
import { FaFile, FaImage } from 'react-icons/fa';

const summarize = (content: string): string => {
  if (content.startsWith('data:image')) return 'Image';
  return content.length > 80 ? content.slice(0, 80) + '...' : content;
};

const KnowledgeBase: React.FC = () => {
  const { knowledgeBase, addToKnowledgeBase, setKnowledgeBase } = useKnowledgeBase();
  const { error, setError, clearError } = useError();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.type === 'application/pdf') {
          const arrayBuffer = await file.arrayBuffer();
          const result = await window.electronAPI.parsePDF(arrayBuffer);
          if (result.error) {
            setError(`Failed to parse ${file.name}: ${result.error}`);
            continue;
          }
          addToKnowledgeBase(result.text);
        } else if (file.type.startsWith('image/')) {
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
          });
          addToKnowledgeBase(dataUrl);
        } else {
          const text = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsText(file);
          });
          addToKnowledgeBase(text);
        }
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeItem = (index: number) => {
    setKnowledgeBase(knowledgeBase.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-full">
      <ErrorDisplay error={error} onClose={clearError} />
      <p className="text-sm opacity-70 mb-2">
        Reference material (resume, job description, notes) included as context on every question.
      </p>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="btn btn-primary btn-sm mb-2"
        disabled={uploading}
      >
        {uploading ? 'Uploading...' : 'Upload File'}
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        accept=".pdf,.txt,.md,.jpg,.jpeg,.png"
        multiple
      />
      <div className="flex-1 overflow-auto space-y-1">
        {knowledgeBase.length === 0 && (
          <p className="text-sm opacity-50">Nothing uploaded yet.</p>
        )}
        {knowledgeBase.map((item, index) => (
          <div key={index} className="card-surface flex items-center gap-2 bg-base-200 px-2 py-1.5 text-sm">
            {item.startsWith('data:image') ? <FaImage className="opacity-60" /> : <FaFile className="opacity-60" />}
            <span className="flex-1 truncate">{summarize(item)}</span>
            <button onClick={() => removeItem(index)} className="btn btn-xs btn-circle btn-ghost">
              x
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KnowledgeBase;
