import { act, renderHook } from "@testing-library/react-native";

let mockHasUnsavedChanges = false;
const mockSetStep = jest.fn();
const mockShowConfirmAlert = jest.fn();
const mockFormState = {
  canContinue: true,
  clearCoverImage: jest.fn(),
  closeMediaLibraryPicker: jest.fn(),
  closeMediaSourcePicker: jest.fn(),
  coverImageUri: "",
  coverMediaSelection: null,
  cropCoverImage: jest.fn(),
  cropPending: false,
  fieldErrors: {},
  fieldFocusRequest: null,
  form: {},
  getValues: jest.fn(() => ({})),
  goToNextStep: jest.fn(),
  handleMediaLibrarySelection: jest.fn(),
  handleMediaSourceAction: jest.fn(),
  mediaLibraryVisible: false,
  mediaSourceVisible: false,
  pickCoverImage: jest.fn(),
  requestFieldFocus: jest.fn(),
  selectedCategories: [],
  setField: jest.fn(),
  setSelectedCategories: jest.fn(),
  setStep: mockSetStep,
  setSubmitAttempted: jest.fn(),
  setSubmitError: jest.fn(),
  setUploadProgress: jest.fn(),
  step: 1,
  submitAttempted: false,
  submitError: "",
  touchedFields: {},
  trigger: jest.fn(async () => true),
  uploadProgress: "",
  validatingFields: {},
};

jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
jest.mock("../../../shared/utils/alerts", () => ({
  showConfirmAlert: (params: unknown) => mockShowConfirmAlert(params),
}));
jest.mock("../domain/createEventForm", () => ({
  TOTAL_CREATE_EVENT_STEPS: 4,
  hasCreateEventDraftChanges: () => mockHasUnsavedChanges,
}));
jest.mock("./useCreateEventFormState", () => ({
  useCreateEventFormState: () => mockFormState,
}));
jest.mock("../data", () => ({ startQueuedEventCreate: jest.fn(async () => undefined) }));

import { useCreateEventScreenState } from "./useCreateEventScreenState";

function renderState() {
  const goBack = jest.fn();
  const setBottomTabsVisible = jest.fn();
  const hook = renderHook(() =>
    useCreateEventScreenState({
      goBack,
      resetToHome: jest.fn(),
      setBottomTabsVisible,
      userData: { id: "viewer-id", username: "alice" } as never,
      viewerKey: "viewer:alice",
    }),
  );
  return { ...hook, goBack, setBottomTabsVisible };
}

describe("useCreateEventScreenState navigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasUnsavedChanges = false;
    mockFormState.step = 1;
  });

  it("hides tabs while mounted and leaves immediately without a draft", () => {
    const { result, goBack, setBottomTabsVisible, unmount } = renderState();
    expect(setBottomTabsVisible).toHaveBeenCalledWith(false);
    expect(result.current.canLeaveScreenWithoutPrompt()).toBe(false);

    act(() => result.current.handleBack());
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(result.current.canLeaveScreenWithoutPrompt()).toBe(true);
    unmount();
    expect(setBottomTabsVisible).toHaveBeenLastCalledWith(true);
  });

  it("moves back a step and confirms before discarding a draft", () => {
    mockFormState.step = 2;
    const stepHook = renderState();
    act(() => stepHook.result.current.handleBack());
    const updateStep = mockSetStep.mock.calls[0]?.[0] as (value: number) => number;
    expect(updateStep(2)).toBe(1);
    stepHook.unmount();

    mockFormState.step = 1;
    mockHasUnsavedChanges = true;
    const draftHook = renderState();
    act(() => draftHook.result.current.handleBack());
    const confirm = mockShowConfirmAlert.mock.calls[0]?.[0] as { onConfirm: () => void };
    act(() => confirm.onConfirm());
    expect(draftHook.goBack).toHaveBeenCalledTimes(1);
  });
});
