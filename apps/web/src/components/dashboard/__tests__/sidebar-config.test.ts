import { describe, expect, it } from "vitest";
import {
  isSidebarItemActive,
  sidebarGroups,
} from "@/components/dashboard/sidebar-config";

describe("sidebarGroups", () => {
  it("keeps group order as interview then prep", () => {
    expect(sidebarGroups.map((group) => group.key)).toEqual([
      "interview",
      "prep",
    ]);
  });

  it("moves records into interview group", () => {
    const interviewGroup = sidebarGroups.find(
      (group) => group.key === "interview",
    );
    const prepGroup = sidebarGroups.find((group) => group.key === "prep");

    expect(interviewGroup?.items.map((item) => item.href)).toEqual([
      "/interview",
      "/records",
    ]);
    expect(prepGroup?.items.map((item) => item.href)).toEqual([
      "/resume-review",
      "/questioning",
      "/job-recommendations",
    ]);
  });

  it("contains expected route entries", () => {
    const hrefs = sidebarGroups.flatMap((group) =>
      group.items.map((item) => item.href),
    );

    expect(hrefs).toEqual([
      "/interview",
      "/records",
      "/resume-review",
      "/questioning",
      "/job-recommendations",
    ]);
  });
});

describe("isSidebarItemActive", () => {
  it("matches exact route", () => {
    expect(isSidebarItemActive("/records", "/records")).toBe(true);
  });

  it("matches nested routes", () => {
    expect(isSidebarItemActive("/records/detail", "/records")).toBe(true);
  });

  it("does not mark interview as active for archive route", () => {
    expect(isSidebarItemActive("/interview/archive", "/interview")).toBe(false);
  });

  it("does not match different routes", () => {
    expect(isSidebarItemActive("/profile", "/records")).toBe(false);
  });
});
