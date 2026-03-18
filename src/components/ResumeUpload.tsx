"use client";

import { useState, useCallback, useRef } from "react";

interface UploadedFile {
  name: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
}

interface ResumeUploadProps {
  onUploadsComplete: (files: { name: string; contentBase64: string }[]) => void;
}

export default function ResumeUpload({ onUploadsComplete }: ResumeUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = (reader.result as string).split(",")[1];
        resolve(base64String);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  const processFilesLocally = async (fileList: File[]) => {
    const results: { name: string; contentBase64: string }[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      setFiles((prev) =>
        prev.map((f) =>
          f.name === file.name ? { ...f, status: "uploading", progress: 50 } : f
        )
      );

      try {
        const base64 = await readFileAsBase64(file);
        results.push({ name: file.name, contentBase64: base64 });
        
        setFiles((prev) =>
          prev.map((f) =>
            f.name === file.name ? { ...f, status: "done", progress: 100 } : f
          )
        );
      } catch (error) {
        setFiles((prev) =>
          prev.map((f) =>
            f.name === file.name
              ? { ...f, status: "error", error: "Failed to read file locally" }
              : f
          )
        );
      }
    }

    if (results.length > 0) {
      onUploadsComplete(results);
    }
  };

  const handleFiles = useCallback(
    (fileList: FileList) => {
      const pdfFiles = Array.from(fileList).filter(
        (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
      );
      if (pdfFiles.length === 0) return;

      // Initialize state for all valid files
      setFiles(pdfFiles.map(f => ({ name: f.name, progress: 0, status: "uploading" })));

      // Process them one by one
      processFilesLocally(pdfFiles);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  return (
    <div>
      <div
        className={`upload-zone ${isDragging ? "dragging" : ""}`}
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="upload-icon">↑</div>
        <div className="upload-text">
          Drop PDF resumes here or click to browse
        </div>
        <div className="upload-hint">
          Supports bulk upload — processing happens securely without storing the PDF
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        multiple
        style={{ display: "none" }}
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      {files.length > 0 && (
        <div className="file-list">
          {files.map((f, i) => (
            <div key={i} className="file-item">
              <span className="file-name">{f.name}</span>
              <span className="file-status">
                {f.status === "uploading" && `Processing...`}
                {f.status === "done" && "✓ Processed"}
                {f.status === "error" && "✗ Failed"}
              </span>
              {f.status === "uploading" && (
                <div className="progress-bar" style={{ width: "80px", marginLeft: "8px" }}>
                  <div className="progress-bar-fill" style={{ width: `50%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
