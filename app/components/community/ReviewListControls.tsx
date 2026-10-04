"use client";

import { ChevronDown, RotateCcw } from "lucide-react";
import {
  PointerEvent as ReactPointerEvent,
  ReactNode,
  useCallback,
  useRef,
  useState,
} from "react";
import ReviewMenuPopover, { ReviewMenuItem } from "./ReviewMenuPopover";

export type ReviewSortValue = "latest" | "likes" | "views";

type FilterRailGesture = {
  pointerId: number;
  x: number;
  scrollLeft: number;
  dragging: boolean;
};

const sortLabels: Record<ReviewSortValue, string> = {
  latest: "최신순",
  likes: "좋아요순",
  views: "조회수순",
};

export function shouldStartFilterRailDrag({
  button,
  isPrimary,
  pointerType,
}: {
  button: number;
  isPrimary: boolean;
  pointerType: string;
}) {
  return isPrimary && button === 0 && pointerType === "mouse";
}

function FilterRail({ children }: { children: ReactNode }) {
  const gestureRef = useRef<FilterRailGesture | null>(null);
  const suppressClickRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      !shouldStartFilterRailDrag({
        button: event.button,
        isPrimary: event.isPrimary,
        pointerType: event.pointerType,
      })
    ) {
      return;
    }

    gestureRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
      dragging: false,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;

    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - gesture.x;

    if (!gesture.dragging && Math.abs(deltaX) < 5) {
      return;
    }

    if (!gesture.dragging) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    gesture.dragging = true;
    suppressClickRef.current = true;
    setIsDragging(true);
    event.currentTarget.scrollLeft = gesture.scrollLeft - deltaX;
  }

  function finishPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;

    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    gestureRef.current = null;
    setIsDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (gesture.dragging) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
  }

  return (
    <div
      aria-label="리뷰 필터"
      className={`min-w-0 flex-1 touch-auto overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      onClickCapture={(event) => {
        if (suppressClickRef.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onLostPointerCapture={finishPointer}
      onPointerCancel={finishPointer}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      role="group"
      tabIndex={0}
    >
      <div className="flex w-max select-none items-center gap-1.5 py-[3px]">{children}</div>
    </div>
  );
}

function FilterButton({
  active,
  disabled,
  label,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-haspopup="dialog"
      className={`flex h-[33px] shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border px-[15px] text-base leading-[23px] disabled:text-neutral-300 ${
        active
          ? "border-[#3399ff] bg-white text-[#3399ff]"
          : "border-[#dbdbdb] bg-white text-[#121212]"
      }`}
      data-active={active}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span>{label}</span>
      <ChevronDown aria-hidden="true" size={13} strokeWidth={1.2} />
    </button>
  );
}

export function ReviewListSkeleton() {
  return (
    <div className="review-list-skeleton border-b border-[#dbdbdb] px-4 py-4">
      <div className="h-6 w-24 bg-[#e4e4e4]" />
      <div className="mt-4 h-7 w-4/5 bg-[#e4e4e4]" />
      <div className="mt-2 h-5 w-full bg-[#e4e4e4]" />
      <div className="mt-3 h-5 w-48 bg-[#e4e4e4]" />
      <div className="mt-[30px] h-[18px] w-full bg-[#e4e4e4]" />
    </div>
  );
}

export default function ReviewListControls({
  categoryActive,
  categoryDisabled,
  categoryLabel,
  count,
  countLabel,
  filtersActive,
  onCategoryClick,
  onClearFilters,
  onRegionClick,
  onSortChange,
  photoFilter,
  regionActive,
  regionDisabled,
  regionLabel,
  sort,
}: {
  categoryActive: boolean;
  categoryDisabled: boolean;
  categoryLabel: string;
  count?: number;
  countLabel?: string;
  filtersActive: boolean;
  onCategoryClick: () => void;
  onClearFilters: () => void;
  onRegionClick: () => void;
  onSortChange: (value: ReviewSortValue) => void;
  photoFilter?: {
    active: boolean;
    onToggle: () => void;
  };
  regionActive: boolean;
  regionDisabled: boolean;
  regionLabel: string;
  sort: ReviewSortValue;
}) {
  const sortTriggerRef = useRef<HTMLButtonElement>(null);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const closeSortMenu = useCallback(() => setIsSortMenuOpen(false), []);

  return (
    <>
      {/* 필터 상단 */}
      <div className="flex h-11 items-center justify-between px-4">
        {/* 리뷰 목록 총 건수 */}
        <p aria-live="polite" className="text-base font-bold text-[#121212]">
          {countLabel ?? (
            <>
              {(count ?? 0).toLocaleString("ko-KR")}
              <span className="font-normal">건</span>
            </>
          )}
        </p>

        {/* 최신순 */}
        <div className="relative">
          <button
            aria-expanded={isSortMenuOpen}
            aria-haspopup="menu"
            className={`flex h-10 items-center gap-[5px] whitespace-nowrap text-base text-[#121212] ${
              isSortMenuOpen ? "relative z-40" : ""
            }`}
            onClick={() => setIsSortMenuOpen((current) => !current)}
            ref={sortTriggerRef}
            type="button"
          >
            {sortLabels[sort]}
            <ChevronDown aria-hidden="true" size={14} strokeWidth={1.2} />
          </button>
          <ReviewMenuPopover
            ariaLabel="리뷰 정렬 선택"
            isOpen={isSortMenuOpen}
            onClose={closeSortMenu}
            triggerRef={sortTriggerRef}
          >
            {(Object.entries(sortLabels) as [ReviewSortValue, string][])
              .filter(([value]) => value !== sort)
              .map(([value, label]) => (
                <ReviewMenuItem
                  key={value}
                  onClick={() => {
                    onSortChange(value);
                    setIsSortMenuOpen(false);
                    sortTriggerRef.current?.focus({ preventScroll: true });
                  }}
                >
                  {label}
                </ReviewMenuItem>
              ))}
          </ReviewMenuPopover>
        </div>
      </div>

      {/* 필터 하단 */}
      <div className="flex min-h-[55px] items-center gap-2 px-4 pb-2">
        <FilterRail>
          <FilterButton
            active={regionActive}
            disabled={regionDisabled}
            label={regionLabel}
            onClick={onRegionClick}
          />
          <FilterButton
            active={categoryActive}
            disabled={categoryDisabled}
            label={categoryLabel}
            onClick={onCategoryClick}
          />
          {photoFilter ? (
            <button
              aria-pressed={photoFilter.active}
              className={`flex h-[33px] shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-[15px] text-base leading-[23px] ${
                photoFilter.active
                  ? "border-[#3399ff] bg-white text-[#3399ff]"
                  : "border-[#dbdbdb] bg-white text-[#121212]"
              }`}
              onClick={photoFilter.onToggle}
              type="button"
            >
              사진 있는 리뷰
            </button>
          ) : null}
        </FilterRail>
        <button
          aria-label={
            photoFilter
              ? "전체 초기화: 지역, 카테고리, 사진 조건 해제"
              : "전체 초기화: 지역과 카테고리 조건 해제"
          }
          className="flex h-10 shrink-0 items-center justify-center gap-1 whitespace-nowrap text-sm text-[#121212]"
          disabled={!filtersActive}
          onClick={onClearFilters}
          title="전체 초기화"
          type="button"
        >
          <RotateCcw aria-hidden="true" size={16} strokeWidth={1.4} />
          전체 초기화
        </button>
      </div>
    </>
  );
}
