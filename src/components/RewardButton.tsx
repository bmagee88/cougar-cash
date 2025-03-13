import { Button, Stack, TextField, Typography } from "@mui/material";
import useChooseStudents from "hooks/useChooseStudents";
import React, { useState } from "react";

const RewardButton: React.FC = () => {
  const { selectedValues, selectValues, uniqueValueCount } = useChooseStudents();
  const [quantity, setQuantity] = useState<number>(0);
  return (
    <Stack
      alignItems={"center"}
      gap={"1rem"}>
      quantity {"("}Max {uniqueValueCount}
      {")"}:{" "}
      <TextField
        size='small'
        defaultValue={1}
        sx={{ width: "100px" }}
        type='number'
        onChange={(e) => setQuantity(parseInt(e.target.value))}
      />
      <Button
        variant='contained'
        onClick={() => selectValues(quantity)}>
        reward
      </Button>
      {selectedValues.map((value) => {
        return <Typography key={value.name}>{value.name}</Typography>;
      })}
    </Stack>
  );
};

export default RewardButton;
