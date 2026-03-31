import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ShuffleIcon from '@mui/icons-material/Shuffle';

type Language = 'english' | 'spanish' | 'pashto';
type StatsTab = 'overall' | 'class' | 'student';
type ThemeKey =
  | 'black'
  | 'white'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple';
type ThemeMode = 'light' | 'dark';
type BehaviorViewMode = 'text' | 'emoji';
type ClosingCategory = 'goodOnly' | 'badOnly' | 'mixed' | 'neutral';

type BehaviorOption = {
  id: string;
  emoji: string;
  label: Record<Language, string>;
  short: Record<Language, string>;
};

type StudentRecord = {
  studentName: string;
  parentName: string;
  hrTeacher: string;
  signingTeacher: string;
  createdAt: string;
  language: Language;
  exemplary: string[];
  misbehaviors: string[];
  letter: string;
};

type StudentProfile = {
  studentName: string;
  parentName: string;
  hrTeacher: string;
  signingTeacher: string;
  totalLetters: number;
  lastUpdated: string;
};

type StatsShape = {
  overall: {
    exemplary: Record<string, number>;
    misbehaviors: Record<string, number>;
    totalLetters: number;
  };
  byClass: Record<
    string,
    {
      exemplary: Record<string, number>;
      misbehaviors: Record<string, number>;
      totalLetters: number;
    }
  >;
  byStudent: Record<
    string,
    {
      exemplary: Record<string, number>;
      misbehaviors: Record<string, number>;
      totalLetters: number;
      hrTeacher: string;
    }
  >;
};

const STORAGE_KEYS = {
  profiles: 'parent-letter-generator-student-profiles',
  records: 'parent-letter-generator-records',
  stats: 'parent-letter-generator-stats',
  signingTeacher: 'parent-letter-generator-signing-teacher',
  theme: 'parent-letter-generator-theme',
  themeMode: 'parent-letter-generator-theme-mode',
  uiLanguage: 'parent-letter-generator-ui-language',
} as const;

const themePalette: Record<
  ThemeKey,
  Record<
    ThemeMode,
    {
      label: string;
      accent: string;
      accentSoft: string;
      pageBg: string;
      panelBg: string;
      panelAlt: string;
      text: string;
      subtext: string;
      border: string;
      buttonText: string;
    }
  >
> = {
  black: {
    light: {
      label: 'Black',
      accent: '#111111',
      accentSoft: '#f1f1f1',
      pageBg: '#f6f6f6',
      panelBg: '#ffffff',
      panelAlt: '#f3f4f6',
      text: '#111111',
      subtext: '#4b5563',
      border: '#d1d5db',
      buttonText: '#ffffff',
    },
    dark: {
      label: 'Black',
      accent: '#f5f5f5',
      accentSoft: '#27272a',
      pageBg: '#09090b',
      panelBg: '#18181b',
      panelAlt: '#27272a',
      text: '#fafafa',
      subtext: '#a1a1aa',
      border: '#3f3f46',
      buttonText: '#111111',
    },
  },
  white: {
    light: {
      label: 'White',
      accent: '#e5e7eb',
      accentSoft: '#ffffff',
      pageBg: '#fafafa',
      panelBg: '#ffffff',
      panelAlt: '#f5f5f5',
      text: '#111827',
      subtext: '#6b7280',
      border: '#d1d5db',
      buttonText: '#111827',
    },
    dark: {
      label: 'White',
      accent: '#fafafa',
      accentSoft: '#27272a',
      pageBg: '#0a0a0a',
      panelBg: '#111111',
      panelAlt: '#1a1a1a',
      text: '#f8fafc',
      subtext: '#cbd5e1',
      border: '#2a2a2a',
      buttonText: '#111827',
    },
  },
  red: {
    light: {
      label: 'Red',
      accent: '#c62828',
      accentSoft: '#fdecec',
      pageBg: '#fff5f5',
      panelBg: '#ffffff',
      panelAlt: '#fff1f2',
      text: '#3f0d12',
      subtext: '#7f1d1d',
      border: '#fecaca',
      buttonText: '#ffffff',
    },
    dark: {
      label: 'Red',
      accent: '#ef4444',
      accentSoft: '#2a1111',
      pageBg: '#080808',
      panelBg: '#101010',
      panelAlt: '#181818',
      text: '#fee2e2',
      subtext: '#fca5a5',
      border: '#3a1a1a',
      buttonText: '#ffffff',
    },
  },
  orange: {
    light: {
      label: 'Orange',
      accent: '#ea580c',
      accentSoft: '#fff3e8',
      pageBg: '#fff7ed',
      panelBg: '#ffffff',
      panelAlt: '#ffedd5',
      text: '#431407',
      subtext: '#9a3412',
      border: '#fdba74',
      buttonText: '#ffffff',
    },
    dark: {
      label: 'Orange',
      accent: '#f97316',
      accentSoft: '#2b170d',
      pageBg: '#080808',
      panelBg: '#101010',
      panelAlt: '#181818',
      text: '#ffedd5',
      subtext: '#fdba74',
      border: '#3a2417',
      buttonText: '#ffffff',
    },
  },
  yellow: {
    light: {
      label: 'Yellow',
      accent: '#eab308',
      accentSoft: '#fffbea',
      pageBg: '#fefce8',
      panelBg: '#ffffff',
      panelAlt: '#fef9c3',
      text: '#422006',
      subtext: '#854d0e',
      border: '#fde047',
      buttonText: '#111827',
    },
    dark: {
      label: 'Yellow',
      accent: '#facc15',
      accentSoft: '#2a250d',
      pageBg: '#080808',
      panelBg: '#101010',
      panelAlt: '#181818',
      text: '#fef9c3',
      subtext: '#fde047',
      border: '#383114',
      buttonText: '#111827',
    },
  },
  green: {
    light: {
      label: 'Green',
      accent: '#2e7d32',
      accentSoft: '#edf7ee',
      pageBg: '#f0fdf4',
      panelBg: '#ffffff',
      panelAlt: '#dcfce7',
      text: '#052e16',
      subtext: '#166534',
      border: '#86efac',
      buttonText: '#ffffff',
    },
    dark: {
      label: 'Green',
      accent: '#22c55e',
      accentSoft: '#102116',
      pageBg: '#080808',
      panelBg: '#101010',
      panelAlt: '#181818',
      text: '#dcfce7',
      subtext: '#86efac',
      border: '#193222',
      buttonText: '#052e16',
    },
  },
  blue: {
    light: {
      label: 'Blue',
      accent: '#1565c0',
      accentSoft: '#eaf3ff',
      pageBg: '#eff6ff',
      panelBg: '#ffffff',
      panelAlt: '#dbeafe',
      text: '#172554',
      subtext: '#1d4ed8',
      border: '#93c5fd',
      buttonText: '#ffffff',
    },
    dark: {
      label: 'Blue',
      accent: '#3b82f6',
      accentSoft: '#0f1b2d',
      pageBg: '#080808',
      panelBg: '#101010',
      panelAlt: '#181818',
      text: '#dbeafe',
      subtext: '#93c5fd',
      border: '#1b2e47',
      buttonText: '#ffffff',
    },
  },
  purple: {
    light: {
      label: 'Purple',
      accent: '#7e22ce',
      accentSoft: '#f5edff',
      pageBg: '#faf5ff',
      panelBg: '#ffffff',
      panelAlt: '#f3e8ff',
      text: '#3b0764',
      subtext: '#6b21a8',
      border: '#d8b4fe',
      buttonText: '#ffffff',
    },
    dark: {
      label: 'Purple',
      accent: '#a855f7',
      accentSoft: '#1f132d',
      pageBg: '#080808',
      panelBg: '#101010',
      panelAlt: '#181818',
      text: '#f3e8ff',
      subtext: '#d8b4fe',
      border: '#312040',
      buttonText: '#ffffff',
    },
  },
};

const themeOrder: ThemeKey[] = [
  'black',
  'white',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
];

const exemplaryOptions: BehaviorOption[] = [
  {
    id: 'respectful',
    emoji: '🙂',
    label: {
      english: 'showed respectful behavior',
      spanish: 'mostró un comportamiento respetuoso',
      pashto: 'درناوی کوونکی چلند یې وښود',
    },
    short: {
      english: 'Respectful',
      spanish: 'Respeto',
      pashto: 'درناوی',
    },
  },
  {
    id: 'directions',
    emoji: '🫡',
    label: {
      english: 'followed directions',
      spanish: 'siguió las instrucciones',
      pashto: 'لارښوونې یې تعقیب کړې',
    },
    short: {
      english: 'Directions',
      spanish: 'Instrucciones',
      pashto: 'لارښوونې',
    },
  },
  {
    id: 'completed_work',
    emoji: '✅',
    label: {
      english: 'completed assigned classwork',
      spanish: 'completó el trabajo asignado',
      pashto: 'سپارل شوی ټولګیوال کار یې بشپړ کړ',
    },
    short: {
      english: 'Completed Work',
      spanish: 'Trabajo Completo',
      pashto: 'کار بشپړ',
    },
  },
  {
    id: 'materials',
    emoji: '🧰',
    label: {
      english: 'used classroom materials appropriately',
      spanish: 'usó los materiales del salón de manera apropiada',
      pashto: 'د ټولګي وسایل یې په سمه توګه وکارول',
    },
    short: {
      english: 'Materials',
      spanish: 'Materiales',
      pashto: 'وسایل',
    },
  },
  {
    id: 'cooperative',
    emoji: '🤝',
    label: {
      english: 'worked cooperatively with others',
      spanish: 'trabajó cooperativamente con otros',
      pashto: 'له نورو سره یې په همکارۍ کار وکړ',
    },
    short: {
      english: 'Cooperative',
      spanish: 'Cooperó',
      pashto: 'همکاري',
    },
  },
  {
    id: 'focused',
    emoji: '🎯',
    label: {
      english: 'stayed focused',
      spanish: 'se mantuvo enfocado',
      pashto: 'متمرکز پاتې شو',
    },
    short: {
      english: 'Focused',
      spanish: 'Enfoque',
      pashto: 'تمرکز',
    },
  },
  {
    id: 'participation',
    emoji: '🙋',
    label: {
      english: 'participated appropriately',
      spanish: 'participó de manera apropiada',
      pashto: 'په مناسب ډول یې ګډون وکړ',
    },
    short: {
      english: 'Participation',
      spanish: 'Participación',
      pashto: 'ګډون',
    },
  },
  {
    id: 'self_control',
    emoji: '🧠',
    label: {
      english: 'showed self-control',
      spanish: 'mostró autocontrol',
      pashto: 'ځان کنټرول یې وښود',
    },
    short: {
      english: 'Self-Control',
      spanish: 'Autocontrol',
      pashto: 'ځان کنټرول',
    },
  },
  {
    id: 'redirection_positive',
    emoji: '👍',
    label: {
      english: 'responded appropriately to redirection',
      spanish: 'respondió de manera apropiada a la corrección',
      pashto: 'سمون ته یې په مناسب ډول ځواب ورکړ',
    },
    short: {
      english: 'Redirection',
      spanish: 'Corrección',
      pashto: 'سمون',
    },
  },
  {
    id: 'readiness',
    emoji: '📘',
    label: {
      english: 'showed readiness to learn',
      spanish: 'mostró disposición para aprender',
      pashto: 'د زده کړې چمتووالی یې وښود',
    },
    short: {
      english: 'Ready to Learn',
      spanish: 'Listo para Aprender',
      pashto: 'زده کړې ته چمتو',
    },
  },
  {
    id: 'returned_to_task',
    emoji: '🔄',
    label: {
      english: 'returned to the task after support',
      spanish: 'regresó a la tarea después de recibir apoyo',
      pashto: 'له مرستې وروسته بېرته دندې ته راوګرځېد',
    },
    short: {
      english: 'Returned to Task',
      spanish: 'Volvió a la Tarea',
      pashto: 'کار ته ستون شو',
    },
  },
  {
    id: 'good_effort',
    emoji: '💪',
    label: {
      english: 'made a good effort',
      spanish: 'hizo un buen esfuerzo',
      pashto: 'ښه هڅه یې وکړه',
    },
    short: {
      english: 'Good Effort',
      spanish: 'Buen Esfuerzo',
      pashto: 'ښه هڅه',
    },
  },
  {
    id: 'engaged',
    emoji: '📝',
    label: {
      english: 'stayed engaged during work time',
      spanish: 'se mantuvo involucrado durante el tiempo de trabajo',
      pashto: 'د کار پر مهال بوخت پاتې شو',
    },
    short: {
      english: 'Engaged',
      spanish: 'Participó',
      pashto: 'بوخت',
    },
  },
  {
    id: 'tech_use_positive',
    emoji: '💻',
    label: {
      english: 'used technology appropriately',
      spanish: 'usó la tecnología de manera apropiada',
      pashto: 'ټکنالوژي یې په مناسب ډول وکاروله',
    },
    short: {
      english: 'Tech Use',
      spanish: 'Tecnología',
      pashto: 'ټکنالوژي',
    },
  },
  {
    id: 'positive_choices',
    emoji: '🌟',
    label: {
      english: 'made positive choices',
      spanish: 'tomó decisiones positivas',
      pashto: 'مثبت انتخابونه یې وکړل',
    },
    short: {
      english: 'Positive Choices',
      spanish: 'Buenas Decisiones',
      pashto: 'مثبت انتخابونه',
    },
  },
  {
    id: 'improvement',
    emoji: '📈',
    label: {
      english: 'showed improvement in behavior',
      spanish: 'mostró mejoría en su comportamiento',
      pashto: 'په چلند کې یې ښه والی وښود',
    },
    short: {
      english: 'Improvement',
      spanish: 'Mejoría',
      pashto: 'ښه والی',
    },
  },
];

const misbehaviorOptions: BehaviorOption[] = [
  {
    id: 'language',
    emoji: '🤬',
    label: {
      english: 'used inappropriate language',
      spanish: 'usó lenguaje inapropiado',
      pashto: 'نامناسبه ژبه یې وکاروله',
    },
    short: {
      english: 'Language',
      spanish: 'Lenguaje',
      pashto: 'ژبه',
    },
  },
  {
    id: 'disrespect',
    emoji: '🙄',
    label: {
      english: 'responded disrespectfully to redirection',
      spanish: 'respondió de manera irrespetuosa a la corrección',
      pashto: 'سمون ته یې په بې‌ادبۍ ځواب ورکړ',
    },
    short: {
      english: 'Disrespect',
      spanish: 'Irrespeto',
      pashto: 'بې‌ادبي',
    },
  },
  {
    id: 'calling_out',
    emoji: '🗣️',
    label: {
      english: 'called out during instruction',
      spanish: 'habló fuera de turno durante la instrucción',
      pashto: 'د تدریس پر مهال بې نوبته خبرې وکړې',
    },
    short: {
      english: 'Calling Out',
      spanish: 'Interrupciones',
      pashto: 'بې نوبته خبرې',
    },
  },
  {
    id: 'out_of_seat',
    emoji: '🚶',
    label: {
      english: 'left their seat without permission',
      spanish: 'salió de su asiento sin permiso',
      pashto: 'له اجازې پرته له خپلې څوکۍ پورته شو',
    },
    short: {
      english: 'Out of Seat',
      spanish: 'Fuera del Asiento',
      pashto: 'له څوکۍ وتل',
    },
  },
  {
    id: 'no_work',
    emoji: '❌',
    label: {
      english: 'did not complete assigned classwork',
      spanish: 'no completó el trabajo asignado',
      pashto: 'سپارل شوی کار یې بشپړ نه کړ',
    },
    short: {
      english: 'No Work',
      spanish: 'Sin Trabajo',
      pashto: 'کار نه و',
    },
  },
  {
    id: 'off_task_tech',
    emoji: '📱',
    label: {
      english: 'used technology for non-class purposes',
      spanish: 'usó la tecnología para fines no relacionados con la clase',
      pashto: 'ټکنالوژي یې د ټولګي نه‌اړوندو کارونو لپاره وکاروله',
    },
    short: {
      english: 'Off-Task Tech',
      spanish: 'Tecnología',
      pashto: 'بې‌موخې ټکنالوژي',
    },
  },
  {
    id: 'youtube',
    emoji: '📺',
    label: {
      english: 'visited YouTube or other non-class websites',
      spanish: 'visitó YouTube u otros sitios que no eran de clase',
      pashto: 'یوټیوب یا نور د ټولګي نه‌اړوند وېب‌سایټونه یې وکتل',
    },
    short: {
      english: 'YouTube',
      spanish: 'YouTube',
      pashto: 'یوټیوب',
    },
  },
  {
    id: 'distracting_others',
    emoji: '😵',
    label: {
      english: 'distracted other students',
      spanish: 'distrajo a otros estudiantes',
      pashto: 'نور زده کوونکي یې حواس پرک کړل',
    },
    short: {
      english: 'Distracting Others',
      spanish: 'Distrajo',
      pashto: 'نور یې ګډوډ کړل',
    },
  },
  {
    id: 'directions_negative',
    emoji: '⚠️',
    label: {
      english: 'did not follow classroom directions',
      spanish: 'no siguió las instrucciones del salón',
      pashto: 'د ټولګي لارښوونې یې تعقیب نه کړې',
    },
    short: {
      english: 'Directions',
      spanish: 'Instrucciones',
      pashto: 'لارښوونې',
    },
  },
  {
    id: 'misused_materials',
    emoji: '🧱',
    label: {
      english: 'misused classroom materials or equipment',
      spanish: 'hizo mal uso de los materiales o equipos del salón',
      pashto: 'د ټولګي وسایل یا تجهیزات یې ناسم وکارول',
    },
    short: {
      english: 'Misused Materials',
      spanish: 'Mal Uso',
      pashto: 'ناسم استعمال',
    },
  },
  {
    id: 'off_task',
    emoji: '🌀',
    label: {
      english: 'had difficulty staying on task',
      spanish: 'tuvo dificultad para mantenerse enfocado en la tarea',
      pashto: 'په دنده تمرکز ساتلو کې ستونزه درلوده',
    },
    short: {
      english: 'Off Task',
      spanish: 'Fuera de Tarea',
      pashto: 'له دندې لرې',
    },
  },
  {
    id: 'interrupting',
    emoji: '⛔',
    label: {
      english: 'interrupted instruction',
      spanish: 'interrumpió la instrucción',
      pashto: 'تدریس یې مداخله کړ',
    },
    short: {
      english: 'Interrupting',
      spanish: 'Interrumpió',
      pashto: 'مداخله',
    },
  },
  {
    id: 'repeated_redirect',
    emoji: '🔁',
    label: {
      english: 'needed repeated redirection',
      spanish: 'necesitó corrección repetida',
      pashto: 'پرله‌پسې سمون ته اړتیا وه',
    },
    short: {
      english: 'Repeated Redirect',
      spanish: 'Corrección Repetida',
      pashto: 'تکراري سمون',
    },
  },
  {
    id: 'unprepared',
    emoji: '📭',
    label: {
      english: 'was unprepared for class expectations',
      spanish: 'no estaba preparado para las expectativas de la clase',
      pashto: 'د ټولګي تمو لپاره چمتو نه و',
    },
    short: {
      english: 'Unprepared',
      spanish: 'No Preparado',
      pashto: 'ناچمتو',
    },
  },
  {
    id: 'independent_work',
    emoji: '🫤',
    label: {
      english: 'had difficulty working independently',
      spanish: 'tuvo dificultad para trabajar de manera independiente',
      pashto: 'په خپلواکه توګه کار کولو کې ستونزه درلوده',
    },
    short: {
      english: 'Independent Work',
      spanish: 'Trabajo Solo',
      pashto: 'خپلواک کار',
    },
  },
  {
    id: 'side_talking',
    emoji: '💬',
    label: {
      english: 'engaged in side conversations during instruction',
      spanish: 'participó en conversaciones paralelas durante la instrucción',
      pashto: 'د تدریس پر مهال یې غاړې خبرې کولې',
    },
    short: {
      english: 'Side Talking',
      spanish: 'Conversaciones',
      pashto: 'غاړې خبرې',
    },
  },
  {
    id: 'class_time',
    emoji: '⏳',
    label: {
      english: 'showed poor use of class time',
      spanish: 'mostró un mal uso del tiempo de clase',
      pashto: 'د ټولګي وخت یې په ښه توګه ونه کاراوه',
    },
    short: {
      english: 'Class Time',
      spanish: 'Tiempo de Clase',
      pashto: 'د ټولګي وخت',
    },
  },
  {
    id: 'focus_struggle',
    emoji: '😶‍🌫️',
    label: {
      english: 'struggled to remain focused during work time',
      spanish: 'tuvo dificultad para mantenerse enfocado durante el tiempo de trabajo',
      pashto: 'د کار پر مهال په تمرکز ساتلو کې ستونزه درلوده',
    },
    short: {
      english: 'Focus',
      spanish: 'Enfoque',
      pashto: 'تمرکز',
    },
  },
];

const allBehaviorOptions = [...exemplaryOptions, ...misbehaviorOptions];
const behaviorLookup = new Map(allBehaviorOptions.map((option) => [option.id, option]));

const staticText = {
  english: {
    greeting: 'Dear Parent or Guardian,',
    copied: 'Letter copied to clipboard.',
    englishLabel: 'English',
    spanishLabel: 'Spanish',
    pashtoLabel: 'Pashto',
    studentName: 'Student Name',
    parentName: 'Parent / Guardian Name',
    hrTeacher: 'HR Teacher / Class',
    signingTeacher: 'Signing Teacher',
    uiLanguage: 'Site Language',
    letterLanguage: 'Letter Language',
    language: 'Language',
    exemplary: 'Exemplary Behaviors',
    misbehaviors: 'Misbehaviors',
    preview: 'Letter Preview',
    save: 'Save Letter Record',
    shuffle: 'Shuffle Opening / Closing',
    stats: 'Statistics',
    overall: 'Overall',
    byClass: 'Per Class',
    byStudent: 'Individual Student',
    filterClass: 'Select Class',
    filterStudent: 'Select Student',
    totalLetters: 'Total Letters',
    noData: 'No data available for this view.',
    topExemplary: 'Exemplary Behaviors Count',
    topMisbehaviors: 'Misbehavior Count',
    saved: 'Letter record saved.',
    studentSearch: 'Student Search / Select',
    copy: 'Copy Letter',
    behaviorView: 'Behavior View',
    textView: 'Text',
    emojiView: 'Emoji Grid',
    darkMode: 'Dark mode',
    lightMode: 'Light mode',
  },
  spanish: {
    greeting: 'Estimado padre, madre o tutor:',
    copied: 'La carta fue copiada al portapapeles.',
    englishLabel: 'Inglés',
    spanishLabel: 'Español',
    pashtoLabel: 'Pastún',
    studentName: 'Nombre del estudiante',
    parentName: 'Nombre del padre, madre o tutor',
    hrTeacher: 'Maestro/a de HR / Clase',
    signingTeacher: 'Docente que firma',
    uiLanguage: 'Idioma del sitio',
    letterLanguage: 'Idioma de la carta',
    language: 'Idioma',
    exemplary: 'Conductas ejemplares',
    misbehaviors: 'Conductas problemáticas',
    preview: 'Vista previa de la carta',
    save: 'Guardar registro de carta',
    shuffle: 'Cambiar apertura / cierre',
    stats: 'Estadísticas',
    overall: 'General',
    byClass: 'Por clase',
    byStudent: 'Estudiante individual',
    filterClass: 'Seleccionar clase',
    filterStudent: 'Seleccionar estudiante',
    totalLetters: 'Total de cartas',
    noData: 'No hay datos disponibles para esta vista.',
    topExemplary: 'Conteo de conductas ejemplares',
    topMisbehaviors: 'Conteo de conductas problemáticas',
    saved: 'Registro de carta guardado.',
    studentSearch: 'Buscar / seleccionar estudiante',
    copy: 'Copiar carta',
    behaviorView: 'Vista de conducta',
    textView: 'Texto',
    emojiView: 'Cuadrícula de emojis',
    darkMode: 'Modo oscuro',
    lightMode: 'Modo claro',
  },
  pashto: {
    greeting: 'ګرانه مور، پلار یا سرپرست،',
    copied: 'لیک کلپ بورډ ته کاپي شو.',
    englishLabel: 'انګلیسي',
    spanishLabel: 'هسپانوي',
    pashtoLabel: 'پښتو',
    studentName: 'د زده کوونکي نوم',
    parentName: 'د مور، پلار یا سرپرست نوم',
    hrTeacher: 'د HR ښوونکی / ټولګی',
    signingTeacher: 'لاسلیک کوونکی ښوونکی',
    uiLanguage: 'د وېب‌پاڼې ژبه',
    letterLanguage: 'د لیک ژبه',
    language: 'ژبه',
    exemplary: 'مثالي چلندونه',
    misbehaviors: 'ناسم چلندونه',
    preview: 'د لیک مخکتنه',
    save: 'د لیک ریکارډ خوندي کړئ',
    shuffle: 'پیل / پای بدل کړئ',
    stats: 'احصایې',
    overall: 'ټولیز',
    byClass: 'د ټولګي له مخې',
    byStudent: 'انفرادي زده کوونکی',
    filterClass: 'ټولګی وټاکئ',
    filterStudent: 'زده کوونکی وټاکئ',
    totalLetters: 'ټول لیکونه',
    noData: 'د دې لید لپاره معلومات نشته.',
    topExemplary: 'د مثالي چلندونو شمېر',
    topMisbehaviors: 'د ناسم چلندونو شمېر',
    saved: 'د لیک ریکارډ خوندي شو.',
    studentSearch: 'زده کوونکی وپلټئ / وټاکئ',
    copy: 'لیک کاپي کړئ',
    behaviorView: 'د چلند بڼه',
    textView: 'متن',
    emojiView: 'د ایموجي جال',
    darkMode: 'تیاره بڼه',
    lightMode: 'روښانه بڼه',
  },
} as const;

const openingStatements: Record<Language, string[]> = {
  english: [
    'I am writing to share a brief update about [studentName].',
    'I wanted to reach out with an update about [studentName] and their class performance.',
    'I am contacting you to keep you informed about how [studentName] is doing.',
    'I wanted to share an update with you regarding [studentName] and their experience in class.',
    'I am writing to provide a classroom update about [studentName] and their progress.',
    'I wanted to follow up with you about [studentName] and how they did during class.',
    'I am reaching out to share some observations about [studentName] from class.',
    'I wanted to provide a quick update about [studentName] and their choices during class.',
    'I am writing to let you know how [studentName] performed in class.',
    'I wanted to keep you informed about [studentName] and their participation in class.',
  ],
  spanish: [
    'Le escribo para compartir una breve actualización sobre [studentName].',
    'Quería comunicarme con usted con una actualización sobre [studentName] y su desempeño en clase.',
    'Me comunico con usted para mantenerle informado sobre cómo le está yendo a [studentName].',
    'Quería compartir con usted una actualización sobre [studentName] y su experiencia en clase.',
    'Le escribo para brindarle una actualización del salón sobre [studentName] y su progreso.',
    'Quería darle seguimiento con respecto a [studentName] y cómo le fue durante la clase.',
    'Me comunico con usted para compartir algunas observaciones sobre [studentName] en clase.',
    'Quería darle una actualización rápida sobre [studentName] y sus decisiones durante la clase.',
    'Le escribo para informarle cómo se desempeñó [studentName] en clase.',
    'Quería mantenerle informado sobre [studentName] y su participación en clase.',
  ],
  pashto: [
    'زه دا لیکم چې د [studentName] په اړه یو لنډ تازه معلومات درسره شریک کړم.',
    'ما غوښتل له تاسو سره د [studentName] او د هغه یا هغې د ټولګي د کارکردګۍ په اړه یو تازه معلومات شریک کړم.',
    'زه له تاسو سره اړیکه نیسم ترڅو تاسو خبر وساتم چې [studentName] څنګه کار کوي.',
    'ما غوښتل له تاسو سره د [studentName] او په ټولګي کې د هغه یا هغې د تجربې په اړه یو تازه معلومات شریک کړم.',
    'زه دا لیکم ترڅو د [studentName] او د هغه یا هغې د پرمختګ په اړه د ټولګي یو تازه راپور درکړم.',
    'ما غوښتل د [studentName] او د ټولګي پر مهال د هغه یا هغې د کړنو په اړه تعقیبي معلومات درکړم.',
    'زه اړیکه نیسم ترڅو د [studentName] په اړه له ټولګي څخه ځینې مشاهدې درسره شریکې کړم.',
    'ما غوښتل د [studentName] او په ټولګي کې د هغه یا هغې د انتخابونو په اړه یو چټک تازه معلومات درکړم.',
    'زه دا لیکم ترڅو تاسو خبر کړم چې [studentName] په ټولګي کې څنګه و.',
    'ما غوښتل تاسو د [studentName] او په ټولګي کې د هغه یا هغې د ګډون په اړه خبر وساتم.',
  ],
};

const closingStatementsByCategory: Record<Language, Record<ClosingCategory, string[]>> = {
  english: {
    goodOnly: [
      'I appreciate your support in encouraging [studentName] to continue these positive choices.',
      'Thank you for your continued support as we work together to help [studentName] build on these strengths.',
      'I am pleased to share this progress and hope [studentName] continues moving in this direction.',
      'I appreciate your partnership in reinforcing the habits that help [studentName] succeed in class.',
      'Thank you for taking the time to review this update and celebrate [studentName]\'s positive effort.',
      'With continued support, I believe [studentName] can continue showing strong focus and responsibility.',
      'I value your support as we help [studentName] continue growing in responsibility, respect, and classroom readiness.',
      'Thank you for working with me to support [studentName]\'s continued growth in class.',
      'I appreciate your attention to this update and your support as [studentName] continues to grow in class.',
      'I am glad to share these positive observations and hope to see [studentName] continue this progress.',
    ],
    badOnly: [
      'I appreciate your support in helping [studentName] reflect on these choices and make better ones moving forward.',
      'Thank you for your continued support as we work together to help [studentName] make stronger choices in class.',
      'I am confident that with support, consistency, and reflection, [studentName] can make positive progress.',
      'Please speak with [studentName] about these concerns so that we can continue working together toward improvement.',
      'I appreciate your partnership in reinforcing the expectations that help students succeed at school.',
      'Thank you for taking the time to review this update and support [studentName] in making better classroom choices.',
      'With continued support, I believe [studentName] can show stronger focus, self-control, and follow-through in class.',
      'I value your support as we help [studentName] continue growing in responsibility, respect, and classroom readiness.',
      'Thank you for working with me to support [studentName]\'s growth both academically and behaviorally.',
      'I appreciate your attention to this matter and your support as [studentName] continues to grow in class.',
    ],
    mixed: [
      'I appreciate your support in helping [studentName] build on these strengths while also making better choices moving forward.',
      'Thank you for your continued support as we work together to help [studentName] continue the positive behaviors while improving in other areas.',
      'I am confident that with support, consistency, and reflection, [studentName] can continue making positive progress.',
      'Please speak with [studentName] about both the strengths and concerns from class so that we can continue working together toward improvement.',
      'I appreciate your partnership in reinforcing the positive habits already shown while also addressing the areas that still need attention.',
      'Thank you for taking the time to review this update and support [studentName] in building on the positives while improving classroom choices.',
      'With continued support, I believe [studentName] can strengthen these positive behaviors and improve in the areas of concern.',
      'I value your support as we help [studentName] continue growing in responsibility, respect, and classroom readiness.',
      'Thank you for working with me to support [studentName]\'s growth both academically and behaviorally.',
      'I appreciate your attention to this update and your support as [studentName] continues to grow in class.',
    ],
    neutral: [
      'Thank you for your time and continued support.',
      'I appreciate your attention to this update.',
      'Thank you for working with me to support [studentName].',
    ],
  },
  spanish: {
    goodOnly: [
      'Agradezco su apoyo para animar a [studentName] a continuar con estas decisiones positivas.',
      'Gracias por su apoyo continuo mientras trabajamos juntos para ayudar a [studentName] a seguir desarrollando estas fortalezas.',
      'Me alegra compartir este progreso y espero que [studentName] continúe en esta dirección.',
      'Agradezco su colaboración para reforzar los hábitos que ayudan a [studentName] a tener éxito en clase.',
      'Gracias por tomarse el tiempo para revisar esta actualización y reconocer el esfuerzo positivo de [studentName].',
      'Con apoyo continuo, creo que [studentName] puede seguir mostrando un fuerte enfoque y responsabilidad.',
      'Valoro su apoyo mientras ayudamos a [studentName] a seguir creciendo en responsabilidad, respeto y disposición para aprender.',
      'Gracias por trabajar conmigo para apoyar el crecimiento continuo de [studentName] en clase.',
      'Agradezco su atención a esta actualización y su apoyo mientras [studentName] sigue creciendo en clase.',
      'Me alegra compartir estas observaciones positivas y espero seguir viendo este progreso en [studentName].',
    ],
    badOnly: [
      'Agradezco su apoyo para ayudar a [studentName] a reflexionar sobre estas decisiones y tomar mejores en adelante.',
      'Gracias por su apoyo continuo mientras trabajamos juntos para ayudar a [studentName] a tomar decisiones más adecuadas en clase.',
      'Confío en que con apoyo, constancia y reflexión, [studentName] puede lograr un progreso positivo.',
      'Por favor hable con [studentName] sobre estas preocupaciones para que podamos seguir trabajando juntos hacia una mejora.',
      'Agradezco su colaboración para reforzar las expectativas que ayudan a los estudiantes a tener éxito en la escuela.',
      'Gracias por tomarse el tiempo para revisar esta actualización y apoyar a [studentName] en tomar mejores decisiones en clase.',
      'Con apoyo continuo, creo que [studentName] puede mostrar un mejor enfoque, autocontrol y seguimiento en clase.',
      'Valoro su apoyo mientras ayudamos a [studentName] a seguir creciendo en responsabilidad, respeto y disposición para aprender.',
      'Gracias por trabajar conmigo para apoyar el crecimiento de [studentName] tanto académica como conductualmente.',
      'Agradezco su atención a este asunto y su apoyo mientras [studentName] sigue creciendo en clase.',
    ],
    mixed: [
      'Agradezco su apoyo para ayudar a [studentName] a fortalecer estas conductas positivas y también mejorar en las áreas de preocupación.',
      'Gracias por su apoyo continuo mientras trabajamos juntos para ayudar a [studentName] a mantener lo positivo y mejorar en otras áreas.',
      'Confío en que con apoyo, constancia y reflexión, [studentName] puede seguir logrando un progreso positivo.',
      'Por favor hable con [studentName] tanto sobre sus fortalezas como sobre las preocupaciones para que podamos seguir trabajando juntos hacia una mejora.',
      'Agradezco su colaboración para reforzar los hábitos positivos que ya se observaron y también atender las áreas que aún necesitan apoyo.',
      'Gracias por tomarse el tiempo para revisar esta actualización y apoyar a [studentName] en seguir construyendo sobre lo positivo mientras mejora sus decisiones en clase.',
      'Con apoyo continuo, creo que [studentName] puede fortalecer estas conductas positivas y mejorar en las áreas de preocupación.',
      'Valoro su apoyo mientras ayudamos a [studentName] a seguir creciendo en responsabilidad, respeto y disposición para aprender.',
      'Gracias por trabajar conmigo para apoyar el crecimiento de [studentName] tanto académica como conductualmente.',
      'Agradezco su atención a esta actualización y su apoyo mientras [studentName] sigue creciendo en clase.',
    ],
    neutral: [
      'Gracias por su tiempo y apoyo continuo.',
      'Agradezco su atención a esta actualización.',
      'Gracias por trabajar conmigo para apoyar a [studentName].',
    ],
  },
  pashto: {
    goodOnly: [
      'زه ستاسو له ملاتړ څخه مننه کوم چې [studentName] وهڅوئ څو دغو مثبتو انتخابونو ته دوام ورکړي.',
      'مننه چې له موږ سره یو ځای کار کوئ ترڅو [studentName] وکولای شي پر دغو پیاوړتیاوو لا نور جوړ کړي.',
      'زه خوښ یم چې دا پرمختګ درسره شریکوم او هیله لرم چې [studentName] همدې لوري ته دوام ورکړي.',
      'زه ستاسو د همکارۍ منندوی یم چې هغه عادتونه پیاوړي کوئ چې له [studentName] سره په ټولګي کې د بریا مرسته کوي.',
      'مننه چې وخت مو ونیو ترڅو دا تازه معلومات ولولئ او د [studentName] مثبتې هڅې وستایئ.',
      'د دوامداره ملاتړ په مرسته، زه باور لرم چې [studentName] کولی شي لا هم ښه تمرکز او مسئولیت وښيي.',
      'زه ستاسو ملاتړ ته ارزښت ورکوم ځکه چې موږ له [studentName] سره مرسته کوو څو په مسئولیت، درناوي، او د ټولګي چمتووالي کې لا زیات وده وکړي.',
      'مننه چې له ما سره یو ځای د [studentName] د دوامدارې ودې ملاتړ کوئ.',
      'زه ستاسو د پاملرنې او ملاتړ ستاینه کوم ځکه چې [studentName] په ټولګي کې لا زیات وده کوي.',
      'زه خوښ یم چې دا مثبتې مشاهدې درسره شریکوم او هیله لرم چې د [studentName] دا پرمختګ دوام ومومي.',
    ],
    badOnly: [
      'زه ستاسو له ملاتړ څخه مننه کوم چې له [studentName] سره به مرسته وکړي څو د خپلو انتخابونو په اړه فکر وکړي او په راتلونکې کې غوره انتخابونه وکړي.',
      'مننه چې له موږ سره یو ځای کار کوئ ترڅو [studentName] ته په ټولګي کې د غوره انتخابونو کولو کې مرسته وشي.',
      'زه باور لرم چې د ملاتړ، ثبات، او فکر کولو په مرسته [studentName] کولی شي مثبت پرمختګ وکړي.',
      'مهرباني وکړئ له [studentName] سره د دې اندېښنو په اړه خبرې وکړئ څو موږ یو ځای د ښه والي لپاره کار ته دوام ورکړو.',
      'زه ستاسو د همکارۍ منندوی یم چې هغه تمې پیاوړې کوئ چې زده کوونکو ته په ښوونځي کې د بریا مرسته کوي.',
      'مننه چې وخت مو ونیو ترڅو دا تازه معلومات ولولئ او د [studentName] ملاتړ وکړئ چې په ټولګي کې غوره انتخابونه وکړي.',
      'د دوامداره ملاتړ په مرسته، زه باور لرم چې [studentName] کولی شي په ټولګي کې لا ښه تمرکز، ځان کنټرول، او تعقیب وښيي.',
      'زه ستاسو ملاتړ ته ارزښت ورکوم ځکه چې موږ له [studentName] سره مرسته کوو څو په مسئولیت، درناوي، او د ټولګي چمتووالي کې لا زیات وده وکړي.',
      'مننه چې له ما سره یو ځای د [studentName] د علمي او چلندیزې ودې ملاتړ کوئ.',
      'زه ستاسو د پاملرنې او ملاتړ ستاینه کوم ځکه چې [studentName] په ټولګي کې لا زیات وده کوي.',
    ],
    mixed: [
      'زه ستاسو له ملاتړ څخه مننه کوم چې له [studentName] سره به مرسته وکړي څو په ښودل شوو پیاوړتیاوو لا نور جوړ کړي او په اندېښمنو برخو کې هم ښه والی راولي.',
      'مننه چې له موږ سره یو ځای کار کوئ ترڅو [studentName] وکولای شي مثبت چلندونه وساتي او په نورو برخو کې هم ښه والی راولي.',
      'زه باور لرم چې د ملاتړ، ثبات، او فکر کولو په مرسته [studentName] کولی شي خپل مثبت پرمختګ ته دوام ورکړي.',
      'مهرباني وکړئ له [studentName] سره هم د پیاوړتیاوو او هم د اندېښنو په اړه خبرې وکړئ څو موږ یو ځای د ښه والي لپاره کار ته دوام ورکړو.',
      'زه ستاسو د همکارۍ منندوی یم چې هغه مثبت عادتونه پیاوړي کوئ چې لا دمخه ښکاره شوي او هم هغه برخې هم په نښه کوئ چې لا هم پاملرنې ته اړتیا لري.',
      'مننه چې وخت مو ونیو ترڅو دا تازه معلومات ولولئ او د [studentName] ملاتړ وکړئ څو پر مثبتو برخو لا نور جوړ کړي او په ټولګي کې خپلې پریکړې لا ښې کړي.',
      'د دوامداره ملاتړ په مرسته، زه باور لرم چې [studentName] کولی شي دا مثبت چلندونه لا پیاوړي کړي او د اندېښنې وړ برخو کې ښه والی راولي.',
      'زه ستاسو ملاتړ ته ارزښت ورکوم ځکه چې موږ له [studentName] سره مرسته کوو څو په مسئولیت، درناوي، او د ټولګي چمتووالي کې لا زیات وده وکړي.',
      'مننه چې له ما سره یو ځای د [studentName] د علمي او چلندیزې ودې ملاتړ کوئ.',
      'زه ستاسو د پاملرنې او ملاتړ ستاینه کوم ځکه چې [studentName] په ټولګي کې لا زیات وده کوي.',
    ],
    neutral: [
      'مننه ستاسو له وخت او دوامدار ملاتړ څخه.',
      'زه ستاسو د دې تازه معلوماتو په اړه د پاملرنې منندوی یم.',
      'مننه چې له ما سره یو ځای د [studentName] ملاتړ کوئ.',
    ],
  },
};

function pickRandomIndex(length: number) {
  return Math.floor(Math.random() * length);
}

function replaceStudentName(text: string, studentName: string) {
  return text.split('[studentName]').join(studentName || 'the student');
}

function readLocalStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalStorage<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function emptyStats(): StatsShape {
  return {
    overall: {
      exemplary: {},
      misbehaviors: {},
      totalLetters: 0,
    },
    byClass: {},
    byStudent: {},
  };
}

function incrementCounts(target: Record<string, number>, items: string[]) {
  items.forEach((item) => {
    target[item] = (target[item] || 0) + 1;
  });
}

function sortedCountEntries(record: Record<string, number>) {
  return Object.entries(record).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function getMaxCount(record: Record<string, number>) {
  const values = Object.values(record);
  return values.length ? Math.max(...values) : 1;
}

function toggleSelection(current: string[], id: string) {
  return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
}

function getClosingCategory(hasExemplary: boolean, hasMisbehaviors: boolean): ClosingCategory {
  if (hasExemplary && hasMisbehaviors) return 'mixed';
  if (hasExemplary) return 'goodOnly';
  if (hasMisbehaviors) return 'badOnly';
  return 'neutral';
}

function getOptionLabelById(id: string, language: Language) {
  return behaviorLookup.get(id)?.label[language] || id;
}

function getOptionShortById(id: string, language: Language) {
  return behaviorLookup.get(id)?.short[language] || id;
}

function getOptionEmojiById(id: string) {
  return behaviorLookup.get(id)?.emoji || '•';
}

function toParagraphListFromIds(ids: string[], language: Language) {
  const items = ids.map((id) => getOptionLabelById(id, language));
  if (!items.length) return '';

  if (language === 'spanish') {
    if (items.length === 1) return `${items[0]}.`;
    if (items.length === 2) return `${items[0]} y ${items[1]}.`;
    return `${items.slice(0, -1).join(', ')}, y ${items[items.length - 1]}.`;
  }

  if (language === 'pashto') {
    if (items.length === 1) return `${items[0]}۔`;
    return `${items.join('، ')}۔`;
  }

  if (items.length === 1) return `${items[0]}.`;
  if (items.length === 2) return `${items[0]} and ${items[1]}.`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}.`;
}

export default function ParentLetterGenerator() {
  const [studentName, setStudentName] = useState('');
  const [parentName, setParentName] = useState('');
  const [hrTeacher, setHrTeacher] = useState('');
  const [signingTeacher, setSigningTeacher] = useState('Mr. Magee');
  const [uiLanguage, setUiLanguage] = useState<Language>('english');
  const [language, setLanguage] = useState<Language>('english');
  const [selectedTheme, setSelectedTheme] = useState<ThemeKey>('blue');
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [behaviorViewMode, setBehaviorViewMode] = useState<BehaviorViewMode>('text');
  const [selectedExemplary, setSelectedExemplary] = useState<string[]>([]);
  const [selectedMisbehaviors, setSelectedMisbehaviors] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const [openingIndex, setOpeningIndex] = useState(0);
  const [closingIndex, setClosingIndex] = useState(0);

  const [profiles, setProfiles] = useState<StudentProfile[]>([]);
  const [records, setRecords] = useState<StudentRecord[]>([]);
  const [stats, setStats] = useState<StatsShape>(emptyStats());

  const [statsTab, setStatsTab] = useState<StatsTab>('overall');
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const [studentFilter, setStudentFilter] = useState<string | null>(null);

  const t = staticText[uiLanguage];
  const palette = themePalette[selectedTheme][themeMode];
  const goodTileBg = themeMode === 'dark' ? '#16351d' : '#dcfce7';
  const goodTileBorder = themeMode === 'dark' ? '#22c55e' : '#86efac';
  const badTileBg = themeMode === 'dark' ? '#3a1616' : '#fee2e2';
  const badTileBorder = themeMode === 'dark' ? '#ef4444' : '#fca5a5';

  useEffect(() => {
    const loadedProfiles = readLocalStorage<StudentProfile[]>(STORAGE_KEYS.profiles, []);
    const loadedRecords = readLocalStorage<StudentRecord[]>(STORAGE_KEYS.records, []);
    const loadedStats = readLocalStorage<StatsShape>(STORAGE_KEYS.stats, emptyStats());
    const loadedSigningTeacher = readLocalStorage<string>(STORAGE_KEYS.signingTeacher, 'Mr. Magee');
    const loadedTheme = readLocalStorage<ThemeKey>(STORAGE_KEYS.theme, 'blue');
    const loadedThemeMode = readLocalStorage<ThemeMode>(STORAGE_KEYS.themeMode, 'light');
    const loadedUiLanguage = readLocalStorage<Language>(STORAGE_KEYS.uiLanguage, 'english');

    setProfiles(loadedProfiles);
    setRecords(loadedRecords);
    setStats(loadedStats);
    setSigningTeacher(loadedSigningTeacher);
    setSelectedTheme(loadedTheme);
    setThemeMode(loadedThemeMode);
    setUiLanguage(loadedUiLanguage);
    setOpeningIndex(pickRandomIndex(openingStatements.english.length));
    setClosingIndex(0);
  }, []);

  const hasExemplary = selectedExemplary.length > 0;
  const hasMisbehaviors = selectedMisbehaviors.length > 0;
  const closingCategory = getClosingCategory(hasExemplary, hasMisbehaviors);
  const availableClosings = closingStatementsByCategory[language][closingCategory];

  const shufflePhrases = () => {
    setOpeningIndex(pickRandomIndex(openingStatements[language].length));
    setClosingIndex(pickRandomIndex(availableClosings.length));
  };

  useEffect(() => {
    setOpeningIndex(pickRandomIndex(openingStatements[language].length));
    setClosingIndex(pickRandomIndex(availableClosings.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, closingCategory]);

  const handleThemeChange = (theme: ThemeKey) => {
    setSelectedTheme(theme);
    writeLocalStorage(STORAGE_KEYS.theme, theme);
  };

  const handleThemeModeToggle = () => {
    const nextMode: ThemeMode = themeMode === 'light' ? 'dark' : 'light';
    setThemeMode(nextMode);
    writeLocalStorage(STORAGE_KEYS.themeMode, nextMode);
  };

  const handleUiLanguageChange = (next: Language) => {
    setUiLanguage(next);
    writeLocalStorage(STORAGE_KEYS.uiLanguage, next);
  };

  const currentOpening = replaceStudentName(
    openingStatements[language][openingIndex],
    studentName.trim(),
  );
  const currentClosing = replaceStudentName(
    availableClosings[closingIndex] || availableClosings[0],
    studentName.trim(),
  );

  const exemplaryParagraph = toParagraphListFromIds(selectedExemplary, language);
  const misbehaviorParagraph = toParagraphListFromIds(selectedMisbehaviors, language);

  const letterText = useMemo(() => {
    const studentLabel =
      studentName.trim() ||
      (language === 'spanish'
        ? 'el estudiante'
        : language === 'pashto'
          ? 'زده کوونکي'
          : 'the student');

    const greetingLine = parentName.trim()
      ? language === 'spanish'
        ? `Estimado/a ${parentName.trim()},`
        : language === 'pashto'
          ? `${parentName.trim()} ګران/ګرانه،`
          : `Dear ${parentName.trim()},`
      : staticText[language].greeting;

    const exemplaryLeadIn = hasExemplary
      ? language === 'spanish'
        ? `He notado que ${studentLabel} `
        : language === 'pashto'
          ? `ما لیدلي چې ${studentLabel} `
          : `I have noticed that ${studentLabel} `
      : '';

    const misbehaviorLeadIn = hasMisbehaviors
      ? language === 'spanish'
        ? hasExemplary
          ? `También he notado que ${studentLabel} `
          : `He notado que ${studentLabel} `
        : language === 'pashto'
          ? hasExemplary
            ? `ما دا هم لیدلي چې ${studentLabel} `
            : `ما لیدلي چې ${studentLabel} `
          : hasExemplary
            ? `I have also noticed that ${studentLabel} `
            : `I have noticed that ${studentLabel} `
      : '';

    const exemplarySection = hasExemplary ? `${exemplaryLeadIn}${exemplaryParagraph}` : '';
    const misbehaviorSection = hasMisbehaviors ? `${misbehaviorLeadIn}${misbehaviorParagraph}` : '';

    const signatureTeacher = signingTeacher.trim() || `${studentLabel}'s Teacher`;

    const signatureBlock =
      language === 'spanish'
        ? `Atentamente,\n${signatureTeacher}`
        : language === 'pashto'
          ? `په درنښت،\n${signatureTeacher}`
          : `Sincerely,\n${signatureTeacher}`;

    return [
      greetingLine,
      '',
      currentOpening,
      exemplarySection ? '' : undefined,
      exemplarySection,
      misbehaviorSection ? '' : undefined,
      misbehaviorSection,
      '',
      currentClosing,
      '',
      signatureBlock,
    ]
      .filter(Boolean)
      .join('\n');
  }, [
    currentClosing,
    currentOpening,
    exemplaryParagraph,
    hasExemplary,
    hasMisbehaviors,
    language,
    misbehaviorParagraph,
    parentName,
    signingTeacher,
    studentName,
  ]);

  const copyLetter = async () => {
    try {
      await navigator.clipboard.writeText(letterText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const saveLetterRecord = () => {
    const trimmedStudent = studentName.trim();
    if (!trimmedStudent) return;

    const trimmedParent = parentName.trim();
    const trimmedHr = hrTeacher.trim();
    const trimmedSigningTeacher = signingTeacher.trim() || 'Mr. Magee';
    const now = new Date().toISOString();

    const newRecord: StudentRecord = {
      studentName: trimmedStudent,
      parentName: trimmedParent,
      hrTeacher: trimmedHr,
      signingTeacher: trimmedSigningTeacher,
      createdAt: now,
      language,
      exemplary: selectedExemplary,
      misbehaviors: selectedMisbehaviors,
      letter: letterText,
    };

    const updatedRecords = [newRecord, ...records];
    setRecords(updatedRecords);
    writeLocalStorage(STORAGE_KEYS.records, updatedRecords);
    writeLocalStorage(STORAGE_KEYS.signingTeacher, trimmedSigningTeacher);

    const profileMap = new Map(profiles.map((p) => [p.studentName.toLowerCase(), p]));
    const existing = profileMap.get(trimmedStudent.toLowerCase());

    const updatedProfile: StudentProfile = existing
      ? {
          ...existing,
          studentName: trimmedStudent,
          parentName: trimmedParent,
          hrTeacher: trimmedHr,
          signingTeacher: trimmedSigningTeacher,
          totalLetters: existing.totalLetters + 1,
          lastUpdated: now,
        }
      : {
          studentName: trimmedStudent,
          parentName: trimmedParent,
          hrTeacher: trimmedHr,
          signingTeacher: trimmedSigningTeacher,
          totalLetters: 1,
          lastUpdated: now,
        };

    profileMap.set(trimmedStudent.toLowerCase(), updatedProfile);

    const updatedProfiles = Array.from(profileMap.values()).sort((a, b) =>
      a.studentName.localeCompare(b.studentName),
    );

    setProfiles(updatedProfiles);
    writeLocalStorage(STORAGE_KEYS.profiles, updatedProfiles);

    const nextStats: StatsShape = JSON.parse(JSON.stringify(stats));

    nextStats.overall.totalLetters += 1;
    incrementCounts(nextStats.overall.exemplary, selectedExemplary);
    incrementCounts(nextStats.overall.misbehaviors, selectedMisbehaviors);

    const classKey = trimmedHr || 'Unassigned';
    if (!nextStats.byClass[classKey]) {
      nextStats.byClass[classKey] = {
        exemplary: {},
        misbehaviors: {},
        totalLetters: 0,
      };
    }
    nextStats.byClass[classKey].totalLetters += 1;
    incrementCounts(nextStats.byClass[classKey].exemplary, selectedExemplary);
    incrementCounts(nextStats.byClass[classKey].misbehaviors, selectedMisbehaviors);

    if (!nextStats.byStudent[trimmedStudent]) {
      nextStats.byStudent[trimmedStudent] = {
        exemplary: {},
        misbehaviors: {},
        totalLetters: 0,
        hrTeacher: trimmedHr,
      };
    }
    nextStats.byStudent[trimmedStudent].totalLetters += 1;
    nextStats.byStudent[trimmedStudent].hrTeacher = trimmedHr;
    incrementCounts(nextStats.byStudent[trimmedStudent].exemplary, selectedExemplary);
    incrementCounts(nextStats.byStudent[trimmedStudent].misbehaviors, selectedMisbehaviors);

    setStats(nextStats);
    writeLocalStorage(STORAGE_KEYS.stats, nextStats);

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const recentStudents = useMemo(
    () => profiles.slice().sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated)),
    [profiles],
  );

  const classOptions = useMemo(() => {
    const classes = Array.from(
      new Set(
        profiles
          .map((p) => p.hrTeacher)
          .filter(Boolean)
          .concat(Object.keys(stats.byClass)),
      ),
    );
    return classes.sort((a, b) => a.localeCompare(b));
  }, [profiles, stats.byClass]);

  const studentOptions = useMemo(() => {
    const students = Array.from(
      new Set(profiles.map((p) => p.studentName).concat(Object.keys(stats.byStudent))),
    );
    return students.sort((a, b) => a.localeCompare(b));
  }, [profiles, stats.byStudent]);

  const currentStatsView = useMemo(() => {
    if (statsTab === 'overall') return stats.overall;
    if (statsTab === 'class') return classFilter ? stats.byClass[classFilter] : undefined;
    return studentFilter ? stats.byStudent[studentFilter] : undefined;
  }, [classFilter, stats, statsTab, studentFilter]);

  const exemplaryMax = currentStatsView ? getMaxCount(currentStatsView.exemplary) : 1;
  const misbehaviorMax = currentStatsView ? getMaxCount(currentStatsView.misbehaviors) : 1;

  const sharedTextFieldSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: palette.panelBg,
      color: palette.text,
      '& fieldset': {
        borderColor: palette.border,
      },
      '&:hover fieldset': {
        borderColor: palette.accent,
      },
      '&.Mui-focused fieldset': {
        borderColor: palette.accent,
      },
    },
    '& .MuiInputLabel-root': {
      color: palette.subtext,
    },
    '& .MuiInputBase-input': {
      color: palette.text,
    },
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: palette.pageBg, p: { xs: 2, md: 3 } }}>
      <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
        <Stack spacing={2} sx={{ mb: 3 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
            spacing={2}
            flexWrap="wrap"
            useFlexGap
          >
            <Box>
              <Typography variant="h4" fontWeight={700} sx={{ color: palette.text }}>
                Parent Letter Generator
              </Typography>

              <Typography variant="body1" sx={{ color: palette.subtext, mt: 0.5 }}>
                Create letters quickly, copy them instantly, and track behavior patterns over time.
              </Typography>
            </Box>

            <Stack alignItems={{ xs: 'flex-start', md: 'flex-end' }} spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel sx={{ color: palette.subtext }}>{t.uiLanguage}</InputLabel>
                  <Select
                    value={uiLanguage}
                    label={t.uiLanguage}
                    onChange={(e) => handleUiLanguageChange(e.target.value as Language)}
                    sx={{
                      bgcolor: palette.panelBg,
                      color: palette.text,
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: palette.border,
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: palette.accent,
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: palette.accent,
                      },
                    }}
                  >
                    <MenuItem value="english">{staticText[uiLanguage].englishLabel}</MenuItem>
                    <MenuItem value="spanish">{staticText[uiLanguage].spanishLabel}</MenuItem>
                    <MenuItem value="pashto">{staticText[uiLanguage].pashtoLabel}</MenuItem>
                  </Select>
                </FormControl>

                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {themeOrder.map((themeKey) => {
                    const isSelected = selectedTheme === themeKey;
                    return (
                      <Tooltip key={themeKey} title={themePalette[themeKey][themeMode].label}>
                        <Box
                          component="button"
                          type="button"
                          onClick={() => handleThemeChange(themeKey)}
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: 1,
                            border: isSelected ? `2px solid ${palette.text}` : `1px solid ${palette.border}`,
                            backgroundColor: themePalette[themeKey][themeMode].accent,
                            cursor: 'pointer',
                            boxShadow: isSelected ? 2 : 0,
                          }}
                        />
                      </Tooltip>
                    );
                  })}
                </Stack>
              </Stack>

              <Button
                variant="outlined"
                size="small"
                onClick={handleThemeModeToggle}
                sx={{
                  minWidth: 110,
                  color: palette.accent,
                  borderColor: palette.accent,
                  '&:hover': {
                    borderColor: palette.accent,
                    bgcolor: palette.accentSoft,
                  },
                }}
              >
                {themeMode === 'light' ? t.darkMode : t.lightMode}
              </Button>
            </Stack>
          </Stack>
        </Stack>

        <Grid container spacing={3} alignItems="stretch">
          <Grid item xs={12} lg={5} sx={{ display: 'flex' }}>
            <Card
              sx={{
                width: '100%',
                borderRadius: 4,
                boxShadow: 3,
                bgcolor: palette.panelBg,
                border: `1px solid ${palette.border}`,
              }}
            >
              <CardContent>
                <Stack spacing={2.5}>
                  <Autocomplete
                    freeSolo
                    options={recentStudents.map((p) => p.studentName)}
                    value={studentName}
                    onInputChange={(_, value) => {
                      setStudentName(value);

                      const matched = profiles.find(
                        (p) => p.studentName.toLowerCase() === value.trim().toLowerCase(),
                      );

                      if (matched) {
                        setParentName(matched.parentName || '');
                        setHrTeacher(matched.hrTeacher || '');
                        setSigningTeacher(matched.signingTeacher || 'Mr. Magee');
                      } else {
                        setParentName('');
                      }
                    }}
                    renderInput={(params) => (
                      <TextField {...params} label={t.studentSearch} fullWidth sx={sharedTextFieldSx} />
                    )}
                  />

                  <TextField
                    label={t.parentName}
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    fullWidth
                    sx={sharedTextFieldSx}
                  />

                  <TextField
                    label={t.hrTeacher}
                    value={hrTeacher}
                    onChange={(e) => setHrTeacher(e.target.value)}
                    fullWidth
                    sx={sharedTextFieldSx}
                  />

                  <TextField
                    label={t.signingTeacher}
                    value={signingTeacher}
                    onChange={(e) => setSigningTeacher(e.target.value)}
                    fullWidth
                    sx={sharedTextFieldSx}
                  />

                  <FormControl fullWidth>
                    <InputLabel sx={{ color: palette.subtext }}>{t.letterLanguage}</InputLabel>
                    <Select
                      value={language}
                      label={t.letterLanguage}
                      onChange={(e) => setLanguage(e.target.value as Language)}
                      sx={{
                        bgcolor: palette.panelBg,
                        color: palette.text,
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: palette.border,
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: palette.accent,
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: palette.accent,
                        },
                      }}
                    >
                      <MenuItem value="english">{t.englishLabel}</MenuItem>
                      <MenuItem value="spanish">{t.spanishLabel}</MenuItem>
                      <MenuItem value="pashto">{t.pashtoLabel}</MenuItem>
                    </Select>
                  </FormControl>

                  <Stack spacing={1}>
                    <Typography variant="subtitle2" sx={{ color: palette.subtext, fontWeight: 700 }}>
                      {t.behaviorView}
                    </Typography>

                    <Stack direction="row" spacing={1}>
                      <Button
                        variant={behaviorViewMode === 'text' ? 'contained' : 'outlined'}
                        onClick={() => setBehaviorViewMode('text')}
                        sx={{
                          bgcolor: behaviorViewMode === 'text' ? palette.accent : 'transparent',
                          color: behaviorViewMode === 'text' ? palette.buttonText : palette.accent,
                          borderColor: palette.accent,
                          '&:hover': {
                            bgcolor: behaviorViewMode === 'text' ? palette.accent : palette.accentSoft,
                            borderColor: palette.accent,
                          },
                        }}
                      >
                        {t.textView}
                      </Button>

                      <Button
                        variant={behaviorViewMode === 'emoji' ? 'contained' : 'outlined'}
                        onClick={() => setBehaviorViewMode('emoji')}
                        sx={{
                          bgcolor: behaviorViewMode === 'emoji' ? palette.accent : 'transparent',
                          color: behaviorViewMode === 'emoji' ? palette.buttonText : palette.accent,
                          borderColor: palette.accent,
                          '&:hover': {
                            bgcolor: behaviorViewMode === 'emoji' ? palette.accent : palette.accentSoft,
                            borderColor: palette.accent,
                          },
                        }}
                      >
                        {t.emojiView}
                      </Button>
                    </Stack>
                  </Stack>

                  {behaviorViewMode === 'text' ? (
                    <Autocomplete
                      multiple
                      options={exemplaryOptions}
                      value={exemplaryOptions.filter((option) => selectedExemplary.includes(option.id))}
                      onChange={(_, value) => setSelectedExemplary(value.map((item) => item.id))}
                      disableCloseOnSelect
                      filterSelectedOptions
                      getOptionLabel={(option) => option.label[uiLanguage]}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip
                            key={option.id}
                            label={`${option.emoji} ${option.label[uiLanguage]}`}
                            {...getTagProps({ index })}
                            sx={{
                              bgcolor: palette.accentSoft,
                              color: palette.text,
                            }}
                          />
                        ))
                      }
                      renderInput={(params) => (
                        <TextField {...params} label={t.exemplary} placeholder="Search or scroll" sx={sharedTextFieldSx} />
                      )}
                    />
                  ) : (
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1, color: palette.subtext, fontWeight: 700 }}>
                        {t.exemplary}
                      </Typography>

                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
                          gap: 1,
                        }}
                      >
                        {exemplaryOptions.map((option) => {
                          const selected = selectedExemplary.includes(option.id);
                          return (
                            <Box
                              key={option.id}
                              component="button"
                              type="button"
                              onClick={() => setSelectedExemplary(toggleSelection(selectedExemplary, option.id))}
                              sx={{
                                minHeight: 88,
                                p: 1,
                                borderRadius: 2,
                                border: selected ? `2px solid ${goodTileBorder}` : `1px solid ${palette.border}`,
                                bgcolor: goodTileBg,
                                color: palette.text,
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                textAlign: 'center',
                                gap: 0.5,
                                boxShadow: selected ? 2 : 0,
                              }}
                            >
                              <Typography sx={{ fontSize: 28, lineHeight: 1 }}>{option.emoji}</Typography>
                              <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                                {option.short[uiLanguage]}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  )}

                  {behaviorViewMode === 'text' ? (
                    <Autocomplete
                      multiple
                      options={misbehaviorOptions}
                      value={misbehaviorOptions.filter((option) => selectedMisbehaviors.includes(option.id))}
                      onChange={(_, value) => setSelectedMisbehaviors(value.map((item) => item.id))}
                      disableCloseOnSelect
                      filterSelectedOptions
                      getOptionLabel={(option) => option.label[uiLanguage]}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip
                            key={option.id}
                            label={`${option.emoji} ${option.label[uiLanguage]}`}
                            {...getTagProps({ index })}
                            sx={{
                              bgcolor: palette.accentSoft,
                              color: palette.text,
                            }}
                          />
                        ))
                      }
                      renderInput={(params) => (
                        <TextField {...params} label={t.misbehaviors} placeholder="Search or scroll" sx={sharedTextFieldSx} />
                      )}
                    />
                  ) : (
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1, color: palette.subtext, fontWeight: 700 }}>
                        {t.misbehaviors}
                      </Typography>

                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
                          gap: 1,
                        }}
                      >
                        {misbehaviorOptions.map((option) => {
                          const selected = selectedMisbehaviors.includes(option.id);
                          return (
                            <Box
                              key={option.id}
                              component="button"
                              type="button"
                              onClick={() => setSelectedMisbehaviors(toggleSelection(selectedMisbehaviors, option.id))}
                              sx={{
                                minHeight: 88,
                                p: 1,
                                borderRadius: 2,
                                border: selected ? `2px solid ${badTileBorder}` : `1px solid ${palette.border}`,
                                bgcolor: badTileBg,
                                color: palette.text,
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                textAlign: 'center',
                                gap: 0.5,
                                boxShadow: selected ? 2 : 0,
                              }}
                            >
                              <Typography sx={{ fontSize: 28, lineHeight: 1 }}>{option.emoji}</Typography>
                              <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                                {option.short[uiLanguage]}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  )}

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <Button
                      variant="outlined"
                      startIcon={<ShuffleIcon />}
                      onClick={shufflePhrases}
                      fullWidth
                      sx={{
                        color: palette.accent,
                        borderColor: palette.accent,
                        '&:hover': {
                          borderColor: palette.accent,
                          bgcolor: palette.accentSoft,
                        },
                      }}
                    >
                      {t.shuffle}
                    </Button>

                    <Button
                      variant="contained"
                      onClick={saveLetterRecord}
                      fullWidth
                      sx={{
                        bgcolor: palette.accent,
                        color: palette.buttonText,
                        '&:hover': {
                          bgcolor: palette.accent,
                          filter: 'brightness(0.95)',
                        },
                      }}
                    >
                      {t.save}
                    </Button>
                  </Stack>

                  {saved && <Alert severity="success">{t.saved}</Alert>}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={7} sx={{ display: 'flex' }}>
            <Card
              sx={{
                width: '100%',
                borderRadius: 4,
                boxShadow: 3,
                bgcolor: palette.panelBg,
                border: `1px solid ${palette.border}`,
              }}
            >
              <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Stack spacing={2} sx={{ flex: 1, height: '100%' }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="h6" fontWeight={700} sx={{ color: palette.text }}>
                      {t.preview}
                    </Typography>

                    <Tooltip title={t.copy}>
                      <IconButton onClick={copyLetter} sx={{ color: palette.accent }}>
                        <ContentCopyIcon />
                      </IconButton>
                    </Tooltip>
                  </Stack>

                  <TextField
                    value={letterText}
                    multiline
                    fullWidth
                    sx={{
                      flex: 1,
                      ...sharedTextFieldSx,
                    }}
                    InputProps={{
                      sx: {
                        alignItems: 'flex-start',
                        fontFamily: 'monospace',
                        height: '100%',
                        color: palette.text,
                        bgcolor: palette.panelBg,
                      },
                    }}
                  />

                  <Button
                    variant="contained"
                    startIcon={<ContentCopyIcon />}
                    onClick={copyLetter}
                    sx={{
                      bgcolor: palette.accent,
                      color: palette.buttonText,
                      '&:hover': {
                        bgcolor: palette.accent,
                        filter: 'brightness(0.95)',
                      },
                    }}
                  >
                    {t.copy}
                  </Button>

                  {copied && <Alert severity="success">{t.copied}</Alert>}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Box sx={{ mt: 3 }}>
          <Card
            sx={{
              borderRadius: 4,
              boxShadow: 3,
              bgcolor: palette.panelBg,
              border: `1px solid ${palette.border}`,
            }}
          >
            <CardContent>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2, color: palette.text }}>
                {t.stats}
              </Typography>

              <Tabs
                value={statsTab}
                onChange={(_, value) => setStatsTab(value)}
                sx={{
                  mb: 2,
                  '& .MuiTab-root': {
                    color: palette.subtext,
                  },
                  '& .Mui-selected': {
                    color: `${palette.accent} !important`,
                  },
                  '& .MuiTabs-indicator': {
                    backgroundColor: palette.accent,
                  },
                }}
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab value="overall" label={t.overall} />
                <Tab value="class" label={t.byClass} />
                <Tab value="student" label={t.byStudent} />
              </Tabs>

              {statsTab === 'class' && (
                <Autocomplete
                  options={classOptions}
                  value={classFilter}
                  onChange={(_, value) => setClassFilter(value)}
                  renderInput={(params) => <TextField {...params} label={t.filterClass} sx={sharedTextFieldSx} />}
                  sx={{ mb: 2 }}
                />
              )}

              {statsTab === 'student' && (
                <Autocomplete
                  options={studentOptions}
                  value={studentFilter}
                  onChange={(_, value) => setStudentFilter(value)}
                  renderInput={(params) => <TextField {...params} label={t.filterStudent} sx={sharedTextFieldSx} />}
                  sx={{ mb: 2 }}
                />
              )}

              {!currentStatsView ? (
                <Alert severity="info">{t.noData}</Alert>
              ) : (
                <Stack spacing={3}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ color: palette.text }}>
                    {t.totalLetters}: {currentStatsView.totalLetters}
                  </Typography>

                  <Divider sx={{ borderColor: palette.border }} />

                  <Box>
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ color: palette.text }}>
                      {t.topExemplary}
                    </Typography>

                    <Stack spacing={1.25}>
                      {sortedCountEntries(currentStatsView.exemplary).length ? (
                        sortedCountEntries(currentStatsView.exemplary).map(([id, count]) => {
                          const widthPercent = Math.max(18, (count / exemplaryMax) * 100);

                          return (
                            <Box
                              key={id}
                              sx={{
                                width: '100%',
                                bgcolor: palette.panelAlt,
                                border: `1px solid ${palette.border}`,
                                borderRadius: 2,
                                overflow: 'hidden',
                              }}
                            >
                              <Box
                                sx={{
                                  width: `${widthPercent}%`,
                                  bgcolor: palette.accent,
                                  color: palette.buttonText,
                                  px: 1.5,
                                  py: 1,
                                  minHeight: 44,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 2,
                                  transition: 'width 0.25s ease',
                                }}
                              >
                                <Typography
                                  variant="body2"
                                  sx={{
                                    color: palette.buttonText,
                                    fontWeight: 600,
                                    lineHeight: 1.2,
                                  }}
                                >
                                  {getOptionLabelById(id, uiLanguage)}
                                </Typography>

                                <Typography
                                  variant="body2"
                                  sx={{
                                    color: palette.buttonText,
                                    fontWeight: 700,
                                    flexShrink: 0,
                                  }}
                                >
                                  {count}
                                </Typography>
                              </Box>
                            </Box>
                          );
                        })
                      ) : (
                        <Typography sx={{ color: palette.subtext }}>{t.noData}</Typography>
                      )}
                    </Stack>
                  </Box>

                  <Divider sx={{ borderColor: palette.border }} />

                  <Box>
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ color: palette.text }}>
                      {t.topMisbehaviors}
                    </Typography>

                    <Stack spacing={1.25}>
                      {sortedCountEntries(currentStatsView.misbehaviors).length ? (
                        sortedCountEntries(currentStatsView.misbehaviors).map(([id, count]) => {
                          const widthPercent = Math.max(18, (count / misbehaviorMax) * 100);

                          return (
                            <Box
                              key={id}
                              sx={{
                                width: '100%',
                                bgcolor: palette.panelAlt,
                                border: `1px solid ${palette.border}`,
                                borderRadius: 2,
                                overflow: 'hidden',
                              }}
                            >
                              <Box
                                sx={{
                                  width: `${widthPercent}%`,
                                  bgcolor: palette.accent,
                                  color: palette.buttonText,
                                  px: 1.5,
                                  py: 1,
                                  minHeight: 44,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 2,
                                  transition: 'width 0.25s ease',
                                }}
                              >
                                <Typography
                                  variant="body2"
                                  sx={{
                                    color: palette.buttonText,
                                    fontWeight: 600,
                                    lineHeight: 1.2,
                                  }}
                                >
                                  {getOptionLabelById(id, uiLanguage)}
                                </Typography>

                                <Typography
                                  variant="body2"
                                  sx={{
                                    color: palette.buttonText,
                                    fontWeight: 700,
                                    flexShrink: 0,
                                  }}
                                >
                                  {count}
                                </Typography>
                              </Box>
                            </Box>
                          );
                        })
                      ) : (
                        <Typography sx={{ color: palette.subtext }}>{t.noData}</Typography>
                      )}
                    </Stack>
                  </Box>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}