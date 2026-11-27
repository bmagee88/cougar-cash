import React, { useEffect, useRef, useState } from "react";
import { Modal } from "@mui/material";
import { VERTICAL_COLUMNS, VerticalHomeKey } from "./verticalMode";
import "./DdrTypingCoach.css";

const ASSETS = `${process.env.PUBLIC_URL || ""}/assets/typing-ddr/coach`;
export const COACH_CARD_MS = 5000;
export const COACH_CARD_COUNT = 5;
export const COACH_COUNTDOWN_MS = 3000;
export type CoachCue = "finger" | "kitty" | "tall" | "eyes" | "home" | "count" | "go";

export function getFingerLesson(homeKey: VerticalHomeKey) {
  const hand = VERTICAL_COLUMNS[homeKey].hand;
  const finger = homeKey === "a" || homeKey === ";" ? "pinky"
    : homeKey === "s" || homeKey === "l" ? "ring"
    : homeKey === "d" || homeKey === "k" ? "middle" : "pointer";
  const reach = homeKey === "g" || homeKey === "h";
  const color = reach ? "#7dd3fc" : { pinky: "#ec4899", ring: "#facc15", middle: "#f97316", pointer: "#22c55e" }[finger];
  const home = homeKey === "g" ? "f" : homeKey === "h" ? "j" : homeKey;
  const colorName = reach ? "light blue" : { pinky: "pink", ring: "yellow", middle: "orange", pointer: "green" }[finger];
  return { hand, finger, reach, color, colorName, home, image: `${ASSETS}/${reach ? "reach" : finger}-hands.webp` };
}

function FingerImage({ homeKey, onLoad, onError }: { homeKey: VerticalHomeKey; onLoad?: () => void; onError?: () => void }) {
  const lesson = getFingerLesson(homeKey);
  return (
    <div className={`ddr-coach-hand ddr-coach-hand--${lesson.hand}`}>
      <img src={lesson.image} alt={`${lesson.hand} hand with the ${lesson.finger} finger highlighted in ${lesson.colorName}`} onLoad={onLoad} onError={onError} draggable={false} />
      <span className="ddr-coach-hand-glow" aria-hidden="true" />
    </div>
  );
}

export function DdrFingerPreview({ homeKey, activeKeys, onStart }: { homeKey: VerticalHomeKey; activeKeys: string[]; onStart: () => void }) {
  const lesson = getFingerLesson(homeKey);
  return (
    <div className="ddr-coach-preview" style={{ "--coach-accent": lesson.color } as React.CSSProperties}>
      <FingerImage homeKey={homeKey} />
      <div>
        <span className="ddr-coach-eyebrow">Your finger for this round</span>
        <strong>{lesson.hand} {lesson.finger} finger</strong>
        <span className="ddr-coach-preview-keys">{activeKeys.map((key) => key.toUpperCase()).join(" · ")}</span>
        <small>{lesson.reach ? `Reach from ${lesson.home.toUpperCase()}, then come home.` : `Home is ${lesson.home.toUpperCase()}. Come back after every tap.`}</small>
      </div>
      <button type="button" onClick={onStart}>Let’s get ready!</button>
    </div>
  );
}

function HomeHouses({ homeKey }: { homeKey: VerticalHomeKey }) {
  const home = getFingerLesson(homeKey).home;
  return (
    <div className="ddr-coach-houses" role="img" aria-label="Home row houses: A S D F, G and H reach keys, J K L semicolon. Feel the bumps on F and J.">
      {(["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"] as VerticalHomeKey[]).map((key, index) => {
        const lesson = getFingerLesson(key);
        return <div key={key} className={`ddr-coach-house${lesson.reach ? " ddr-coach-house--reach" : ""}${key === home ? " ddr-coach-house--yours" : ""}`} style={{ "--house-color": lesson.color, "--house-delay": `${index * 100}ms` } as React.CSSProperties}>
          <span>{key.toUpperCase()}</span>
          <i aria-hidden="true">{key === "f" || key === "j" ? "━" : ""}</i>
        </div>;
      })}
    </div>
  );
}

type Props = {
  homeKey: VerticalHomeKey;
  activeKeys: string[];
  soundOn: boolean;
  onToggleSound: () => void;
  onCue: (cue: CoachCue) => void;
  onComplete: () => void;
  onCancel: () => void;
};

export default function DdrTypingCoach({ homeKey, activeKeys, soundOn, onToggleSound, onCue, onComplete, onCancel }: Props) {
  const lesson = getFingerLesson(homeKey);
  const [step, setStep] = useState(0);
  const [imageReady, setImageReady] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [count, setCount] = useState(3);
  const countdown = step === COACH_CARD_COUNT;
  const completeRef = useRef(onComplete);
  const cueRef = useRef(onCue);
  completeRef.current = onComplete;
  cueRef.current = onCue;

  const cards = [
    { id: "finger", title: `Meet your ${lesson.finger} finger!`, line: `Use your ${lesson.hand} ${lesson.finger} for ${activeKeys.map((key) => key.toUpperCase()).join(" · ")}.`, reminder: lesson.reach ? `Light-blue reach! Start on ${lesson.home.toUpperCase()} and come back after each tap.` : `Find ${lesson.home.toUpperCase()}. This is your finger’s home.`, image: lesson.image, alt: "" },
    { id: "kitty", title: "Kitty pounce!", line: "Elbows in. Paws ready.", reminder: "Be a kitty, not a chicken. Keep your elbows close to your body.", image: `${ASSETS}/kitty-elbows.webp`, alt: "A kitten keeps its elbows close at a keyboard; a chicken sticks its wings out." },
    { id: "tall", title: "Sit tall at your table!", line: "Back tall. Shoulders soft. Feet supported.", reminder: "Sit like a tall tree, with your keyboard right in front of you.", image: `${ASSETS}/sit-tall.webp`, alt: "A child sits upright at a table with relaxed shoulders and supported feet." },
    { id: "eyes", title: "Eyes on the screen!", line: "Watch the screen. Feel the keys.", reminder: "Let your fingers find their way. Keep watching the screen!", image: `${ASSETS}/eyes-screen.webp`, alt: "A child looks at the computer screen while keeping fingers on the keyboard." },
    { id: "home", title: "Every finger has a home!", line: "A S D F     J K L ;", reminder: "Keep the other fingers home. Reach, tap, and come home. Feel the bumps on F and J!", image: `${ASSETS}/home-row.webp`, alt: "Fingers return to colorful little houses on a keyboard’s home row." },
  ];
  const card = cards[Math.min(step, COACH_CARD_COUNT - 1)];

  useEffect(() => {
    // Warm the remaining illustrations while the first one is on screen.
    [lesson.image, "kitty-elbows", "sit-tall", "eyes-screen", "home-row"].forEach((name, index) => {
      const image = new Image();
      image.src = index === 0 ? name : `${ASSETS}/${name}.webp`;
    });
  }, [lesson.image]);

  useEffect(() => {
    if (countdown || !imageReady) return;
    cueRef.current(card.id as CoachCue);
    const started = performance.now();
    const ticker = window.setInterval(() => setSecondsLeft(Math.max(1, Math.ceil((COACH_CARD_MS - (performance.now() - started)) / 1000))), 200);
    const timer = window.setTimeout(() => {
      setImageReady(false);
      setImageFailed(false);
      setSecondsLeft(5);
      setStep((current) => current + 1);
    }, COACH_CARD_MS);
    return () => { window.clearTimeout(timer); window.clearInterval(ticker); };
  }, [step, imageReady, countdown, card.id]);

  useEffect(() => {
    if (!countdown) return;
    cueRef.current("count");
    const timer = window.setTimeout(() => {
      if (count === 1) {
        cueRef.current("go");
        completeRef.current();
      } else setCount((current) => current - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, count]);

  const loaded = () => setImageReady(true);
  const failed = () => { setImageFailed(true); setImageReady(true); };
  return (
    <Modal open onClose={onCancel} aria-labelledby="ddr-coach-title" aria-describedby="ddr-coach-reminder" slotProps={{ backdrop: { sx: { backgroundColor: "rgba(15, 18, 45, .96)" } } }}>
      <div className="ddr-coach" role="dialog" aria-label="Typing warm-up" style={{ "--coach-accent": lesson.color } as React.CSSProperties}>
        <header className="ddr-coach-toolbar">
          <span>Little typist warm-up</span>
          <div>
            <button type="button" onClick={onToggleSound} aria-label={soundOn ? "Mute warm-up sounds" : "Enable warm-up sounds"}>{soundOn ? "♪ Sound on" : "♪ Sound off"}</button>
            <button type="button" onClick={onCancel}>Back to menu</button>
          </div>
        </header>
        <ol className="ddr-coach-steps" aria-label="Warm-up steps">
          {["Your finger", "Kitty elbows", "Sit tall", "Eyes up", "Finger homes"].map((label, index) => <li key={label} aria-current={index === step ? "step" : undefined} data-done={index < step}><span>{index < step ? "✓" : index + 1}</span><small>{label}</small></li>)}
        </ol>
        {countdown ? (
          <div className="ddr-coach-countdown">
            <h2 id="ddr-coach-title">Ready to pounce?</h2>
            <div key={count} className="ddr-coach-count" role="status" aria-label={`Starting in ${count}`}>{count}</div>
            <p id="ddr-coach-reminder">{lesson.hand} {lesson.finger} ready. Eyes up!</p>
            <HomeHouses homeKey={homeKey} />
          </div>
        ) : (
          <section key={card.id} className={`ddr-coach-card ddr-coach-card--${card.id}`} aria-live="polite">
            <div className="ddr-coach-copy">
              <span className="ddr-coach-eyebrow">Let’s get ready · {step + 1} of {COACH_CARD_COUNT}</span>
              <h2 id="ddr-coach-title">{card.title}</h2>
              <p className="ddr-coach-line">{card.line}</p>
              <p id="ddr-coach-reminder">{card.reminder}</p>
              {step === 0 && <span className="ddr-coach-finger-badge">{lesson.hand} hand · {lesson.colorName}</span>}
            </div>
            <div className={`ddr-coach-art${imageFailed ? " ddr-coach-art--failed" : ""}`}>
              {step === 0 ? <FingerImage homeKey={homeKey} onLoad={loaded} onError={failed} /> : <img className="ddr-coach-illustration" src={card.image} alt={card.alt} onLoad={loaded} onError={failed} draggable={false} />}
              <div className={`ddr-coach-overlay ddr-coach-overlay--${card.id}`} aria-hidden="true">
                {step === 1 ? <><span className="ddr-coach-paw">➜</span><span className="ddr-coach-paw">←</span><b>Elbows in!</b></> : step === 2 ? <><span>↑</span><b>Grow tall!</b></> : step === 3 ? <><span>✦</span><b>Look here!</b></> : step === 4 ? <b>Tap → home!</b> : <><span>✦</span><span>✧</span></>}
              </div>
              {imageFailed && <span className="ddr-coach-image-fallback">{card.line}</span>}
            </div>
            {step === 4 && <HomeHouses homeKey={homeKey} />}
            <footer className="ddr-coach-progress">
              <span>{imageReady ? `Take a moment · ${secondsLeft}s` : "Getting your picture ready…"}</span>
              <div className="ddr-coach-progress-track" role="progressbar" aria-label="Time on this picture" aria-valuemin={0} aria-valuemax={5} aria-valuenow={imageReady ? 5 - secondsLeft : 0}><i className={imageReady ? "is-running" : ""} /></div>
            </footer>
          </section>
        )}
      </div>
    </Modal>
  );
}
