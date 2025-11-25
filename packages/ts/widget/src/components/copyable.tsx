import { useState } from "preact/hooks";
import { cn } from "@/utils/cn";
import { Check, Copy } from "lucide-preact";

function Copyable({
  className,
  children,
  content,
}: {
  className?: string;
  children: React.ReactNode;
  content?: string;
}) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    if (content) navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  return content ? (
    <div className={cn("relative", className)}>
      {children}
      <button
        onClick={handleCopy}
        className="absolute z-70 top-2 right-2 border border-gray-300 hover:bg-gray-100 rounded-md p-1 text-xs cursor-pointer group transition-colors duration-300"
      >
        {isCopied ? (
          <Check className="w-4 h-4 text-green-500 group-hover:text-green-600" />
        ) : (
          <Copy className="w-4 h-4 text-gray-500 group-hover:text-gray-600" />
        )}
      </button>
    </div>
  ) : (
    children
  );
}

export default Copyable;
