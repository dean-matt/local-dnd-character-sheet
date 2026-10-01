import { ApiError } from "./api.ts";

/** A TanStack Query `retry`: a 4xx is an answer a retry cannot change, so it surfaces at once. */
export const retryUnlessClientError = (failures: number, error: Error): boolean =>
  !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failures < 3;
