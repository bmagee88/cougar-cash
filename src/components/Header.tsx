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
      sx={{
        backgroundColor: "#000080", // Navy
        color: "#C0C0C0", // Silver
        paddingY: 2,
        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.3)",
        borderBottom: "3px solid #C0C0C0",
        zIndex: 10,
      }}>
      <Stack
        direction={"row"}
        gap={"2rem"}
        alignItems='center'>
        {nav_items.map((item) => (
          <NavItemDisplay
            key={item.title}
            data={item}
          />
        ))}
      </Stack>
    </Stack>
  );
};

export default Header;
