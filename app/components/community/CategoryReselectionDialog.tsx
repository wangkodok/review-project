"use client";

type CategoryReselectionDialogProps = {
  onCancel: () => void;
  onConfirm: () => void;
};

export default function CategoryReselectionDialog({
  onCancel,
  onConfirm,
}: CategoryReselectionDialogProps) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-y-0 left-1/2 z-50 flex w-full max-w-[375px] -translate-x-1/2 items-center justify-center bg-black/40 px-5"
      role="dialog"
    >
      <div className="w-full max-w-[335px] rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-base font-bold text-neutral-950">카테고리를 다시 선택해주세요.</h2>
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          현재 카테고리는 선택할 수 없습니다. 게시글을 수정하려면 새로운 카테고리를
          선택해주세요.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            className="h-11 rounded-lg border border-neutral-200 text-sm font-semibold text-neutral-950 active:bg-neutral-100"
            onClick={onCancel}
            type="button"
          >
            취소
          </button>
          <button
            className="h-11 rounded-lg bg-neutral-950 text-sm font-semibold text-white active:bg-neutral-800"
            onClick={onConfirm}
            type="button"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
