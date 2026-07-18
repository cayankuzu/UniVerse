export type { LegalDocument, LegalDocumentId } from "./legalDocuments.types";

import { kvkkDocument } from "./legalDocuments.kvkk";
import { privacyDocument } from "./legalDocuments.privacy";
import { termsDocument } from "./legalDocuments.terms";
import type { LegalDocumentId } from "./legalDocuments.types";

export const LEGAL_DOCUMENTS = {
  kvkk: kvkkDocument,
  privacy: privacyDocument,
  terms: termsDocument,
} satisfies Record<LegalDocumentId, typeof kvkkDocument>;
