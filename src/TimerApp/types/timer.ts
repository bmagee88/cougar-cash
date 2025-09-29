export type HHMM = `${number}${number}:${number}${number}`;

export type Segment = {
  id: string;
  title: string;
  color: string; // hex
  end: HHMM;     // segment ends at this boundary
};

export type Timer = {
  id: string;
  name: string;
  start: HHMM;
  end: HHMM;
  segments: Segment[]; // [start -> seg0.end] ... [segN-1.end -> end]
};
