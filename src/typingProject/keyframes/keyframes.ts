import { keyframes } from "@emotion/react";

export const pulseBadge = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.4); }
  100% { transform: scale(1); }
`;

export const glow = keyframes`
    0% { text-shadow: 0 0 5px #fff, 0 0 10px #ff00ff, 0 0 15px #00ffff; }
    50% { text-shadow: 0 0 10px #ffff00, 0 0 20px #00ff00, 0 0 30px #ff0000; }
    100% { text-shadow: 0 0 5px #fff, 0 0 10px #ff00ff, 0 0 15px #00ffff; }
  `;

export const shake = keyframes`
    0%   { transform: translate(0, 0) rotate(0deg); font-size: 1rem; color: #2980b9; }  /* Blue */
    10%  { transform: translate(-3px, 2px) rotate(-1deg); font-size: 1.05rem; color: #16a085; }  /* Teal */
    20%  { transform: translate(4px, -1px) rotate(1deg); font-size: 0.95rem; color: #27ae60; }  /* Green */
    30%  { transform: translate(-2px, 3px) rotate(0deg); font-size: 1.1rem; color: #f39c12; }  /* Yellow */
    40%  { transform: translate(3px, -2px) rotate(1deg); font-size: 0.9rem; color: #8e44ad; }  /* Purple */
    50%  { transform: translate(-4px, 1px) rotate(-1deg); font-size: 1.05rem; color: #e67e22; }  /* Orange */
    60%  { transform: translate(2px, -3px) rotate(0deg); font-size: 0.97rem; color: #d35400; }  /* Dark Orange */
    70%  { transform: translate(-1px, 2px) rotate(1deg); font-size: 1.08rem; color: #c0392b; }  /* Red */
    80%  { transform: translate(3px, -1px) rotate(-1deg); font-size: 0.92rem; color: #f1c40f; }  /* Yellow-Green */
    90%  { transform: translate(-2px, 1px) rotate(0deg); font-size: 1.03rem; color: #34495e; }  /* Dark Blue */
    100% { transform: translate(0, 0) rotate(0deg); font-size: 1rem; color: #2980b9; }  /* Back to Blue */
  `;

export const pulse = keyframes`
    0% {
      transform: scale(1);
      color: inherit;
    }
    50% {
      transform: scale(1.5);
      color: red;
    }
    100% {
      transform: scale(1);
      color: inherit;
    }
  `;
