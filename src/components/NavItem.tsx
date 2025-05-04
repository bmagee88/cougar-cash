import React from "react";
import { NavItem } from "./Header";
import { Typography } from "@mui/material";
import { Link } from "react-router-dom";

interface NavItemDisplayProps {
  data: NavItem;
}

const NavItemDisplay: React.FC<NavItemDisplayProps> = ({ data }) => {
  return (
    <Link
      to={data.linkTo}
      style={{ textDecoration: "none" }}>
      <Typography
        sx={{
          fontFamily: "monospace",
          fontSize: "1.1rem",
          color: "#C0C0C0",
          transition: "color 0.3s ease",
          "&:hover": {
            color: "#FFD700", // Gold on hover
            textShadow: "0 0 5px #FFD700",
            cursor: "pointer",
          },
        }}>
        {data.title.toUpperCase()}
      </Typography>
    </Link>
  );
};

export default NavItemDisplay;
