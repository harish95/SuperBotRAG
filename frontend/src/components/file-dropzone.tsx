import { useRef, useState } from "react";
import { FileUp, Paperclip } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SUPPORTED_TYPES = [".pdf", ".docx", ".txt"];

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
}

export function FileDropzone({ onFilesSelected }: FileDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    const validFiles = Array.from(files).filter((file) =>
      SUPPORTED_TYPES.some((type) => file.name.toLowerCase().endsWith(type)),
    );
    onFilesSelected(validFiles);
  };

  return (
    <div
      className={cn(
        "rounded-3xl border border-dashed px-6 py-12 text-center transition-all",
        dragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50/70",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      <div className="mx-auto flex max-w-md flex-col items-center gap-4">
        <div className="rounded-3xl bg-white p-4 shadow-sm">
          <FileUp className="h-8 w-8 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Drop files here to upload</h3>
          <p className="mt-2 text-sm text-slate-500">
            Upload PDF, DOCX, or TXT files to make them searchable in the assistant.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button onClick={() => inputRef.current?.click()} type="button">
            <Paperclip className="h-4 w-4" />
            Select files
          </Button>
          <span className="text-xs uppercase tracking-[0.16em] text-slate-400">
            PDF · DOCX · TXT
          </span>
        </div>
      </div>

      <input
        ref={inputRef}
        className="hidden"
        multiple
        type="file"
        accept=".pdf,.docx,.txt"
        onChange={(event) => handleFiles(event.target.files)}
      />
    </div>
  );
}
