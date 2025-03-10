import React from "react";
import { Stack } from "@mui/material";
import NavItemDisplay from "./NavItem";

interface HeaderProps {}

export interface NavItem {
  title: string;
  linkTo: string;
}

const nav_items: NavItem[] = [
  { title: "home", linkTo: "/" },
  { title: "directions", linkTo: "/directions" },
  { title: "about", linkTo: "/about" },
];

const Header: React.FC<HeaderProps> = () => {
  return (
    <Stack
      direction={"row"}
      justifyContent={"center"}
      sx={{ backgroundColor: "#000080", color: "#C0C0C0" }}>
      <Stack
        direction={"row"}
        gap={"2rem"}>
        {nav_items.map((item) => {
          return <NavItemDisplay data={item} />;
        })}
      </Stack>
    </Stack>
  );
};

export default Header;
