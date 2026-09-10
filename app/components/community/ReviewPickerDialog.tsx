"use client";

import { RotateCcw, X } from "lucide-react";
import {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

export type ReviewPickerOption = {
  id: string;
  name: string;
};

type ReviewPickerDialogProps = {
  isOpen: boolean;
  title: string;
  options: ReviewPickerOption[];
  value: string;
  clearLabel?: string;
  onClose: () => void;
  onClear?: () => void;
  onConfirm: (value: string) => void;
};

type WheelGesture = {
  id: number;
  y: number;
  position: number;
  dragging: boolean;
};

const OPTION_HEIGHT = 40;
const VIEWPORT_HEIGHT = 200;
const LIST_CENTER_OFFSET = (VIEWPORT_HEIGHT - OPTION_HEIGHT) / 2;

function getClampedPosition(position: number, maximum: number) {
  return Math.max(0, Math.min(maximum, position));
}

export default function ReviewPickerDialog(props: ReviewPickerDialogProps) {
  if (!props.isOpen) {
    return null;
  }

  return <ReviewPickerDialogContent {...props} />;
}

function ReviewPickerDialogContent({
  isOpen,
  title,
  options,
  value,
  clearLabel,
  onClose,
  onClear,
  onConfirm,
}: ReviewPickerDialogProps) {
  const titleId = useId();
  const listboxId = useId();
  const wheelViewportRef = useRef<HTMLDivElement>(null);
  const wheelListRef = useRef<HTMLDivElement>(null);
  const wheelGestureRef = useRef<WheelGesture | null>(null);
  const wheelTimerRef = useRef<number | null>(null);
  const initialIndex = Math.max(0, options.findIndex((option) => option.id === value));
  const initialPosition = initialIndex * OPTION_HEIGHT;
  const [wheelPosition, setWheelPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const wheelPositionRef = useRef(initialPosition);
  const maximumPosition = Math.max(0, (options.length - 1) * OPTION_HEIGHT);
  const selectedIndex = Math.round(
    getClampedPosition(wheelPosition, maximumPosition) / OPTION_HEIGHT,
  );
  const temporaryValue = options[selectedIndex]?.id ?? "";

  function clearWheelTimer() {
    if (wheelTimerRef.current) {
      window.clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = null;
    }
  }

  function paintWheel(position: number, settle = false) {
    wheelPositionRef.current = position;
    setIsSettling(settle);
    setWheelPosition(position);
  }

  function moveWheel(desiredPosition: number) {
    const clampedPosition = getClampedPosition(desiredPosition, maximumPosition);
    const excess = desiredPosition - clampedPosition;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const elasticOffset = prefersReducedMotion
      ? 0
      : (Math.sign(excess) * 44 * Math.abs(excess)) / (80 + Math.abs(excess));

    paintWheel(clampedPosition + elasticOffset);
  }

  function settleWheel() {
    clearWheelTimer();
    const nextIndex = Math.round(
      getClampedPosition(wheelPositionRef.current, maximumPosition) / OPTION_HEIGHT,
    );
    paintWheel(nextIndex * OPTION_HEIGHT, true);
  }

  function scheduleWheelSettle() {
    clearWheelTimer();
    wheelTimerRef.current = window.setTimeout(settleWheel, 140);
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    wheelViewportRef.current?.focus({ preventScroll: true });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    function handleNativeWheel(event: WheelEvent) {
      event.preventDefault();

      if (wheelGestureRef.current) {
        return;
      }

      const normalizedDelta =
        event.deltaY *
        (event.deltaMode === 1
          ? OPTION_HEIGHT
          : event.deltaMode === 2
            ? VIEWPORT_HEIGHT
            : 1);
      const limitedDelta = Math.max(-120, Math.min(120, normalizedDelta));
      const desiredPosition = wheelPositionRef.current + limitedDelta;
      const clampedPosition = getClampedPosition(desiredPosition, maximumPosition);
      const excess = desiredPosition - clampedPosition;
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const elasticOffset = prefersReducedMotion
        ? 0
        : (Math.sign(excess) * 44 * Math.abs(excess)) / (80 + Math.abs(excess));
      const nextPosition = clampedPosition + elasticOffset;

      wheelPositionRef.current = nextPosition;
      setIsSettling(false);
      setWheelPosition(nextPosition);
      clearWheelTimer();
      wheelTimerRef.current = window.setTimeout(() => {
        const nextIndex = Math.round(
          getClampedPosition(wheelPositionRef.current, maximumPosition) / OPTION_HEIGHT,
        );
        const settledPosition = nextIndex * OPTION_HEIGHT;

        wheelPositionRef.current = settledPosition;
        setIsSettling(true);
        setWheelPosition(settledPosition);
        wheelTimerRef.current = null;
      }, 140);
    }

    const wheelViewport = wheelViewportRef.current;
    window.addEventListener("keydown", handleKeyDown);
    wheelViewport?.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      document.body.style.overflow = previousOverflow;
      clearWheelTimer();
      window.removeEventListener("keydown", handleKeyDown);
      wheelViewport?.removeEventListener("wheel", handleNativeWheel);
    };
  }, [isOpen, maximumPosition, onClose]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) {
      return;
    }

    clearWheelTimer();
    const transform = wheelListRef.current
      ? window.getComputedStyle(wheelListRef.current).transform
      : "none";
    const currentPosition =
      transform === "none"
        ? wheelPositionRef.current
        : LIST_CENTER_OFFSET - new DOMMatrixReadOnly(transform).m42;

    paintWheel(currentPosition);
    wheelGestureRef.current = {
      id: event.pointerId,
      y: event.clientY,
      position: currentPosition,
      dragging: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    event.preventDefault();
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = wheelGestureRef.current;

    if (!gesture || event.pointerId !== gesture.id) {
      return;
    }

    const deltaY = event.clientY - gesture.y;

    if (!gesture.dragging && Math.abs(deltaY) < 5) {
      return;
    }

    gesture.dragging = true;
    setIsDragging(true);
    moveWheel(gesture.position - deltaY);
  }

  function finishWheel(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = wheelGestureRef.current;

    if (!gesture || event.pointerId !== gesture.id) {
      return;
    }

    wheelGestureRef.current = null;
    setIsDragging(false);

    if (event.type === "pointerup" && !gesture.dragging) {
      const viewportTop = event.currentTarget.getBoundingClientRect().top;
      const centerOffset = event.clientY - viewportTop - VIEWPORT_HEIGHT / 2;
      moveWheel(wheelPositionRef.current + centerOffset);
    }

    if (event.currentTarget.hasPointerCapture(gesture.id)) {
      event.currentTarget.releasePointerCapture(gesture.id);
    }

    settleWheel();
  }

  function handleListboxKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const positions: Partial<Record<string, number>> = {
      ArrowUp: (selectedIndex - 1) * OPTION_HEIGHT,
      ArrowDown: (selectedIndex + 1) * OPTION_HEIGHT,
      Home: 0,
      End: maximumPosition,
    };
    const nextPosition = positions[event.key];

    if (nextPosition === undefined) {
      return;
    }

    event.preventDefault();
    moveWheel(nextPosition);
    scheduleWheelSettle();
  }

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-y-0 left-1/2 z-50 flex w-full max-w-[var(--app-frame-max-width)] -translate-x-1/2 items-center justify-center bg-black/30 px-4"
      role="dialog"
    >
      <div className="w-full max-w-[448px] overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="grid h-[58px] grid-cols-[48px_1fr_48px] items-center border-b border-neutral-200">
          <h2 className="col-start-2 text-center text-[19px] font-bold text-neutral-950" id={titleId}>
            {title}
          </h2>
          <button
            aria-label={`${title} 창 닫기`}
            className="col-start-3 flex h-11 w-11 items-center justify-center text-neutral-950 active:bg-neutral-100"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={24} strokeWidth={1.7} />
          </button>
        </div>

        <div
          aria-activedescendant={`${listboxId}-option-${selectedIndex}`}
          aria-label={title}
          className={`h-[200px] overflow-hidden bg-white px-4 select-none touch-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          onKeyDown={handleListboxKeyDown}
          onLostPointerCapture={finishWheel}
          onPointerCancel={finishWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishWheel}
          ref={wheelViewportRef}
          role="listbox"
          tabIndex={0}
        >
          <div
            className={isSettling ? "transition-transform duration-300 ease-out" : ""}
            ref={wheelListRef}
            style={{
              transform: `translateY(${LIST_CENTER_OFFSET - wheelPosition}px)`,
              willChange: "transform",
            }}
          >
            {options.map((option, index) => {
              const distance = Math.abs(index - wheelPosition / OPTION_HEIGHT);
              const isSelected = index === selectedIndex;

              return (
                <div
                  aria-selected={isSelected}
                  className={`flex h-10 items-center justify-center text-center leading-7 ${
                    isSelected
                      ? "text-2xl font-bold text-neutral-950"
                      : "text-base font-normal text-neutral-500"
                  }`}
                  id={`${listboxId}-option-${index}`}
                  key={option.id}
                  role="option"
                  style={{ opacity: Math.max(0.15, 1 - distance * 0.38) }}
                >
                  {option.name}
                </div>
              );
            })}
          </div>
        </div>

        <div
          className={`grid gap-2 px-4 pb-4 pt-3.5 ${
            onClear ? "grid-cols-[64px_minmax(0,1fr)]" : "grid-cols-1"
          }`}
        >
          {onClear ? (
            <button
              aria-label={clearLabel ?? `${title} 초기화`}
              className="flex h-14 w-16 items-center justify-center rounded-[7px] border border-[#dbdbdb] bg-white text-neutral-950 active:bg-neutral-100"
              onClick={onClear}
              title={clearLabel ?? `${title} 초기화`}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={24} strokeWidth={1.5} />
            </button>
          ) : null}
          <button
            className="h-14 w-full rounded-[7px] bg-[#3399ff] text-[17px] font-bold text-white active:bg-[#2186e8] disabled:bg-neutral-300"
            disabled={!temporaryValue}
            onClick={() => onConfirm(temporaryValue)}
            type="button"
          >
            선택하기
          </button>
        </div>
      </div>
    </div>
  );
}
