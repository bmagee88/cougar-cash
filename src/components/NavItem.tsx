import { Box } from "@mui/material";
import { Link } from "react-router-dom";
import React from "react";
import { NavItem } from "./Header";

interface NavItemDisplayProps {
  data: NavItem;
}

const NavItemDisplay: React.FC<NavItemDisplayProps> = ({ data }) => {
  const { title, linkTo } = data;
  return (
    <Box>
      <Link to={linkTo}>{title}</Link>
    </Box>
  );
};

export default NavItemDisplay;
