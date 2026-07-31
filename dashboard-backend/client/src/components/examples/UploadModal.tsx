import { useState } from "react";
import { UploadModal } from "../UploadModal";
import { Button } from "@/components/ui/button";

export default function UploadModalExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-8">
      <Button onClick={() => setOpen(true)}>Open Upload Modal</Button>
      <UploadModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
