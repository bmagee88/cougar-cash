import { Stack } from "@mui/material";
import React from "react";

const Directions = () => {
  return (
    <Stack>
      <h1>directions</h1>
      1. Load a csv file of your class. The first row should be {"("}id, name, label, balance{")"}.
      The following rows should be the students info. example. 12345,brian,brian,0 <br></br>
      2. add or remove students from the lists when you see they are behaving or misbehaving for
      each pillar.<br></br>
      3. choose a number of students to get a single cougar cash up to the max. choosing the max
      would mean each student on at least one of the lists will get a CC. <br></br>
      4. Click reward. The names of the recipients will appear at the bottom.. soon to be splash
      screen. the balances will update automatically. <br></br>
      note: a student can't get more than one even if they are on multiple lists. <br></br>
      note: Balances will persist, but if you want to make a back up there is an export button at
      the top. <br></br>
      note: Each classroom will have their own roster. <br></br>
      <br></br>
      NEW FEATURES::<br></br>
      COMING SOON. Choose a random student for responsibilities. remove them from the list if they
      decline and choose another. perhaps a splash screen with accept or decline buttons.<br></br>
      COMING SOON: a payout button that will reset the balances to zero. This indicates that you've
      written all of the cougar cashs out. May be replaced when a master balance sheet is online.
      <br></br>
      COMING SOON: multiple classes.<br></br>
      COMING SOON: online catalog<br></br>
      COMING SOON: password protect the app, and the reward payouts button<br></br>
      COMING SOON: saves rewards to a master, all-students google sheets document.<br></br>
      COMING SOON: timeout after x minutes of inactivity
    </Stack>
  );
};

export default Directions;
