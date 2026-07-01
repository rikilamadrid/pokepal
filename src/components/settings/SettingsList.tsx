import { cn } from "@/lib/utils";

/** A grouped, inset iOS-style list section with an optional eyebrow label. */
export function SettingsGroup({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      {label && <h2 className="eyebrow px-1">{label}</h2>}
      <div className="divide-y divide-border overflow-hidden rounded-2xl bg-surface">
        {children}
      </div>
    </section>
  );
}

interface SettingsRowProps {
  title: string;
  subtitle?: string;
  /** Trailing content (switch, stat value, chevron…). */
  trailing?: React.ReactNode;
  /** When set, the row is a tappable button. */
  onClick?: () => void;
  /** Render the title in the destructive red. */
  destructive?: boolean;
  disabled?: boolean;
}

/** A single row inside a {@link SettingsGroup}: title (+ optional subtitle) and trailing content. */
export function SettingsRow({
  title,
  subtitle,
  trailing,
  onClick,
  destructive,
  disabled,
}: SettingsRowProps) {
  const body = (
    <>
      <div className="flex min-w-0 flex-col text-left">
        <span
          className={cn(
            "text-[0.95rem]",
            destructive ? "font-semibold text-red" : "text-ink",
          )}
        >
          {title}
        </span>
        {subtitle && (
          <span className="mt-0.5 text-xs text-ink-muted">{subtitle}</span>
        )}
      </div>
      {trailing && <div className="shrink-0 pl-3">{trailing}</div>}
    </>
  );

  const className =
    "flex w-full items-center justify-between px-4 py-3.5 text-left";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          className,
          "press outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red disabled:opacity-40",
        )}
      >
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}

/** Trailing mono numeric stat for a settings row. */
export function SettingsStat({ value }: { value: number }) {
  return (
    <span className="font-mono text-sm font-bold text-ink-muted">{value}</span>
  );
}
