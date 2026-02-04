import React, { createContext, useContext, useMemo, useState } from "react";
import type { User, Role, Gender } from "../mock/mockBackend";

type AuthState = {
  user: User | null;

  // Option A: login by role (random demo user for that role)
  loginWithGoogle: (role: Role) => void;

  // Option B: login as a specific demo user (by uid)
  loginAsDemoUid: (uid: string) => void;

  logout: () => void;

  // Useful for rendering a "choose account" UI later
  demoUsers: User[];
};

const AuthContext = createContext<AuthState | null>(null);

/**
 * Demo directory (acts like "Google users" in the mock world)
 * - Multiple classes (class-101, class-102)
 * - Same group (group-ab) so you can test cross-room queue behavior
 */
const DEMO_USERS: User[] = [
  // -----------------
  // STUDENTS class-101
  // -----------------
  {
    uid: "s-101-1",
    role: "student",
    displayName: "Alex Rivera",
    photoURL: "https://i.pravatar.cc/100?img=3",
    lunchNumber: "21453",
    classId: "class-101",
    groupId: "group-ab",
    gender: "M" as Gender,
  },
  {
    uid: "s-101-2",
    role: "student",
    displayName: "Maya Thompson",
    photoURL: "https://i.pravatar.cc/100?img=15",
    lunchNumber: "21454",
    classId: "class-101",
    groupId: "group-ab",
    gender: "F" as Gender,
  },
  {
    uid: "s-101-3",
    role: "student",
    displayName: "Jordan Lee",
    photoURL: "https://i.pravatar.cc/100?img=12",
    lunchNumber: "21455",
    classId: "class-101",
    groupId: "group-ab",
    gender: "M" as Gender,
  },
  {
    uid: "s-101-4",
    role: "student",
    displayName: "Sofia Patel",
    photoURL: "https://i.pravatar.cc/100?img=47",
    lunchNumber: "21456",
    classId: "class-101",
    groupId: "group-ab",
    gender: "F" as Gender,
  },

  // -----------------
  // STUDENTS class-102
  // -----------------
  {
    uid: "s-102-1",
    role: "student",
    displayName: "Ethan Brooks",
    photoURL: "https://i.pravatar.cc/100?img=23",
    lunchNumber: "31411",
    classId: "class-102",
    groupId: "group-ab",
    gender: "M" as Gender,
  },
  {
    uid: "s-102-2",
    role: "student",
    displayName: "Ava Johnson",
    photoURL: "https://i.pravatar.cc/100?img=32",
    lunchNumber: "31412",
    classId: "class-102",
    groupId: "group-ab",
    gender: "F" as Gender,
  },
  {
    uid: "s-102-3",
    role: "student",
    displayName: "Noah Kim",
    photoURL: "https://i.pravatar.cc/100?img=53",
    lunchNumber: "31413",
    classId: "class-102",
    groupId: "group-ab",
    gender: "M" as Gender,
  },

  // --------
  // TEACHERS
  // --------
  {
    uid: "t-101",
    role: "teacher",
    displayName: "Ms. Carter (Room 101)",
    photoURL: "https://i.pravatar.cc/100?img=5",
  },
  {
    uid: "t-102",
    role: "teacher",
    displayName: "Mr. Hernandez (Room 102)",
    photoURL: "https://i.pravatar.cc/100?img=11",
  },
  {
    uid: "t-999",
    role: "teacher",
    displayName: "Ms. Nguyen (Float)",
    photoURL: "https://i.pravatar.cc/100?img=9",
  },

  // -----
  // ADMIN
  // -----
  {
    uid: "a-1",
    role: "admin",
    displayName: "Admin User",
    photoURL: "https://i.pravatar.cc/100?img=8",
  },
];

function pickRandomUser(role: Role) {
  const candidates = DEMO_USERS.filter((u) => u.role === role);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const loginWithGoogle = (role: Role) => {
    // Mock: random "Google account" for that role
    const chosen = pickRandomUser(role);
    if (!chosen) return;
    setUser(chosen);
  };

  const loginAsDemoUid = (uid: string) => {
    const chosen = DEMO_USERS.find((u) => u.uid === uid) || null;
    setUser(chosen);
  };

  const logout = () => setUser(null);

  const value = useMemo(
    () => ({
      user,
      loginWithGoogle,
      loginAsDemoUid,
      logout,
      demoUsers: DEMO_USERS,
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
