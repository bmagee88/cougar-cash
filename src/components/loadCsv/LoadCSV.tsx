import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import Stack from "@mui/material/Stack";
import { Box, Button } from "@mui/material";
import { useDispatch } from "react-redux";
import { setStudents } from "store/student/studentsSlice";

interface Account {
  id: number;
  name: string;
  label: string;
  balance: number;
}

const CSVUploader: React.FC = () => {
  const dispatch = useDispatch();
  const [data, setData] = useState<Account[]>([]);
  console.log("data", data);

  // Load stored data on mount
  useEffect(() => {
    const savedData = localStorage.getItem("csvData");
    if (savedData) {
      setData(JSON.parse(savedData));
      dispatch(setStudents(JSON.parse(savedData)));
    }
  }, [dispatch]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse<Account>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (result) => {
        const validData = result.data.filter(
          (row) =>
            typeof row.id === "number" &&
            typeof row.name === "string" &&
            typeof row.balance === "number"
        );
        setData(validData);
        dispatch(setStudents(validData));
        localStorage.setItem("csvData", JSON.stringify(validData));
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
    link.setAttribute("download", "data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Box sx={{ marginTop: "1rem", marginLeft: "1rem" }}>
      <Stack direction='row'>
        <Stack>
          <h2>Upload CSV File</h2>

          <input
            type='file'
            accept='.csv'
            onChange={handleFileUpload}
          />
        </Stack>
        {/* {data.length > 0 && (
          <table border={1}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.id}</td>
                  <td>{entry.name}</td>
                  <td>{entry.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )} */}
        <Button
          variant='contained'
          color='primary'
          sx={{ marginTop: "20px" }}
          onClick={handleDownloadCSV}>
          Download Updated CSV
        </Button>
      </Stack>
    </Box>
  );
};

export default CSVUploader;
