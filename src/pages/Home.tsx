import React from "react";
import { Divider, Stack } from "@mui/material";
import CashBalanceDisplay from "../components/listsDisplay/CashBalancesDisplay";
import ListsDisplay from "components/listsDisplay/ListsDisplay";
import RewardButton from "components/RewardButton";
import DataAccordion from "components/DataAccordion";

const Home: React.FC = () => {
  // const testStudents: Student[] = [
  //   { id: 15378, label: "Morty", name: "Morty", balance: 0 },
  //   { id: 23461, label: "Larry", name: "Larry", balance: 0 },
  //   { id: 37351, label: "Moe", name: "Moe", balance: 0 },
  //   { id: 43469, label: "Curly", name: "Curly", balance: 0 },
  //   { id: 57540, label: "John", name: "John", balance: 0 },
  //   { id: 60416, label: "Sally", name: "Sally", balance: 0 },
  //   { id: 72756, label: "Hunter", name: "Hunter", balance: 0 },
  //   { id: 87772, label: "Makenzie", name: "Makenzie", balance: 0 },
  //   { id: 94523, label: "Salma", name: "Salma", balance: 0 },
  //   { id: 10590, label: "Camden", name: "Camden", balance: 0 },
  //   { id: 11427, label: "Keivon", name: "Keivon", balance: 0 },
  // ];
  return (
    <Stack gap={"1rem"}>
      <DataAccordion />

      <Divider />
      <CashBalanceDisplay />
      <Divider />
      <ListsDisplay />
      <Divider />
      <RewardButton />
    </Stack>
  );
};

export default Home;
