function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export default function PostMeta({
  anonymousId,
  createdAt,
}: {
  anonymousId: string;
  createdAt: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-neutral-500">
      <span>{anonymousId}</span>
      <span aria-hidden="true">·</span>
      <time dateTime={createdAt}>{formatDate(createdAt)}</time>
    </div>
  );
}
