type KakaoLoginButtonProps = {
  disabled: boolean;
  isLoading: boolean;
  onClick: () => void;
  variant: "default" | "my-guest" | "review-write-dialog";
};

const sizeClassNames = {
  default: "aspect-[20/3] rounded-xl",
  "my-guest": "h-[52px] rounded-[4px]",
  "review-write-dialog": "h-14 rounded-[8px]",
} as const;

export default function KakaoLoginButton({
  disabled,
  isLoading,
  onClick,
  variant,
}: KakaoLoginButtonProps) {
  return (
    <button
      aria-label="카카오 로그인"
      className={`relative flex w-full items-center justify-center bg-[#FEE500] px-12 text-black ${sizeClassNames[variant]}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <svg
        aria-hidden="true"
        className="absolute left-4 h-6 w-6"
        width="24"
        height="24"
        viewBox="13 14 22 21"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M24.0014 14C17.9241 14 13 18.0219 13 22.9825C13 26.1711 15.0368 28.9728 18.1057 30.5656L17.0681 34.5677C17.0295 34.6871 17.0598 34.8151 17.1424 34.9033C17.2029 34.9659 17.2855 35 17.3653 35C17.4341 35 17.5029 34.9772 17.5607 34.9289L22.0196 31.8171C22.661 31.911 23.3215 31.9622 23.9986 31.9622C30.0732 31.9622 35 27.9403 35 22.9797C35 18.0191 30.0759 14 24.0014 14Z"
          fill="#191919"
        />
      </svg>
      <span className="font-medium">
        {isLoading ? "로그인 중" : "카카오 로그인"}
      </span>
    </button>
  );
}
