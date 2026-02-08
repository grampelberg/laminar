import { AddressButton } from "@/address";
import { RecordsTable } from "@/records";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";

export const DesignPlayground = () => {
  return (
    <>
      <div className="border-b py-4 bg-background/50 backdrop-blur-md sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-base font-bold">Design Playground</h1>
          <div className="flex items-center gap-2">
            <AddressButton />
            <AnimatedThemeToggler />
          </div>
        </div>
      </div>
      <div className="container mx-auto py-8">
        <RecordsTable />
      </div>
    </>
  );
};
