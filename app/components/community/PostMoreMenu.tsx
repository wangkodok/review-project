"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import ReviewConfirmDialog from "./ReviewConfirmDialog";
import ReviewMenuPopover, { ReviewMenuItem } from "./ReviewMenuPopover";

type DeletePostResponse = {
  success: boolean;
  data: null;
  message: string;
  code?: string;
};

type PostMoreMenuProps = {
  postId: string;
  mode?: "owner" | "report";
  reportHref?: string;
  editHref?: string;
  editNavigation?: "push" | "replace";
  isMenuOpen?: boolean;
  onMenuOpenChange?: (isOpen: boolean) => void;
  onDeleteSuccess?: (postId: string) => void;
  className?: string;
  menuAlignEndOffset?: number;
  fullHeightAction?: boolean;
};

function getDeleteErrorMessage(code?: string) {
  if (code === "UNAUTHORIZED") {
    return "로그인이 만료되었습니다. 다시 로그인해 주세요.";
  }

  if (code === "FORBIDDEN") {
    return "해당 리뷰는 삭제할 수 없습니다.";
  }

  if (code === "POST_NOT_FOUND") {
    return "삭제되었거나 존재하지 않는 리뷰입니다.";
  }

  if (code === "RATE_LIMIT_EXCEEDED" || code === "RATE_LIMIT_UNAVAILABLE") {
    return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  }

  return "리뷰를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export default function PostMoreMenu({
  postId,
  mode = "owner",
  reportHref,
  editHref,
  editNavigation = "replace",
  isMenuOpen: controlledIsMenuOpen,
  onMenuOpenChange,
  onDeleteSuccess,
  className,
  menuAlignEndOffset = 0,
  fullHeightAction = false,
}: PostMoreMenuProps) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [uncontrolledIsMenuOpen, setUncontrolledIsMenuOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState("");
  const isMenuOpen = controlledIsMenuOpen ?? uncontrolledIsMenuOpen;
  const actionSizeClass = fullHeightAction ? "h-14 w-14" : "h-11 w-11";

  const setMenuOpen = useCallback(
    (isOpen: boolean) => {
      if (controlledIsMenuOpen === undefined) {
        setUncontrolledIsMenuOpen(isOpen);
      }

      onMenuOpenChange?.(isOpen);
    },
    [controlledIsMenuOpen, onMenuOpenChange],
  );

  function handleEdit() {
    setMenuOpen(false);
    router[editNavigation](editHref ?? `/community/${postId}/edit`);
  }

  function handleReport() {
    setMenuOpen(false);
    router.push(reportHref ?? `/community/${postId}/report`);
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
        setDeleteErrorMessage(getDeleteErrorMessage(result.code));
        return;
      }

      setIsDeleteDialogOpen(false);

      if (onDeleteSuccess) {
        onDeleteSuccess(postId);
        return;
      }

      router.replace("/community");
    } catch {
      setDeleteErrorMessage("인터넷 연결을 확인한 후 다시 시도해 주세요.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div
      className={`flex items-center justify-center ${actionSizeClass} ${className ?? "relative"}`}
    >
      <button
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
        aria-label="리뷰 메뉴"
        className={`flex items-center justify-center text-neutral-950 active:bg-neutral-100 ${actionSizeClass}`}
        onClick={() => setMenuOpen(!isMenuOpen)}
        ref={triggerRef}
        type="button"
      >
        <MoreHorizontal aria-hidden="true" size={22} strokeWidth={1.5} />
      </button>

      <ReviewMenuPopover
        alignEndOffset={menuAlignEndOffset}
        ariaLabel={mode === "owner" ? "리뷰 관리 메뉴" : "리뷰 신고 메뉴"}
        closeOnScroll
        isOpen={isMenuOpen}
        onClose={() => setMenuOpen(false)}
        triggerRef={triggerRef}
      >
        {mode === "owner" ? (
          <>
            <ReviewMenuItem onClick={handleEdit}>수정</ReviewMenuItem>
            <ReviewMenuItem
              onClick={() => {
                setMenuOpen(false);
                setDeleteErrorMessage("");
                setIsDeleteDialogOpen(true);
              }}
            >
              삭제
            </ReviewMenuItem>
          </>
        ) : (
          <ReviewMenuItem onClick={handleReport}>신고하기</ReviewMenuItem>
        )}
      </ReviewMenuPopover>

      {mode === "owner" ? (
        <ReviewConfirmDialog
          cancelLabel="아니요"
          confirmLabel="삭제하기"
          description={"삭제한 리뷰는 복구할 수 없습니다.\n그래도 삭제하시겠습니까?"}
          errorMessage={deleteErrorMessage}
          isOpen={isDeleteDialogOpen}
          isPending={isDeleting}
          onCancel={() => {
            setDeleteErrorMessage("");
            setIsDeleteDialogOpen(false);
          }}
          onConfirm={handleDelete}
          pendingLabel="삭제 중..."
          title="리뷰 삭제"
          tone="danger"
        />
      ) : null}
    </div>
  );
}
