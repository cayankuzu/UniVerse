export type LegalDocumentId = "terms" | "kvkk" | "privacy";

type LegalDocumentSection = {
  body: string[];
  heading: string;
};

export type LegalDocument = {
  id: LegalDocumentId;
  sections: LegalDocumentSection[];
  summary: string;
  title: string;
};
