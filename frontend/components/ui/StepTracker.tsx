import { cn } from "../../lib/cn";

type Step = {
  label: string;
  description?: string;
  completed?: boolean;
  active?: boolean;
};

type StepTrackerProps = {
  steps: Step[];
  className?: string;
};

const SproutIcons = [
  // Step 1: Seedling Sprout
  <svg key="1" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22V12" />
    <path d="M12 12C12 7 16 5 20 6C20 10 17 12 12 12Z" fill="currentColor" fillOpacity="0.2" />
    <path d="M12 15C12 11 8 9 4 10C4 14 7 15 12 15Z" fill="currentColor" fillOpacity="0.2" />
  </svg>,
  // Step 2: Growing Foliage Stem
  <svg key="2" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22V6" />
    <path d="M12 6C12 2 17 1 21 2C21 7 17 6 12 6Z" fill="currentColor" fillOpacity="0.2" />
    <path d="M12 11C12 7 7 5 3 6C3 11 7 11 12 11Z" fill="currentColor" fillOpacity="0.2" />
    <path d="M12 17C12 14 8 13 5 14C5 17 8 17 12 17Z" fill="currentColor" fillOpacity="0.2" />
  </svg>,
  // Step 3: Flourishing Bloom
  <svg key="3" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22V14" />
    <path d="M12 14C12 11 8 10 5 11C5 14 8 14 12 14Z" fill="currentColor" fillOpacity="0.2" />
    <path d="M12 14C12 11 16 10 19 11C19 14 16 14 12 14Z" fill="currentColor" fillOpacity="0.2" />
    <circle cx="12" cy="7" r="4" fill="currentColor" fillOpacity="0.3" />
    <path d="M12 3v1" />
    <path d="M12 10v1" />
    <path d="M8.5 7h-1" />
    <path d="M16.5 7h-1" />
  </svg>,
];

export function StepTracker({ steps, className }: StepTrackerProps) {
  return (
    <div className={cn("w-full py-2", className)}>
      <ol className="flex items-center justify-between relative">
        {/* Background Connecting Bar */}
        <div className="absolute left-6 right-6 top-5 -z-10 h-0.5 bg-[#d7e2db]" />
        
        {steps.map((step, index) => {
          const isCompleted = step.completed;
          const isActive = step.active;
          const Icon = SproutIcons[index % SproutIcons.length];

          return (
            <li key={`${step.label}-${index}`} className="flex flex-1 flex-col items-center text-center">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 shadow-sm",
                  isCompleted
                    ? "border-[#3e6b63] bg-[#3e6b63] text-white shadow-[0_4px_12px_rgba(62,107,99,0.3)] scale-105"
                    : isActive
                    ? "border-[#3e6b63] bg-[#edf4ef] text-[#3e6b63] ring-4 ring-[#3e6b63]/15 scale-110 font-bold"
                    : "border-[#d7e2db] bg-[#f9f7f1] text-[#90a49b]"
                )}
              >
                {Icon}
              </div>
              <div className="mt-2.5">
                <span
                  className={cn(
                    "block text-xs font-bold transition-colors duration-200",
                    isActive
                      ? "text-[#21322a]"
                      : isCompleted
                      ? "text-[#3e6b63]"
                      : "text-[#76857c]"
                  )}
                >
                  {step.label}
                </span>
                {step.description ? (
                  <span className="mt-0.5 block text-[11px] text-[#587066]">{step.description}</span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
