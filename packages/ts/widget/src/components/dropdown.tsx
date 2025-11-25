import { useSignal } from "@preact/signals";
import { JSX } from "preact";
import { useRef, useMemo, useEffect } from "preact/hooks";
import { createPortal } from "preact/compat";
import { cn } from "@/utils/cn";
import { openContextMenuIdSignal } from "@/state";

export default function Dropdown({
  trigger,
  items,
}: {
  trigger: JSX.Element;
  items: { label: string; onClick: () => void; disabled?: boolean }[];
}) {
  const dropdownId = useMemo(() => Math.random().toString(36).substring(7), []);
  const visibleSignal = useSignal(false);
  const isOpenSignal = useSignal(false);
  const positionSignal = useSignal({ x: 0, y: 0 });
  const menuRef = useRef(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // close this dropdown when another menu/dropdown opens
  useEffect(() => {
    if (
      openContextMenuIdSignal.value !== null &&
      openContextMenuIdSignal.value !== dropdownId
    ) {
      isOpenSignal.value = false;
      setTimeout(() => {
        visibleSignal.value = false;
      }, 150);
    }
  }, [openContextMenuIdSignal.value, dropdownId]);

  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isOpenSignal.value) {
      // close if already open
      isOpenSignal.value = false;
      openContextMenuIdSignal.value = null;
      setTimeout(() => {
        visibleSignal.value = false;
      }, 150);
      return;
    }

    // close any other open context menu or dropdown
    openContextMenuIdSignal.value = dropdownId;

    // calculate position relative to trigger
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      positionSignal.value = {
        x: rect.left,
        y: rect.bottom + 4, // 4px gap below trigger
      };
    }

    visibleSignal.value = true;

    document.addEventListener("click", handleClickOutside, { once: true });

    setTimeout(() => {
      isOpenSignal.value = true;
    }, 10);
  };

  const handleClickOutside = (e: MouseEvent) => {
    isOpenSignal.value = false;

    // clear the global signal if this dropdown is the one that's open
    if (openContextMenuIdSignal.value === dropdownId) {
      openContextMenuIdSignal.value = null;
    }

    setTimeout(() => {
      visibleSignal.value = false;
    }, 150);

    document.removeEventListener("click", handleClickOutside);
  };

  const handleItemClick = (item: (typeof items)[0]) => {
    if (item.disabled) return;

    item.onClick();

    // close dropdown after item click
    isOpenSignal.value = false;
    openContextMenuIdSignal.value = null;
    setTimeout(() => {
      visibleSignal.value = false;
    }, 150);
  };

  const menuContent = visibleSignal.value && (
    <div
      ref={menuRef}
      dir="ltr"
      id="tcc-dropdown-menu"
      className={cn(
        "fixed z-500",
        "bg-white border border-gray-300 rounded overflow-hidden",
        "overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md",
        "transition-opacity duration-150",
        isOpenSignal.value ? "opacity-100" : "opacity-0"
      )}
      style={{
        left: `${positionSignal.value.x}px`,
        top: `${positionSignal.value.y}px`,
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          id={`tcc-dropdown-menu-item-${item.label}`}
          onClick={() => handleItemClick(item)}
          className={cn(
            "py-2 px-3 rounded-md",
            "bg-white hover:bg-gray-100 cursor-pointer",
            item.disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <p className="text-xs font-semibold text-black">{item.label}</p>
        </div>
      ))}
    </div>
  );

  const portalTarget = document.getElementById(
    "tcc-widget-shadow-host"
  )?.shadowRoot;

  if (!portalTarget) {
    console.error("TCC: Shadow root not found");
    return null;
  }

  return (
    <>
      <div ref={triggerRef} onClick={handleClick}>
        {trigger}
      </div>
      {menuContent && createPortal(menuContent, portalTarget)}
    </>
  );
}
