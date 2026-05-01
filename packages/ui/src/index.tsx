import type {
  ButtonHTMLAttributes,
  CSSProperties,
  HTMLAttributes,
  PropsWithChildren,
  ReactNode,
} from "react";

const styles = {
  card: {
    position: "relative",
    overflow: "hidden",
    isolation: "isolate",
    border: "1px solid color-mix(in srgb, var(--border) 86%, transparent)",
    borderRadius: 34,
    background: "var(--card-bg)",
    boxShadow:
      "var(--inner-highlight), 0 28px 90px rgba(0,0,0,0.28), var(--shadow)",
    backdropFilter: "blur(34px) saturate(190%)",
  } satisfies CSSProperties,
  surface: {
    borderRadius: 28,
    background:
      "linear-gradient(145deg, color-mix(in srgb, var(--surface-strong) 62%, transparent), color-mix(in srgb, var(--surface) 94%, transparent))",
    border: "1px solid color-mix(in srgb, var(--border) 86%, transparent)",
    boxShadow: "var(--inner-highlight)",
    backdropFilter: "blur(24px) saturate(170%)",
  } satisfies CSSProperties,
  pill: {
    borderRadius: 999,
    background: "var(--surface-strong)",
    border: "1px solid var(--border)",
    boxShadow: "var(--inner-highlight)",
  } satisfies CSSProperties,
};

function mergeStyles(
  ...parts: Array<CSSProperties | undefined>
): CSSProperties {
  return Object.assign({}, ...parts);
}

export function cn(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}

export function Card({
  children,
  style,
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      {...props}
      className={className}
      style={mergeStyles(styles.card, { padding: 20 }, style)}
    >
      {children}
    </div>
  );
}

export function Surface({
  children,
  style,
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      {...props}
      className={className}
      style={mergeStyles(styles.surface, { padding: 16 }, style)}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "end",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        marginBottom: 16,
      }}
    >
      <div>
        {eyebrow ? (
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.13em",
              textTransform: "uppercase",
              color: "var(--muted)",
              fontWeight: 780,
              marginBottom: 6,
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <h2
          style={{
            margin: 0,
            fontSize: "clamp(1.45rem, 4vw, 1.85rem)",
            lineHeight: 1.06,
            letterSpacing: "-0.05em",
            fontWeight: 860,
          }}
        >
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

export function StatTile({
  label,
  value,
  helper,
  accent = "var(--accent)",
}: {
  label: string;
  value: string;
  helper?: string;
  accent?: string;
}) {
  return (
    <Surface
      style={{
        position: "relative",
        overflow: "hidden",
        padding: 18,
        minHeight: 136,
        display: "grid",
        alignContent: "space-between",
        gap: 12,
        borderColor: `color-mix(in srgb, ${accent} 20%, var(--border))`,
        background: `radial-gradient(circle at 18% 0%, color-mix(in srgb, ${accent} 24%, transparent), transparent 42%), linear-gradient(180deg, color-mix(in srgb, ${accent} 9%, var(--surface-strong)), var(--surface))`,
        boxShadow: "var(--inner-highlight), 0 16px 38px rgba(0,0,0,0.11)",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          width: "fit-content",
          maxWidth: "100%",
          borderRadius: 999,
          padding: "7px 10px",
          background: `color-mix(in srgb, ${accent} 12%, var(--surface))`,
          color: "var(--muted-strong)",
          fontSize: 12,
          fontWeight: 760,
          letterSpacing: "0.01em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "clamp(1.55rem, 4.2vw, 2.35rem)",
          fontWeight: 880,
          lineHeight: 1,
          letterSpacing: "-0.055em",
        }}
      >
        {value}
      </div>
      {helper ? (
        <div style={{ color: "var(--muted-strong)", fontSize: 13 }}>
          {helper}
        </div>
      ) : null}
    </Surface>
  );
}

export function ActionButton({
  icon,
  title,
  subtitle,
  selected,
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: string;
  title: string;
  subtitle?: string;
  selected?: boolean;
}) {
  return (
    <button
      {...props}
      style={mergeStyles(
        styles.surface,
        {
          width: "100%",
          minHeight: 116,
          padding: 18,
          display: "grid",
          gridTemplateRows: "auto 1fr",
          gap: 14,
          alignContent: "space-between",
          textAlign: "left",
          color: "inherit",
          cursor: "pointer",
          background: selected
            ? "linear-gradient(180deg, color-mix(in srgb, var(--accent) 24%, var(--surface-strong)), color-mix(in srgb, var(--accent-2) 12%, var(--surface)))"
            : "radial-gradient(circle at 16% 0%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 42%), linear-gradient(160deg, var(--surface), color-mix(in srgb, var(--surface) 72%, transparent))",
          transform: selected ? "translateY(-1px)" : "none",
          boxShadow: selected
            ? "var(--inner-highlight), 0 18px 38px color-mix(in srgb, var(--accent) 18%, transparent)"
            : "var(--inner-highlight), 0 12px 28px rgba(0,0,0,0.08)",
          transition:
            "transform 160ms ease, background 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
          touchAction: "manipulation",
        },
        style,
      )}
    >
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
      >
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 48,
            height: 48,
            borderRadius: 18,
            background:
              "linear-gradient(145deg, color-mix(in srgb, var(--accent) 18%, var(--surface-strong)), color-mix(in srgb, var(--surface) 86%, transparent))",
            boxShadow: "var(--inner-highlight), 0 14px 24px rgba(0,0,0,0.11)",
            fontSize: 25,
            lineHeight: 1,
          }}
        >
          {icon}
        </span>
        <span
          style={{
            ...styles.pill,
            alignSelf: "start",
            padding: "7px 10px",
            fontSize: 11,
            color: selected ? "var(--text)" : "var(--muted)",
            fontWeight: 760,
            letterSpacing: "0.02em",
          }}
        >
          {selected ? "Выбрано" : "Быстро"}
        </span>
      </div>
      <div>
        <div
          style={{ fontSize: 19, fontWeight: 840, letterSpacing: "-0.025em" }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              marginTop: 6,
              color: "var(--muted-strong)",
              fontSize: 13,
              lineHeight: 1.35,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
    </button>
  );
}

export function Pill({
  children,
  tone = "default",
}: PropsWithChildren<{ tone?: "default" | "good" | "warn" | "danger" }>) {
  const palette: Record<string, CSSProperties> = {
    default: {
      background: "var(--surface-strong)",
      color: "var(--muted-strong)",
    },
    good: { background: "var(--good-soft)", color: "var(--good-text)" },
    warn: { background: "var(--warn-soft)", color: "var(--warn-text)" },
    danger: { background: "var(--danger-soft)", color: "var(--danger-text)" },
  };

  return (
    <span
      style={mergeStyles(styles.pill, palette[tone], {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 12px",
        fontSize: 13,
      })}
    >
      {children}
    </span>
  );
}

export function InlineMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ color: "var(--muted)", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
      {helper ? (
        <div style={{ color: "var(--muted-strong)", fontSize: 13 }}>
          {helper}
        </div>
      ) : null}
    </div>
  );
}

export function TimelineItem({
  title,
  subtitle,
  meta,
  accent = "var(--accent)",
  action,
}: {
  title: string;
  subtitle: string;
  meta: string;
  accent?: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "12px minmax(0, 1fr)",
        gap: 14,
        alignItems: "start",
      }}
    >
      <div
        style={{
          width: 12,
          height: 12,
          marginTop: 8,
          borderRadius: 999,
          background: accent,
          boxShadow: `0 0 0 6px color-mix(in srgb, ${accent} 18%, transparent)`,
        }}
      />
      <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "start",
            justifyContent: "space-between",
            gap: 10,
            minWidth: 0,
          }}
        >
          <div
            style={{
              minWidth: 0,
              fontWeight: 700,
              fontSize: 16,
              overflowWrap: "anywhere",
            }}
          >
            {title}
          </div>
          {action ? <div style={{ flex: "0 0 auto" }}>{action}</div> : null}
        </div>
        <div style={{ color: "var(--muted-strong)", fontSize: 14 }}>
          {subtitle}
        </div>
        <div style={{ color: "var(--muted)", fontSize: 13 }}>{meta}</div>
      </div>
    </div>
  );
}

export function GhostButton({
  children,
  style,
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button
      {...props}
      style={mergeStyles(
        styles.pill,
        {
          padding: "10px 14px",
          color: "inherit",
          cursor: "pointer",
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 92%, transparent), color-mix(in srgb, var(--surface) 86%, transparent))",
          fontWeight: 780,
          touchAction: "manipulation",
          transition:
            "transform 160ms ease, background 160ms ease, border-color 160ms ease",
        },
        style,
      )}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({
  children,
  style,
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button
      {...props}
      style={mergeStyles(
        {
          border: "none",
          borderRadius: 24,
          minHeight: 58,
          padding: "14px 18px",
          color: "var(--primary-text)",
          background:
            "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 76%, var(--accent-2)) 62%, var(--accent-3))",
          fontSize: 16,
          fontWeight: 840,
          cursor: "pointer",
          boxShadow:
            "var(--inner-highlight), 0 18px 38px color-mix(in srgb, var(--accent) 24%, transparent)",
          touchAction: "manipulation",
          letterSpacing: "-0.01em",
        },
        style,
      )}
    >
      {children}
    </button>
  );
}

export function BottomTabs({
  items,
  activeId,
  onChange,
}: {
  items: Array<{ id: string; label: string; icon: string }>;
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <nav
      aria-label="Основная навигация"
      className="bottom-tabs-shell"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
      }}
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            className="bottom-tab-button"
            onClick={() => onChange(item.id)}
            aria-label={`Открыть раздел ${item.label}`}
            aria-current={active ? "page" : undefined}
            data-active={active ? "true" : "false"}
            style={{
              background: active
                ? "linear-gradient(180deg, color-mix(in srgb, var(--accent) 18%, var(--surface-strong)), color-mix(in srgb, var(--surface) 84%, transparent))"
                : "transparent",
              color: active ? "var(--text)" : "var(--muted)",
              fontWeight: active ? 840 : 700,
              boxShadow: active
                ? "var(--inner-highlight), 0 12px 24px color-mix(in srgb, var(--accent) 14%, transparent)"
                : "none",
            }}
          >
            <span className="bottom-tab-icon">{item.icon}</span>
            <span className="bottom-tab-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Surface
      style={{
        minHeight: 180,
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 320 }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
          {title}
        </div>
        <div style={{ color: "var(--muted-strong)", lineHeight: 1.5 }}>
          {description}
        </div>
      </div>
    </Surface>
  );
}
