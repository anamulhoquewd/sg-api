function stringGenerator(strLength: number) {
    // Ensure the length is a valid number
    const length = typeof strLength === "number" && strLength > 0 ? strLength : 0;
    // If the length is valid, proceed to generate the ID
    if (length) {
      const possibleCharacters =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      const possibleCharactersLength = possibleCharacters.length;
      let output = "";
      for (let i = 0; i < length; i++) {
        const generateToken = possibleCharacters.charAt(
          Math.floor(Math.random() * possibleCharactersLength)
        );
        output += generateToken;
      }
      return output;
    } else {
      throw new Error(
        "Invalid string length provided. Must be a positive number."
      );
    }
  }
  export { stringGenerator };
  