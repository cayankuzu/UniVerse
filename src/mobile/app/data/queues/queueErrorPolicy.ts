import { isHttpRequestError } from "../../platform/api/core.requestHelpers";

type QueueErrorShape = {
  nonRetryableQueueError?: boolean;
  retryableQueueError?: boolean;
};

const BASE_NON_RETRYABLE_KEYWORDS = [
  "unauthorized",
  "invalid jwt",
  "oturum",
  "forbidden",
  "blocked",
  "permission",
  "validation",
  "not found",
];
const BASE_RETRYABLE_KEYWORDS = [
  "network request failed",
  "failed to fetch",
  "network",
  "timeout",
  "time out",
  "zaman asimi",
  "zaman aşımı",
  "too many requests",
  "rate limit",
  "service unavailable",
];

interface QueueErrorPolicyOptions {
  additionalNonRetryableKeywords?: string[];
  additionalRetryableKeywords?: string[];
  useHttpStatus?: boolean;
}

export function isRetryableQueueError(error: unknown, options: QueueErrorPolicyOptions = {}) {
  const queueError = error as QueueErrorShape | null;
  if (queueError?.nonRetryableQueueError === true) {
    return false;
  }
  if (queueError?.retryableQueueError === true) {
    return true;
  }

  if (options.useHttpStatus && isHttpRequestError(error)) {
    if (error.isTimeout) return true;
    const status = error.httpStatus;
    if (status === 429) return true;
    if (status >= 400 && status < 500) return false;
    return status >= 500 || status === 0;
  }

  const message = String((error as { message?: string } | null)?.message || error || "")
    .trim()
    .toLowerCase();
  if (!message) return false;

  const nonRetryableKeywords = [
    ...BASE_NON_RETRYABLE_KEYWORDS,
    ...(options.additionalNonRetryableKeywords || []),
  ];
  if (nonRetryableKeywords.some((keyword) => message.includes(keyword))) {
    return false;
  }

  const retryableKeywords = [
    ...BASE_RETRYABLE_KEYWORDS,
    ...(options.additionalRetryableKeywords || []),
  ];
  return (
    retryableKeywords.some((keyword) => message.includes(keyword)) || /^http 5\d\d\b/.test(message)
  );
}
