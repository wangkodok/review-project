"use client";

import { MoreHorizontal } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import CategoryReselectionDialog from "./CategoryReselectionDialog";

type DeletePostResponse = {
  success: boolean;
  data: null;
  message: string;
  code?: string;
};

type PostMoreMenuProps = {
  postId: string;
  isOwner: boolean;
  isAuthenticated: boolean;
  requiresCategorySelection?: boolean;
  editNavigation?: "push" | "replace";
  isMenuOpen?: boolean;
  onMenuOpenChange?: (isOpen: boolean) => void;
  closeOnOutsidePointerDown?: boolean;
  onDeleteSuccess?: () => void;
  className?: string;
};

type DialogState = "login" | "not-owner" | "delete" | null;

export default function PostMoreMenu({
  postId,
  isOwner,
  isAuthenticated,
  requiresCategorySelection = false,
  editNavigation = "replace",
  isMenuOpen: controlledIsMenuOpen,
  onMenuOpenChange,
  closeOnOutsidePointerDown = false,
  onDeleteSuccess,
  className,
}: PostMoreMenuProps) {
  const router = useRouter();
  const menuRootRef = useRef<HTMLDivElement>(null);
  const [uncontrolledIsMenuOpen, setUncontrolledIsMenuOpen] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState("");
  const isMenuOpen = controlledIsMenuOpen ?? uncontrolledIsMenuOpen;

  const setMenuOpen = useCallback((isOpen: boolean) => {
    if (controlledIsMenuOpen === undefined) {
      setUncontrolledIsMenuOpen(isOpen);
    }

    onMenuOpenChange?.(isOpen);
  }, [controlledIsMenuOpen, onMenuOpenChange]);

  useEffect(() => {
    if (!closeOnOutsidePointerDown || !isMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !menuRootRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [closeOnOutsidePointerDown, isMenuOpen, setMenuOpen]);

  function handleTrigger() {
    if (!isAuthenticated) {
      setDialogState("login");
      return;
    }

    if (!isOwner) {
      setDialogState("not-owner");
      return;
    }

    setMenuOpen(!isMenuOpen);
  }

  function handleEdit() {
    setMenuOpen(false);

    if (requiresCategorySelection) {
      setIsCategoryDialogOpen(true);
      return;
    }

    router[editNavigation](`/community/${postId}/edit`);
  }

  async function handleDelete() {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);
    setDeleteErrorMessage("");

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as DeletePostResponse;

      if (!response.ok || !result.success) {
        setDeleteErrorMessage(result.message || "게시글 삭제에 실패했습니다.");
        return;
      }

      setDialogState(null);

      if (onDeleteSuccess) {
        onDeleteSuccess();
        return;
      }

      router.replace("/community");
    } catch {
      setDeleteErrorMessage("게시글 삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div
      className={`flex h-11 w-11 items-center justify-center ${className ?? "relative"}`}
      ref={menuRootRef}
    >
      <button
        aria-label="게시글 더보기"
        className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-950 active:bg-neutral-100"
        onClick={handleTrigger}
        type="button"
      >
        <MoreHorizontal aria-hidden="true" size={22} />
      </button>

      {isMenuOpen ? (
        <div className="absolute right-0 top-12 z-20 w-28 rounded-lg border border-neutral-200 bg-white p-1 shadow-sm">
          <button
            className="flex h-10 w-full items-center rounded-md px-3 text-left text-sm font-semibold text-neutral-950 active:bg-neutral-100"
            onClick={handleEdit}
            type="button"
          >
            수정
          </button>
          <button
            className="flex h-10 w-full items-center rounded-md px-3 text-left text-sm font-semibold text-red-600 active:bg-neutral-100"
            onClick={() => {
              setMenuOpen(false);
              setDialogState("delete");
            }}
            type="button"
          >
            삭제
          </button>
        </div>
      ) : null}

      {dialogState ? (
        <div
          aria-modal="true"
          className="fixed inset-y-0 left-1/2 z-50 flex w-full max-w-[375px] -translate-x-1/2 items-center justify-center bg-black/40 px-5"
          role="dialog"
        >
          <div className="w-full max-w-[335px] rounded-lg bg-white p-5 shadow-xl">
            {dialogState === "login" ? (
              <>
                <h2 className="text-base font-bold text-neutral-950">로그인이 필요합니다.</h2>
                <p className="mt-3 text-sm leading-6 text-neutral-600">
                  게시글을 수정하거나 삭제하려면 로그인해주세요.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-2">
                  <button
                    className="h-11 rounded-lg border border-neutral-200 text-sm font-semibold text-neutral-950 active:bg-neutral-100"
                    onClick={() => setDialogState(null)}
                    type="button"
                  >
                    취소
                  </button>
                  <button
                    className="h-11 rounded-lg bg-neutral-950 text-sm font-semibold text-white active:bg-neutral-800"
                    onClick={() => signIn("google", { callbackUrl: window.location.pathname })}
                    type="button"
                  >
                    로그인
                  </button>
                </div>
              </>
            ) : null}

            {dialogState === "not-owner" ? (
              <>
                <h2 className="text-base font-bold text-neutral-950">게시글 관리</h2>
                <p className="mt-3 text-sm leading-6 text-neutral-600">
                  수정 및 삭제는 작성자만 가능합니다.
                </p>
                <button
                  className="mt-6 h-11 w-full rounded-lg bg-neutral-950 text-sm font-semibold text-white active:bg-neutral-800"
                  onClick={() => setDialogState(null)}
                  type="button"
                >
                  확인
                </button>
              </>
            ) : null}

            {dialogState === "delete" ? (
              <>
                <h2 className="text-base font-bold text-neutral-950">게시글을 삭제할까요?</h2>
                <p className="mt-3 text-sm leading-6 text-neutral-600">
                  삭제한 게시글은 복구할 수 없습니다.
                </p>
                {deleteErrorMessage ? (
                  <p className="mt-3 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-950">
                    {deleteErrorMessage}
                  </p>
                ) : null}
                <div className="mt-6 grid grid-cols-2 gap-2">
                  <button
                    className="h-11 rounded-lg border border-neutral-200 text-sm font-semibold text-neutral-950 active:bg-neutral-100"
                    disabled={isDeleting}
                    onClick={() => setDialogState(null)}
                    type="button"
                  >
                    취소
                  </button>
                  <button
                    className="h-11 rounded-lg bg-red-600 text-sm font-semibold text-white active:bg-red-700 disabled:bg-red-300"
                    disabled={isDeleting}
                    onClick={handleDelete}
                    type="button"
                  >
                    삭제
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {isCategoryDialogOpen ? (
        <CategoryReselectionDialog
          onCancel={() => setIsCategoryDialogOpen(false)}
          onConfirm={() => router[editNavigation](`/community/${postId}/edit`)}
        />
      ) : null}
    </div>
  );
}
