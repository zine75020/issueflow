export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-fg">
        {label}
        {required && <span className="text-severity-critical"> *</span>}
      </span>
      {children}
    </label>
  );
}
