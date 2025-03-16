import { Button } from "@mui/material";
import React, { useState } from "react";
import { Student } from "store/student/studentsSlice";

interface RandomStudentButtonProps {
  list: Student[];
  // addStudent: React.Dispatch<React.SetStateAction<string>>
}

const RandomStudentButton: React.FC<RandomStudentButtonProps> = ({ list }) => {
  const [modifiedStudentList, setModifiedStudentList] = useState(list);
  console.log("modifiedStudentList: onRerender: ", modifiedStudentList);
  const onClick = () => {
    // Pick a random student from the modified list
    const randomIndex = Math.floor(Math.random() * modifiedStudentList.length);
    const selectedStudent = modifiedStudentList[randomIndex];
    console.log("slected studnet:", selectedStudent);

    // Add the selected student using the addStudent function
    // const updatedStudentList = [...modifiedStudentList, selectedStudent];
    // // addStudent(updatedStudentList);
    // console.log("updatedStudentList", updatedStudentList);

    // Remove the selected student from the modified list
    const newModifiedStudentList = modifiedStudentList.filter(
      (student: Student) => student.name !== selectedStudent.name
    );

    // Update the modified list
    setModifiedStudentList(newModifiedStudentList);
    console.log("newmodstudentlist: ", newModifiedStudentList);
  };
  return (
    <Button
      variant={"outlined"}
      onClick={onClick}>
      Select Random Student
    </Button>
  );
};

export default RandomStudentButton;
