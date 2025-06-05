import TransferForm from "@/components/TransferForm";

export default function Home() {
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100
     dark:from-slate-900 dark:to-slate-800 p-4 sm:p-8 h-full w-full flex justify-center
      items-center"
    >
      <TransferForm className="w-full max-w-md" />
    </div>
  );
}
