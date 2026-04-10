import { cn } from "@/lib/utils";

interface OutlineInputFieldProps {
  label?: string;
  placeholder_?: string;
  type?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  name?: string;
  disabled?: boolean;
  readOnly?: boolean;
  /** Smaller label + reserved label height so paired fields stay aligned in grids. */
  compact?: boolean;
}

export default function OutlineInputField({
  label,
  placeholder_,
  type = "text",
  value,
  onChange,
  name,
  disabled,
  readOnly,
  compact,
}: OutlineInputFieldProps) {
  const labelEl = (
    <h3
      className={cn(
        "font-poppins font-medium text-neutral-black dark:text-neutral-100",
        compact ? "text-sm font-semibold leading-snug" : "text-2xl",
      )}
    >
      {label}
    </h3>
  );

  return (
    <div className={cn("flex flex-col", compact ? "gap-2" : "space-y-1")}>
      {compact ? (
        <div className="flex min-h-[3.25rem] flex-col justify-end">
          {labelEl}
        </div>
      ) : (
        labelEl
      )}
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder_}
        disabled={disabled}
        readOnly={readOnly}
        className={cn(
          "rounded-lg border-1 border-neutral-grey bg-gray-100 dark:bg-neutral-900 dark:border-neutral-700 py-3 pl-2 font-poppins text-neutral-black dark:text-neutral-100 placeholder:text-neutral-black/50 dark:placeholder:text-neutral-400 focus:border-primary-green dark:focus:border-primary-green disabled:cursor-not-allowed disabled:opacity-60",
          compact ? "text-base" : "text-xl",
        )}
      />
    </div>
  );
}
