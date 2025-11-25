export default function Empty({
  label,
  children,
}: {
  label?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="p-4 text-center flex flex-col items-center justify-center gap-2">
      {label && <span className="text-gray-500 text-sm">{label}</span>}
      {children}
    </div>
  );
}
