import { Stack, Box, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const ListItemDisplay = ({ name, onRemove }) => {
  return (
    <Stack
      direction='row'
      alignItems='center'
      sx={{
        justifyContent: "space-between",
      }}>
      {/* Name Box - Takes up remaining space */}
      <Box
        sx={{
          flexGrow: 1,
          paddingLeft: "8px",
          paddingY: "3px",
          fontSize: "16px",
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}>
        {name}
      </Box>

      {/* Close Button - Fixed square size */}
      <IconButton
        onClick={onRemove}
        sx={{
          width: "32px",
          height: "32px",
          borderRadius: "4px",
        }}>
        <CloseIcon fontSize='small' />
      </IconButton>
    </Stack>
  );
};

export default ListItemDisplay;
