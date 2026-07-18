import { readEventAttendanceState, reconcileEventAttendanceDirect } from "./events.attendance";

jest.mock("../../../platform/supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const { supabase } = jest.requireMock("../../../platform/supabase") as {
  supabase: {
    from: jest.Mock;
  };
};

describe("reconcileEventAttendanceDirect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("blocks leaving an event after the event window has ended", async () => {
    const deleteEq = jest.fn(() => ({ eq: jest.fn() }));

    supabase.from.mockImplementation((table: string) => {
      if (table === "events") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              is: jest.fn(() => ({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    ends_at: "2026-07-04T19:00:00.000Z",
                    is_cancelled: false,
                  },
                  error: null,
                }),
              })),
            })),
          })),
        };
      }

      if (table === "event_attendees") {
        return {
          delete: deleteEq,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    await expect(reconcileEventAttendanceDirect("event-1", "viewer-1", false)).rejects.toThrow(
      "Etkinlik sona erdigi icin katilimini geri alamazsin.",
    );

    expect(deleteEq).not.toHaveBeenCalled();
  });

  it("keeps the direct fallback available for active events", async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });

    supabase.from.mockImplementation((table: string) => {
      if (table === "events") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              is: jest.fn(() => ({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    ends_at: "2026-08-06T19:00:00.000Z",
                    is_cancelled: false,
                  },
                  error: null,
                }),
              })),
            })),
          })),
        };
      }

      if (table === "event_attendees") {
        return {
          insert,
          select: jest.fn(() => ({
            eq: jest.fn().mockResolvedValue({
              data: [{ user_id: "viewer-1" }, { user_id: "viewer-2" }],
              error: null,
            }),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    await expect(reconcileEventAttendanceDirect("event-2", "viewer-1", true)).resolves.toEqual({
      count: 2,
      joined: true,
    });

    expect(insert).toHaveBeenCalledWith({
      event_id: "event-2",
      user_id: "viewer-1",
    });
    await expect(readEventAttendanceState("event-2", "viewer-1")).resolves.toEqual({
      count: 2,
      joined: true,
    });
  });
});
