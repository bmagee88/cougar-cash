import { useState } from "react";
import type { Answer, Question } from "./engine";
import { instructionReading } from "./reading";

// A real image replaces its emoji only after loading. Slow/offline/broken references
// retain a usable picture and never hold up narration or the answer gate.
export function TokenArt({ token }: { token: Answer }) {
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = token.image && failed !== token.image;
  return <span className="cc-token-art" aria-hidden="true">
    <span style={{ visibility: showImage && loaded === token.image ? "hidden" : undefined }}>{token.value}</span>
    {showImage && <img src={token.image} alt="" draggable={false} referrerPolicy="no-referrer" style={{ visibility: loaded === token.image ? "visible" : "hidden" }}
      onLoad={() => setLoaded(token.image)} onError={() => setFailed(token.image)} />}
  </span>;
}

export function QuestionClues({ question, onRead, disabled = false }: { question: Question; onRead?: (text: string) => void; disabled?: boolean }) {
  const sequence = question.sequence, robot = question.robot;
  if (question.context || question.options) return <div className="cc-scenario">
    {question.context && <p className="cc-scenario-context"><button type="button" className="cc-read-text" disabled={disabled} aria-label="Read the situation" onClick={() => onRead?.(question.context)}>{question.context}</button></p>}
    {question.options && <ol className="cc-scenario-options" aria-label="Choose a number on a leaf">
      {question.options.map(option => <li key={option.value}><button type="button" className="cc-choice-reading" disabled={disabled} aria-label={`Read choice ${option.value}`} onClick={() => onRead?.(`${option.value}. ${option.spoken || option.text}`)}><span aria-hidden="true">{option.value}</span><span>{option.text}</span><i aria-hidden="true">♪</i></button></li>)}
    </ol>}
  </div>;
  if (!sequence) return null;
  return <div className={`cc-instructions ${robot ? "cc-instructions--robot" : ""}`}>
    {robot && <div className="cc-robot-grid" role="img" aria-label={`Robot in row ${Math.floor(robot.start / 3) + 1}, column ${robot.start % 3 + 1}. Star in row ${Math.floor(robot.goal / 3) + 1}, column ${robot.goal % 3 + 1}.`}>
      {Array.from({ length: 9 }, (_, index) => <span key={index} aria-hidden="true" className={index === robot.goal ? "is-goal" : ""}>{index === robot.start ? "🤖" : index === robot.goal ? "⭐" : "·"}</span>)}
    </div>}
    <p className="cc-plan-caption"><button type="button" className="cc-read-text" disabled={disabled} aria-label="Read the plan title" onClick={() => onRead?.(sequence.caption)}>{sequence.caption}</button></p>
    <div className="cc-step-list" role="group" aria-label={`${sequence.caption}. Steps from left to right.`}>
      {sequence.steps.map((step, index) => <button type="button" key={index} className={`cc-step ${step.missing ? "cc-step--missing" : ""} ${step.incorrect ? "cc-step--incorrect" : ""} ${sequence.reference === index ? "cc-step--reference" : ""}`}
        disabled={disabled} onClick={() => onRead?.(instructionReading(step))}
        aria-label={`Read instruction ${step.label === "?" ? "with missing number" : index + 1}`}>
        <span className="cc-step-number" aria-hidden="true">{step.label === "?" ? "?" : index + 1}</span>
        <span className="cc-step-picture" aria-hidden="true">{step.missing ? "?" : <TokenArt token={step.token} />}</span>
        <small aria-hidden="true">{step.incorrect ? "Fix me!" : step.label === "?" || /^\d+$/.test(step.label) ? "Step" : step.label}</small>
      </button>)}
    </div>
    {sequence.reference !== undefined && <p className="cc-plan-reference"><button type="button" className="cc-read-text" disabled={disabled} onClick={() => onRead?.(`This step: ${sequence.steps[sequence.reference].token.spoken}`)}>This step: {sequence.steps[sequence.reference].token.spoken}</button></p>}
    {sequence.repeat && <p className="cc-plan-repeat"><button type="button" className="cc-read-text" disabled={disabled} onClick={() => onRead?.(`Repeat ${sequence.repeat} times`)}><span aria-hidden="true">↻</span> Repeat {sequence.repeat} times</button></p>}
  </div>;
}
