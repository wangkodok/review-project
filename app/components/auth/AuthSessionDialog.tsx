"use client";

import ReviewConfirmDialog from "../community/ReviewConfirmDialog";

type AuthSessionDialogProps = {
  kind: "kakao-email" | "expired" | null;
  isPending?: boolean;
  errorMessage?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export default function AuthSessionDialog(props: AuthSessionDialogProps) {
  const isEmailConsent = props.kind === "kakao-email";
  return (
    <ReviewConfirmDialog
      isOpen={props.kind !== null}
      title={isEmailConsent ? "카카오 이메일 동의" : "로그인 시간이 만료되었습니다."}
      description={isEmailConsent
        ? "카카오 이메일 제공 동의가 필요합니다.\n기존 계정과 작성한 리뷰는 그대로 유지됩니다."
        : "로그인 후 12시간이 지나 로그아웃되었습니다.\n다시 로그인해 주세요."}
      cancelLabel={isEmailConsent ? "나중에" : "닫기"}
      confirmLabel={isEmailConsent ? "동의하기" : "로그인"}
      compact
      isPending={props.isPending}
      pendingLabel="로그인 중"
      errorMessage={props.errorMessage}
      onCancel={props.onClose}
      onConfirm={props.onConfirm}
    />
  );
}
