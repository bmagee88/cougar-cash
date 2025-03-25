import { Button } from "@mui/material";
import React, { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useSelector } from "react-redux";
import { RootState } from "store/store";
import { addResponsible, Student } from "store/teacher/teacherSlice";

interface RandomStudentButtonProps {
  list: Student[];
  // addStudent: React.Dispatch<React.SetStateAction<string>>
}

// Issue, when remove from the list, modifiedStudentList must add it back
// If modStudentList is empty, do nothing
const RandomStudentButton: React.FC<RandomStudentButtonProps> = ({ list }) => {
  // const dispatch = useDispatch();
  // const activeTeacher = useSelector((state: RootState) => state.teachers.activeTeacher);
  // const responsibleList = useSelector(
  //   (state: RootState) => state.teachers.lists?.responsible || []
  // );
  // const studentList = useSelector((state: RootState) => {
  //   if (!activeTeacher) return []; // Prevents errors
  //   return state.teachers.teachers[activeTeacher] || [];
  // });
  // const [modifiedStudentList, setModifiedStudentList] = useState<Student[]>([]);
  // const prevResponsibleList = useRef<Student[]>(responsibleList);
  // console.log("modifiedStudentList: onRerender: ", modifiedStudentList);

  // useEffect(() => {
  //   setModifiedStudentList(studentList);
  // }, []);

  // // 🔍 Detect removed students from responsibleList
  // useEffect(() => {
  //   if (prevResponsibleList.current.length > responsibleList.length) {
  //     // Find removed student by comparing previous and current responsibleList
  //     const removedStudent = prevResponsibleList.current.find(
  //       (student) => !responsibleList.some((s) => s.id === student.id)
  //     );

  //     if (removedStudent) {
  //       console.log("Student removed from responsible list:", removedStudent);
  //       setModifiedStudentList((prevList) => [...prevList, removedStudent]);
  //     }
  //   }
  //   // Update ref to track latest responsibleList
  //   prevResponsibleList.current = responsibleList;
  // }, []);

  // const onClick = () => {
  //   if (modifiedStudentList.length === 0) {
  //     return;
  //   }

  //   // Pick a random student from the modified list
  //   const randomIndex = Math.floor(Math.random() * modifiedStudentList.length);
  //   const selectedStudent = modifiedStudentList[randomIndex];
  //   console.log("slected studnet:", selectedStudent);

  //   // Add the selected student using the addStudent function
  //   // const updatedStudentList = [...modifiedStudentList, selectedStudent];
  //   // // addStudent(updatedStudentList);
  //   // console.log("updatedStudentList", updatedStudentList);

  //   // Remove the selected student from the modified list
  //   const newModifiedStudentList = modifiedStudentList.filter(
  //     (student: Student) => student.name !== selectedStudent.name
  //   );

  //   // Update the modified list
  //   setModifiedStudentList(newModifiedStudentList);
  //   console.log("newmodstudentlist: ", newModifiedStudentList);
  //   dispatch(addResponsible(selectedStudent));
  // };
  return (
    <></>
    // <Button
    //   variant={"outlined"}
    //   onClick={onClick}>
    //   Select Random Student
    // </Button>
  );
};

export default RandomStudentButton;

// import { createSelector } from "@reduxjs/toolkit";
// import { useSelector } from "react-redux";

// const selectStudents = (state) => state.students.list;

// // Memoized selector to avoid new array references
// const selectMemoizedStudents = createSelector(
//   [selectStudents],
//   (students) => students
// );

// const RandomStudentButton = () => {
//   const students = useSelector(selectMemoizedStudents);

//   // Avoiding unnecessary re-renders
//   const modifiedStudentList = React.useMemo(() => {
//     return students.filter((student) => student.active);
//   }, [students]);

//   return <button>{modifiedStudentList.length} Active Students</button>;
// };
