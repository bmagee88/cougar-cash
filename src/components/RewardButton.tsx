import { Button, Stack, TextField, Typography } from "@mui/material";
import useChooseStudents from "hooks/useChooseStudents";
import React, { useState } from "react";

const RewardButton: React.FC = () => {
  const { selectedValues, selectValues, uniqueValueCount } = useChooseStudents();
  const [quantity, setQuantity] = useState<number>(0);
  return (
    <Stack>
      quantity {"("}Max{uniqueValueCount}
      {")"}:{" "}
      <TextField
        type='number'
        onChange={(e) => setQuantity(parseInt(e.target.value))}
      />
      <Button onClick={() => selectValues(quantity)}>reward</Button>
      {selectedValues.map((value) => {
        return <Typography key={value.name}>{value.name}</Typography>;
      })}
    </Stack>
  );
};

export default RewardButton;
