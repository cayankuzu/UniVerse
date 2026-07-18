import type { ReportPayload, SuccessResponse } from "../contracts/api";
import { post } from "../../platform/api/core";

export const ReportAPI = {
  submit: (payload: ReportPayload): Promise<SuccessResponse> =>
    post<SuccessResponse>("/reports", payload, { authMode: "required" }),
};
