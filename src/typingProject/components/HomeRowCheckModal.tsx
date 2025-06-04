import React, { useEffect, useState, useCallback } from "react";
import { Box, Modal, Typography } from "@mui/material";

const ALL_KEYS = ["s", "d", "f", "j", "k", "l", " "]; // spacebar is ' '

const getRandomKeys = () => {
  const shuffled = [...ALL_KEYS].sort(() => Math.random() - 0.5);
  const count = Math.floor(Math.random() * 4) + 4; // 4 to 7
  return new Set(shuffled.slice(0, count));
};

interface HomeRowCheckModalProps {
  open: boolean;
  onClose: () => void;
  //   setTimerStarted: React.Dispatch<React.SetStateAction<boolean>>;
}

const HomeRowCheckModal: React.FC<HomeRowCheckModalProps> = ({
  open,
  onClose,
  //   setTimerStarted,
}) => {
  const [requiredKeys, setRequiredKeys] = useState<Set<string>>(new Set());
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [checkPassed, setCheckPassed] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      //   setTimerStarted(true);
      const key = e.key.toLowerCase();
      if (ALL_KEYS.includes(key)) {
        e.preventDefault();
        setPressedKeys((prev) => {
          const next = new Set(prev).add(key);
          const allPressed = Array.from(requiredKeys).every((k) => next.has(k));
          if (allPressed) setCheckPassed(true);
          return next;
        });
      }
    },
    [requiredKeys]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (ALL_KEYS.includes(key)) {
        setPressedKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });

        // if all required keys were pressed and now all are released, close modal
        if (checkPassed && pressedKeys.size === 1) {
          onClose();
        }
      }
    },
    [checkPassed, pressedKeys.size, onClose]
  );

  useEffect(() => {
    if (open) {
      setRequiredKeys(getRandomKeys());
      setPressedKeys(new Set());
      setCheckPassed(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp, open]);

  const renderKeyBox = (key: string) => {
    const label = key === " " ? "spacebar" : key;
    const isPressed = pressedKeys.has(key);
    const isRequired = requiredKeys.has(key);

    return (
      <Box
        key={key}
        sx={{
          border: "2px solid",
          borderColor: isRequired ? "primary.main" : "grey.400",
          backgroundColor: isPressed ? "success.light" : "transparent",
          borderRadius: 1,
          p: 2,
          mx: key === " " ? 0 : 0.5,
          minWidth: key === " " ? 160 : 40,
          textAlign: "center",
          textTransform: "uppercase",
          fontWeight: isRequired ? "bold" : "normal",
        }}>
        {label}
      </Box>
    );
  };
  return (
    <Modal open={open}>
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          bgcolor: "background.paper",
          boxShadow: 24,
          p: 4,
          borderRadius: 2,
          minWidth: 300,
        }}>
        <Typography
          variant='h5'
          gutterBottom>
          Home Row Check
        </Typography>

        <Box
          display='flex'
          justifyContent='center'
          mb={2}>
          {ALL_KEYS.slice(0, 6).map(renderKeyBox)}
        </Box>

        <Box
          display='flex'
          justifyContent='center'>
          {renderKeyBox(" ")}
        </Box>

        <Typography
          variant='body2'
          align='center'
          mt={2}>
          Hold all highlighted keys, then release to continue.
        </Typography>
      </Box>
    </Modal>
  );
};

export default HomeRowCheckModal;
