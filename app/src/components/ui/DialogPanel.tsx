import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

const DESKTOP = "(min-width: 1024px)";

export type DialogPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  /** Classes merged onto `Dialog.Content` (e.g. `lg:max-w-[min(92vw,36rem)]`). */
  contentClassName?: string;
  /** Classes merged onto the scrollable body under the header. */
  bodyClassName?: string;
  /** Overlay z-index; content uses `zBase + 1`. Default matches workspace modals (DronePicker). */
  zBase?: number;
  /** When true, Radix does not auto-focus the first focusable (e.g. long lists / custom UX). */
  preventInitialFocus?: boolean;
  /** `id` on `Dialog.Title` (e.g. for `aria-labelledby` on custom content). */
  titleId?: string;
  /** `aria-describedby` on `Dialog.Content` when the body includes a description node. */
  ariaDescribedBy?: string;
  /** Keyboard handler on the dialog surface (e.g. Enter to advance a wizard). */
  onContentKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
};

export function DialogPanel({
  open,
  onOpenChange,
  title,
  children,
  contentClassName,
  bodyClassName,
  zBase = 140,
  preventInitialFocus = false,
  titleId,
  ariaDescribedBy,
  onContentKeyDown,
}: DialogPanelProps) {
  const isDesktop = useMediaQuery(DESKTOP);
  const zOverlay = zBase;
  const zContent = zBase + 1;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="dd-dialog-overlay fixed inset-0 bg-black/55 backdrop-blur-[2px]"
          style={{ zIndex: zOverlay }}
          onClick={() => onOpenChange(false)}
        />
        <Dialog.Content
          aria-labelledby={titleId}
          aria-describedby={ariaDescribedBy}
          onKeyDown={onContentKeyDown}
          onOpenAutoFocus={preventInitialFocus ? (e) => e.preventDefault() : undefined}
          className={cn(
            "fixed flex max-h-[min(90dvh,85svh)] flex-col overflow-hidden border border-white/[0.12] bg-[#141414] shadow-[0_24px_64px_rgba(0,0,0,0.45)] outline-none ring-1 ring-white/[0.04]",
            isDesktop
              ? "dd-dialog-surface--desktop left-1/2 top-1/2 w-max min-w-[min(100%,17.5rem)] max-w-[min(92vw,28rem)] rounded-2xl"
              : "dd-dialog-surface--mobile inset-x-0 bottom-0 max-h-[min(88dvh,90svh)] w-full rounded-t-2xl",
            contentClassName,
          )}
          style={{
            zIndex: zContent,
            paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3 pr-3 transition-colors duration-200">
            <Dialog.Title
              id={titleId}
              className="min-w-0 flex-1 text-base font-semibold tracking-tight text-neutral-100"
            >
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fechar"
                className="flex size-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-neutral-400 transition-[color,transform,background-color] duration-200 ease-out hover:bg-white/[0.06] hover:text-neutral-100 active:scale-[0.96]"
              >
                <X className="size-5" aria-hidden />
              </button>
            </Dialog.Close>
          </div>

          <div
            className={cn(
              "min-h-0 w-full overflow-y-auto overscroll-contain px-4 py-4",
              "max-h-[min(calc(90dvh-4.5rem),calc(85svh-4.5rem))]",
              bodyClassName,
            )}
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
