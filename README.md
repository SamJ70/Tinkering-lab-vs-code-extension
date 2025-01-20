# LeetCode Programming Helper (CPH)

## Overview

LeetCode Programming Helper is a Visual Studio Code extension designed to streamline competitive programming workflows. It allows users to fetch problem statements and test cases directly from LeetCode, write their solutions in the editor, and run them locally to verify correctness. Built with TypeScript, this extension is lightweight, efficient, and designed for an optimal coding experience.

---

## Features

### Run all commands in Command Pallete ( Ctrl+Shift+P) only.

### 1. Fetch Test Cases
- **Command**: `CPH: Fetch Test Cases`
- **Description**: Automatically extracts test cases from a LeetCode problem URL and saves them locally for use in testing.

### 2. Run Test Cases
- **Command**: `CPH: Run Test Cases`
- **Description**: Executes the user's code against the fetched test cases, providing detailed feedback by comparing actual vs expected outputs.

### IMPORTANT NOTE

### 1. Write the program in the desired LeetCode format only 
### 2. Refresh the Output channel once after running the command Run Test Cases

---

## Requirements

### Supported Programming Languages:
- **C++**
- **Python**

### Default Configuration for C++:
```json
{
  "cph.language.cpp.compile": "g++ -std=c++17 -o $fileNameWithoutExt $fileName",
  "cph.language.cpp.run": "./$fileNameWithoutExt"
}
