import {defaults} from "./index";
import {describe, expect, test} from "@jest/globals";

describe("defaults object", () => {
  test("should have correct default values", () => {
    expect(defaults).toEqual({
      page: 1,
      limit: 10,
      sortType: "desc",
      sortBy: "updatedAt",
      search: "",
      role: "",
    });
  });

  test("should be frozen and immutable", () => {
    expect(Object.isFrozen(defaults)).toBe(true);

    // Attempt to modify the object (should fail silently in non-strict mode)
    try {
      // @ts-expect-error: testing immutability
      defaults.page = 2;
    } catch (error) {
      // It should throw an error in strict mode environments
      expect(error).toBeInstanceOf(TypeError);
    }

    // Ensure the value remains unchanged
    expect(defaults.page).toBe(1);
  });
});
