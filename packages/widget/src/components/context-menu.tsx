import { useSignal } from "@preact/signals";
import { JSX } from "preact";
import { useRef, useMemo, useEffect } from "preact/hooks";
import { createPortal } from "preact/compat";
import { cn } from "@/utils/cn";
import { openContextMenuIdSignal } from "@/state";

export default function ContextMenu({
  children,
  items,
}: {
  children: JSX.Element;
  items: { label: string; onClick: () => void; disabled?: boolean }[];
}) {
  const menuId = useMemo(() => Math.random().toString(36).substring(7), []);
  const visibleSignal = useSignal(false);
  const isOpenSignal = useSignal(false);
  const positionSignal = useSignal({ x: 0, y: 0 });
  const menuRef = useRef(null);
  const containerRef = useRef(null);

  // close this menu when another menu opens
  useEffect(() => {
    if (
      openContextMenuIdSignal.value !== null &&
      openContextMenuIdSignal.value !== menuId
    ) {
      isOpenSignal.value = false;
      setTimeout(() => {
        visibleSignal.value = false;
      }, 150);
    }
  }, [openContextMenuIdSignal.value, menuId]);

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();

    // close any other open context menu
    openContextMenuIdSignal.value = menuId;

    positionSignal.value = { x: e.clientX, y: e.clientY };
    visibleSignal.value = true;

    document.addEventListener("click", handleClickOutside, { once: true });

    setTimeout(() => {
      isOpenSignal.value = true;
    }, 10);
  };

  const handleClickOutside = (e: MouseEvent) => {
    isOpenSignal.value = false;

    // clear the global signal if this menu is the one that's open
    if (openContextMenuIdSignal.value === menuId) {
      openContextMenuIdSignal.value = null;
    }

    setTimeout(() => {
      visibleSignal.value = false;
    }, 150);

    document.removeEventListener("click", handleClickOutside);
  };

  const menuContent = visibleSignal.value && (
    <div
      ref={menuRef}
      dir="ltr"
      id="tcc-context-menu"
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
          id={`tcc-context-menu-item-${item.label}`}
          onClick={item.disabled ? undefined : item.onClick}
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
      <div ref={containerRef} onContextMenu={handleContextMenu}>
        {children}
      </div>
      {menuContent && createPortal(menuContent, portalTarget)}
    </>
  );
}
