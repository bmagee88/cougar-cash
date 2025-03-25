import { Button, Stack, TextField } from "@mui/material";
import React, { useState } from "react";

const SheetsTestPage: React.FC = () => {
  const [data, setData] = useState<string[][]>([]);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [newValue, setNewValue] = useState("");
  const API_KEY = "AIzaSyBkEq4Uujfs0edmEDP4UrAveIRJ7EM6CFc";
  const SPREADSHEET_ID = "1n-1hSf5T-T4ZLzt6jgI4Qiq0DtFS04CkeV5wPteCNF8";
  const RANGE = "Sheet1!A1:B5";

  const handleFetchData = async () => {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      console.log(data);
      setData(data.values);
    } catch (error) {
      console.error("Error fetching Google Sheets data:", error);
    }
  };

  const handleCellClick = (rowIndex: number, colIndex: number) => {
    setEditingCell({ row: rowIndex, col: colIndex });
    setNewValue(data[rowIndex][colIndex]);
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewValue(e.target.value);
  };

  // Save updated cell value to Google Sheets
  const handleUpdateCell = async (rowIndex: number, colIndex: number) => {
    if (!newValue.trim()) return;

    const updateRange = `Sheet1!${String.fromCharCode(65 + colIndex)}${rowIndex + 1}`; // Convert to A1 notation
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${updateRange}?valueInputOption=RAW&key=${API_KEY}`;

    const body = JSON.stringify({
      values: [[newValue]],
    });

    try {
      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      });

      if (!response.ok) throw new Error("Failed to update Google Sheets data");

      // Update local state after successful update
      const updatedData = [...data];
      updatedData[rowIndex][colIndex] = newValue;
      setData(updatedData);
      setEditingCell(null);
    } catch (error) {
      console.error("Error updating cell:", error);
    }
  };

  return (
    <Stack spacing={2}>
      <Button
        variant='contained'
        onClick={handleFetchData}>
        Get Sheet Data
      </Button>
      <h2>Google Sheets Data</h2>
      <table border={1}>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, colIndex) => (
                <td
                  key={colIndex}
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                  style={{ cursor: "pointer", padding: "10px" }}>
                  {editingCell?.row === rowIndex && editingCell?.col === colIndex ? (
                    <TextField
                      value={newValue}
                      onChange={handleInputChange}
                      onBlur={() => handleUpdateCell(rowIndex, colIndex)}
                      onKeyDown={(e) => e.key === "Enter" && handleUpdateCell(rowIndex, colIndex)}
                      autoFocus
                      size='small'
                    />
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Stack>
  );
};

export default SheetsTestPage;
