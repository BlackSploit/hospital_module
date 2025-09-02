// Utility functions for common operations
module.exports = {
    // Pads a number with leading zeros to ensure a fixed length
    zeroFill(number, width = 2) {
      return String(number).padStart(width, "0");
    },
  
    // Generates a random integer with a fixed number of digits
    randomFixedInteger(length) {
      const min = Math.pow(10, length - 1);
      const max = Math.pow(10, length) - 1;
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },
  
    // Resolves the actual file path, optionally ensuring the directory exists
    getActualFpath(dirPath, ensureDir = false) {
      const path = require("path");
      const fs = require("fs");
  
      // Resolve the full path
      const resolvedPath = path.resolve(dirPath) + "/";
  
      // Optionally create the directory if it doesn't exist
      if (ensureDir && !fs.existsSync(resolvedPath)) {
        fs.mkdirSync(resolvedPath, { recursive: true });
      }
  
      return resolvedPath;
    },
  };