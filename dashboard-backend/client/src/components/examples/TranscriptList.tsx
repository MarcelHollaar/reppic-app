import { TranscriptList, Transcript } from "../TranscriptList";

const mockTranscripts: Transcript[] = [
  {
    id: "1",
    filename: "gesprek-klant-abc-2024-01-15.txt",
    date: "15 jan 2024",
    status: "analyzed",
  },
  {
    id: "2",
    filename: "demo-prospect-xyz-2024-01-14.txt",
    date: "14 jan 2024",
    status: "processing",
  },
  {
    id: "3",
    filename: "follow-up-bedrijf-def.txt",
    date: "13 jan 2024",
    status: "analyzed",
  },
];

export default function TranscriptListExample() {
  const handleDelete = (id: string) => {
    console.log("Delete transcript:", id);
  };

  const handleView = (id: string) => {
    console.log("View transcript:", id);
  };

  return (
    <div className="p-8 max-w-4xl">
      <TranscriptList
        transcripts={mockTranscripts}
        onDelete={handleDelete}
        onView={handleView}
      />
    </div>
  );
}
