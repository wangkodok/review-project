type GoogleLoginButtonProps = {
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

export default function GoogleLoginButton({
  disabled,
  isLoading,
  onClick,
  variant,
}: GoogleLoginButtonProps) {
  return (
    <button
      aria-label="구글 로그인"
      className={`relative flex w-full items-center justify-center border border-gray-300 bg-white px-12 text-gray-900 hover:bg-gray-50 active:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 ${sizeClassNames[variant]}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <svg
        aria-hidden="true"
        className="absolute left-4 h-6 w-6"
        viewBox="0 0 48 48"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M24 9.5c3.54 0 6.68 1.22 9.17 3.6l6.83-6.83C36.23 2.53 30.54 0 24 0 14.63 0 6.4 5.48 2.56 13.44l7.91 6.14C12.11 13.12 17.57 9.5 24 9.5z"
          fill="#EA4335"
        />
        <path
          d="M46.1 24.5c0-1.54-.14-3.02-.41-4.44H24v8.4h12.46c-.54 2.9-2.16 5.36-4.6 7.01l7.09 5.52C43.61 37.67 46.1 31.54 46.1 24.5z"
          fill="#4285F4"
        />
        <path
          d="M10.47 28.38A14.48 14.48 0 0 1 9.5 24c0-1.52.26-2.98.72-4.38l-7.91-6.14A23.85 23.85 0 0 0 0 24c0 3.88.93 7.55 2.56 10.85l7.91-6.47z"
          fill="#FBBC05"
        />
        <path
          d="M24 48c6.48 0 11.9-2.13 15.87-5.78l-7.09-5.52c-2.05 1.37-4.7 2.18-8.78 2.18-6.43 0-11.89-3.62-14.53-8.88l-7.91 6.47C6.4 42.52 14.63 48 24 48z"
          fill="#34A853"
        />
      </svg>
      <span className="text-sm font-medium">
        {isLoading ? "로그인 중" : "Google"}
      </span>
    </button>
  );
}
