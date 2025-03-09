import React from "react";
import { Divider, Stack } from "@mui/material";
import CashBalanceDisplay from "../components/listsDisplay/CashBalancesDisplay";
import ListsDisplay from "components/listsDisplay/ListsDisplay";
import RewardButton from "components/RewardButton";
import { useDispatch } from "react-redux";
import { setStudents } from "store/student/studentsSlice";

const Home: React.FC = () => {
  const testStudents = [
    { label: "Morty", name: "Morty", balance: 0 },
    { label: "Larry", name: "Larry", balance: 0 },
    { label: "Moe", name: "Moe", balance: 0 },
    { label: "Curly", name: "Curly", balance: 0 },
    { label: "John", name: "John", balance: 0 },
    { label: "Sally", name: "Sally", balance: 0 },
    { label: "Hunter", name: "Hunter", balance: 0 },
    { label: "Makenzie", name: "Makenzie", balance: 0 },
    { label: "Salma", name: "Salma", balance: 0 },
    { label: "Camden", name: "Camden", balance: 0 },
    { label: "Keivon", name: "Keivon", balance: 0 },
  ];
  const dispatch = useDispatch();
  dispatch(setStudents(testStudents));
  return (
    <Stack gap={"1rem"}>
      <CashBalanceDisplay />
      <Divider />
      <ListsDisplay />
      <Divider />
      <RewardButton />
    </Stack>
  );
};

export default Home;
