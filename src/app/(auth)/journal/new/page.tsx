import { JournalEntryForm } from "@/components/journal/journal-entry-form";

export default function NewJournalEntryPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">仕訳入力</h1>
      <JournalEntryForm />
    </div>
  );
}
