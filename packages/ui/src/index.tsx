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
    borderRadius: 24,
    background: "var(--card-bg)",
    boxShadow: "var(--shadow)",
    backdropFilter: "blur(22px)",
  } satisfies CSSProperties,
  surface: {
    borderRadius: 22,
    background: "var(--surface)",
    border: "1px solid var(--border)",
  } satisfies CSSProperties,
  pill: {
    borderRadius: 999,
    background: "var(--surface-strong)",
    border: "1px solid var(--border)",
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
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.1 }}>{title}</h2>
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
        background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 14%, var(--surface)), var(--surface))`,
      }}
    >
      <div style={{ color: "var(--muted)", fontSize: 14 }}>{label}</div>
      <div
        style={{
          fontSize: "clamp(1.5rem, 4vw, 2.2rem)",
          fontWeight: 800,
          lineHeight: 1,
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
            ? "linear-gradient(180deg, color-mix(in srgb, var(--accent) 22%, var(--surface)), color-mix(in srgb, var(--accent-2) 16%, var(--surface)))"
            : "linear-gradient(160deg, var(--surface), color-mix(in srgb, var(--surface) 74%, transparent))",
          transform: selected ? "translateY(-1px)" : "none",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
          transition:
            "transform 160ms ease, background 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
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
          }}
        >
          {selected ? "Выбрано" : "Быстро"}
        </span>
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
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
            "linear-gradient(135deg, var(--accent), var(--accent-2) 60%, var(--accent-3))",
          fontSize: 16,
          fontWeight: 800,
          cursor: "pointer",
          boxShadow:
            "0 18px 34px color-mix(in srgb, var(--accent) 18%, transparent)",
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
        width: "min(calc(100% - 28px), 1080px)",
        transform: "translateX(-50%)",
        bottom: "max(16px, env(safe-area-inset-bottom))",
        display: "grid",
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        gap: 10,
        padding: 10,
        borderRadius: 28,
        background: "var(--nav-bg)",
        backdropFilter: "blur(18px)",
        border: "1px solid var(--border)",
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
              borderRadius: 20,
              background: active
                ? "color-mix(in srgb, var(--accent) 18%, transparent)"
                : "transparent",
              color: active ? "var(--text)" : "var(--muted)",
              fontWeight: active ? 700 : 600,
              display: "grid",
              placeItems: "center",
              gap: 4,
              cursor: "pointer",
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
