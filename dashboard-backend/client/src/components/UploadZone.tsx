import { Upload } from "lucide-react";
import { useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface UploadZoneProps {
  onUpload: (files: File[]) => void;
  className?: string;
  title?: string;
  description?: string;
  accept?: string;
}

export function UploadZone({ 
  onUpload, 
  className,
  title = "Sleep transcripties hier of klik om te selecteren",
  description = "Ondersteunde formaten: .txt, .docx",
  accept = ".txt,.docx,.doc"
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    onUpload(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      onUpload(files);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer hover-elevate",
        isDragging ? "border-primary bg-primary/5" : "border-border",
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      data-testid="upload-zone"
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept={accept}
        onChange={handleFileInput}
        data-testid="input-file"
      />
      
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Upload className="w-8 h-8 text-primary" />
        </div>
        
        <div>
          <p className="text-base font-medium mb-1">
            {title}
          </p>
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
