import pagination from "./pagination";
import { defaults } from "../config/defaults";
import { describe, expect, test, jest } from "@jest/globals";

// Mock the defaults to avoid dependency issues
jest.mock("../config/defaults", () => ({
  defaults: {
    page: 1,
    limit: 10,
    sortType: "desc",
    sortBy: "updatedAt",
    search: "",
    role: "",
  },
}));

describe("pagination function", () => {
  test("should return correct pagination object", () => {
    const result = pagination({ page: 2, limit: 10, total: 50 });

    expect(result).toEqual({
      page: 2,
      limit: 10,
      total: 50,
      totalPages: 5,
      prevPage: 1,
      nextPage: 3,
    });
  });

  test("should return pagination with only next page if on first page", () => {
    const result = pagination({ page: 1, limit: 10, total: 50 });

    expect(result).toEqual({
      page: 1,
      limit: 10,
      total: 50,
      totalPages: 5,
      nextPage: 2,
    });
  });

  test("should return pagination with only previous page if on last page", () => {
    const result = pagination({ page: 5, limit: 10, total: 50 });

    expect(result).toEqual({
      page: 5,
      limit: 10,
      total: 50,
      totalPages: 5,
      prevPage: 4,
    });
  });

  test("should return total pages as 1 if total is less than limit", () => {
    const result = pagination({ page: 1, limit: 10, total: 5 });

    expect(result).toEqual({
      page: 1,
      limit: 10,
      total: 5,
      totalPages: 1,
    });
  });

  test("should use default page and limit if not provided", () => {
    const result = pagination({
      page: undefined as any,
      limit: undefined as any,
      total: 100,
    });

    expect(result).toEqual({
      page: defaults.page,
      limit: defaults.limit,
      total: 100,
      totalPages: 10,
      nextPage: 2,
    });
  });
});
