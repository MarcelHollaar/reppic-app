import { UploadZone } from "../UploadZone";

export default function UploadZoneExample() {
  const handleUpload = (files: File[]) => {
    console.log("Files uploaded:", files.map(f => f.name));
  };

  return (
    <div className="p-8 max-w-2xl">
      <UploadZone onUpload={handleUpload} />
    </div>
  );
}
