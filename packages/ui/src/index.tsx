import type {
  ButtonHTMLAttributes,
  CSSProperties,
  HTMLAttributes,
  PropsWithChildren,
  ReactNode,
} from "react";

const styles = {
  card: {
    border: "1px solid var(--border)",
    borderRadius: 30,
    background: "var(--card-bg)",
    boxShadow: "var(--inner-highlight), var(--shadow)",
    backdropFilter: "blur(30px) saturate(180%)",
  } satisfies CSSProperties,
  surface: {
    borderRadius: 24,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    boxShadow: "var(--inner-highlight)",
    backdropFilter: "blur(22px) saturate(160%)",
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
        gap: 12,
        marginBottom: 14,
      }}
    >
      <div>
        {eyebrow ? (
          <div
            style={{
              fontSize: 12,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--muted)",
              fontWeight: 700,
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <h2
          style={{
            margin: 0,
            fontSize: 24,
            lineHeight: 1.06,
            letterSpacing: "-0.035em",
            fontWeight: 820,
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
        padding: 18,
        minHeight: 126,
        display: "grid",
        alignContent: "space-between",
        gap: 12,
        background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 13%, var(--surface-strong)), var(--surface))`,
      }}
    >
      <div style={{ color: "var(--muted)", fontSize: 14 }}>{label}</div>
      <div
        style={{
          fontSize: "clamp(1.5rem, 4vw, 2.2rem)",
          fontWeight: 820,
          lineHeight: 1,
          letterSpacing: "-0.04em",
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
          minHeight: 94,
          padding: 18,
          display: "grid",
          gap: 8,
          alignContent: "space-between",
          textAlign: "left",
          color: "inherit",
          cursor: "pointer",
          background: selected
            ? "linear-gradient(180deg, color-mix(in srgb, var(--accent) 24%, var(--surface-strong)), color-mix(in srgb, var(--accent-2) 12%, var(--surface)))"
            : "linear-gradient(160deg, var(--surface), color-mix(in srgb, var(--surface) 72%, transparent))",
          transform: selected ? "translateY(-1px)" : "none",
          boxShadow: "var(--inner-highlight), 0 10px 22px rgba(0,0,0,0.08)",
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
        <span style={{ fontSize: 26, lineHeight: 1 }}>{icon}</span>
        <span
          style={{
            ...styles.pill,
            padding: "6px 10px",
            fontSize: 12,
            color: "var(--muted)",
            fontWeight: 650,
          }}
        >
          {selected ? "Выбрано" : "Быстро"}
        </span>
      </div>
      <div>
        <div
          style={{ fontSize: 18, fontWeight: 760, letterSpacing: "-0.01em" }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{ marginTop: 4, color: "var(--muted-strong)", fontSize: 13 }}
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
        gridTemplateColumns: "12px 1fr auto",
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
      <div style={{ display: "grid", gap: 5 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
        <div style={{ color: "var(--muted-strong)", fontSize: 14 }}>
          {subtitle}
        </div>
      </div>
      <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
        <div style={{ color: "var(--muted)", fontSize: 13 }}>{meta}</div>
        {action}
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
          background: "color-mix(in srgb, var(--surface) 82%, transparent)",
          fontWeight: 700,
          touchAction: "manipulation",
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
          borderRadius: 22,
          minHeight: 58,
          padding: "14px 18px",
          color: "var(--primary-text)",
          background:
            "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 76%, var(--accent-2)) 62%, var(--accent-3))",
          fontSize: 16,
          fontWeight: 760,
          cursor: "pointer",
          boxShadow:
            "var(--inner-highlight), 0 18px 34px color-mix(in srgb, var(--accent) 20%, transparent)",
          touchAction: "manipulation",
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
    <div
      style={{
        position: "fixed",
        left: "50%",
        width: "min(calc(100% - 28px), 980px)",
        transform: "translateX(-50%)",
        bottom: "max(16px, env(safe-area-inset-bottom))",
        display: "grid",
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        gap: 8,
        padding: 8,
        borderRadius: 30,
        background: "var(--nav-bg)",
        backdropFilter: "blur(30px) saturate(180%)",
        border: "1px solid var(--border)",
        boxShadow: "var(--inner-highlight), 0 18px 48px rgba(0,0,0,0.22)",
        zIndex: 30,
      }}
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            style={{
              border: "none",
              minHeight: 58,
              borderRadius: 22,
              background: active
                ? "color-mix(in srgb, var(--accent) 18%, var(--surface-strong))"
                : "transparent",
              color: active ? "var(--text)" : "var(--muted)",
              fontWeight: active ? 760 : 650,
              display: "grid",
              placeItems: "center",
              gap: 4,
              cursor: "pointer",
              transition:
                "background 160ms ease, color 160ms ease, transform 160ms ease",
              touchAction: "manipulation",
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
            <span style={{ fontSize: 12 }}>{item.label}</span>
          </button>
        );
      })}
    </div>
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
