import type { ReportPayload, SuccessResponse } from "../contracts/api";
import { post } from "../../platform/api/core";
import {
  createClientMutationId,
  type ClientMutationOptions,
  normalizeClientMutationId,
} from "../mutations/clientMutation";

export const ReportAPI = {
  submit: (
    payload: ReportPayload,
    options: ClientMutationOptions = {},
  ): Promise<SuccessResponse> => {
    const clientMutationId =
      normalizeClientMutationId(options.clientMutationId) || createClientMutationId("report");
    return post<SuccessResponse>(
      "/reports",
      { ...payload, clientMutationId },
      { authMode: "required" },
    );
  },
};
