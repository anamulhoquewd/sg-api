import { describe, expect, test } from "@jest/globals";
import { stringGenerator } from "./stringGenerator";

describe("stringGenerator function", () => {
  test("should generate a string of the specified length", () => {
    const length = 10;
    const result = stringGenerator(length);
    expect(result).toHaveLength(length);
  });

  test("should contain only allowed characters", () => {
    const length = 15;
    const result = stringGenerator(length);
    const validChars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    for (const char of result) {
      expect(validChars.includes(char)).toBeTruthy();
    }
  });

  test("should throw an error if the length is zero or negative", () => {
    expect(() => stringGenerator(0)).toThrow(
      "Invalid string length provided. Must be a positive number."
    );
    expect(() => stringGenerator(-5)).toThrow(
      "Invalid string length provided. Must be a positive number."
    );
  });

  test("should throw an error if the input is not a number", () => {
    // @ts-expect-error Testing invalid input
    expect(() => stringGenerator("test")).toThrow(
      "Invalid string length provided. Must be a positive number."
    );
    // @ts-expect-error Testing undefined
    expect(() => stringGenerator(undefined)).toThrow(
      "Invalid string length provided. Must be a positive number."
    );
  });
});
