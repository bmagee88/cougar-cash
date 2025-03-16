import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import Stack from "@mui/material/Stack";
import { Box, Button, Typography } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { setStudents } from "store/student/studentsSlice";
import { RootState } from "store/store";

interface Account {
  id: number;
  name: string;
  label: string;
  balance: number;
}

const CSVUploader: React.FC = () => {
  const dispatch = useDispatch();
  const students = useSelector((state: RootState) => state.students.students); // Get updated list
  const [data, setData] = useState<Account[]>([]);
  console.log("data", data);

  // Load stored data on mount
  useEffect(() => {
    const savedData = localStorage.getItem("students");
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      setData(parsedData);
      dispatch(setStudents(parsedData));
    }
  }, [dispatch]);

  // Save Redux store data to localStorage when students update
  useEffect(() => {
    if (students.length > 0) {
      localStorage.setItem("students", JSON.stringify(students));
      setData(students); // Update local state for UI consistency
    }
  }, [students]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse<Account>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (result) => {
        const validData = result.data
          .filter(
            (row) =>
              typeof row.id === "number" &&
              typeof row.name === "string" &&
              typeof row.balance === "number"
          )
          .sort((a, b) => a.name.localeCompare(b.name)); // Sorting alphabetically;
        // setData(validData);
        dispatch(setStudents(validData));
        // localStorage.setItem("students", JSON.stringify(validData));
      },
      error: (error) => {
        console.error("CSV parsing error:", error);
      },
    });
  };

  // const handleBalanceChange = (id: number, newBalance: number) => {
  //   const updatedData = data.map((entry) =>
  //     entry.id === id ? { ...entry, balance: newBalance } : entry
  //   );
  //   setData(updatedData);
  //   dispatch(setStudents(updatedData));
  //   localStorage.setItem("csvData", JSON.stringify(updatedData));
  // };

  const handleDownloadCSV = () => {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "students.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Box sx={{ margin: "1rem" }}>
      <Typography sx={{ fontWeight: "bold", fontSize: "18px" }}>Roster</Typography>
      <Stack
        direction='row'
        gap={"1rem"}>
        <Button
          variant='contained'
          component='label'>
          Upload
          <input
            type='file'
            accept='.csv'
            onChange={handleFileUpload}
            hidden
          />
        </Button>
        <Button
          variant='contained'
          color='primary'
          onClick={handleDownloadCSV}>
          Download
        </Button>
      </Stack>
    </Box>
  );
};

export default CSVUploader;
