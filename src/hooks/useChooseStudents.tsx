// hooks/useSelectValues.ts
import { useMemo, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store/store";
import { Student, updateBalances } from "store/student/studentsSlice";

const useChooseStudents = () => {
  const dispatch = useDispatch();

  // Select the lists from the Redux store
  const {
    respect = [],
    responsible = [],
    onTask = [],
    achieve = [],
  } = useSelector((state: RootState) => state.teachers.lists);

  // Combine all the lists into one array
  const allValues = useMemo(
    () => [...respect, ...responsible, ...onTask, ...achieve],
    [respect, responsible, onTask, achieve]
  );

  const uniqueValueCount = useMemo(() => new Set(allValues).size, [allValues]);

  // State for selected values
  const [selectedValues, setSelectedValues] = useState<Student[]>([]);

  const selectValues = (selectCount: number) => {
    if (selectCount <= 0 || selectCount > uniqueValueCount) {
      console.log("count out of bounds");
      return;
    }

    // Randomly select 'selectCount' values from allValues
    const randomValues = [];
    let remainingValues = [...allValues];
    while (randomValues.length < selectCount && remainingValues.length > 0) {
      const randomIndex = Math.floor(Math.random() * remainingValues.length);
      const selectedValue = remainingValues[randomIndex];
      console.log("selectedValue", selectedValue);
      randomValues.push(selectedValue);
      // Remove all other instances of that value
      remainingValues = remainingValues.filter((value) => value !== selectedValue);
      console.log("randomValues, remainingValues", randomValues, remainingValues);
    }

    // Increase balance by 1 for selected students
    const updatedStudents = randomValues.map((student) => ({
      ...student,
      balance: student.balance + 1,
    }));

    // Dispatch the action to update Redux state
    dispatch(updateBalances(updatedStudents));

    // Save updated balances in local storage
    // localStorage.setItem("students", JSON.stringify(updatedStudents));

    setSelectedValues(randomValues);
  };

  return { selectedValues, selectValues, uniqueValueCount };
};

export default useChooseStudents;
