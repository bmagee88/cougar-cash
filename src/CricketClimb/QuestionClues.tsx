import { useState } from "react";
import type { Answer, Question } from "./engine";

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

export function QuestionClues({ question }: { question: Question }) {
  const sequence = question.sequence, robot = question.robot;
  if (question.context || question.options) return <div className="cc-scenario">
    {question.context && <p className="cc-scenario-context">{question.context}</p>}
    {question.options && <ol className="cc-scenario-options" aria-label="Choose a number on a leaf">
      {question.options.map(option => <li key={option.value}><span aria-hidden="true">{option.value}</span>{option.text}</li>)}
    </ol>}
  </div>;
  if (!sequence) return null;
  return <div className={`cc-instructions ${robot ? "cc-instructions--robot" : ""}`}>
    {robot && <div className="cc-robot-grid" role="img" aria-label={`Robot in row ${Math.floor(robot.start / 3) + 1}, column ${robot.start % 3 + 1}. Star in row ${Math.floor(robot.goal / 3) + 1}, column ${robot.goal % 3 + 1}.`}>
      {Array.from({ length: 9 }, (_, index) => <span key={index} aria-hidden="true" className={index === robot.goal ? "is-goal" : ""}>{index === robot.start ? "🤖" : index === robot.goal ? "⭐" : "·"}</span>)}
    </div>}
    <p className="cc-plan-caption">{sequence.caption}</p>
    <div className="cc-step-list" role="group" aria-label={`${sequence.caption}. Steps from left to right.`}>
      {sequence.steps.map((step, index) => <div key={index} className={`cc-step ${step.missing ? "cc-step--missing" : ""} ${step.incorrect ? "cc-step--incorrect" : ""} ${sequence.reference === index ? "cc-step--reference" : ""}`}
        role="img" aria-label={`Step ${step.label === "?" ? "number missing" : index + 1}. ${step.label}. ${step.missing ? "Missing instruction" : step.token.spoken}${step.incorrect ? ". Mistake: replace this instruction" : ""}${sequence.reference === index ? ". Start from this step" : ""}`}>
        <span className="cc-step-number" aria-hidden="true">{step.label === "?" ? "?" : index + 1}</span>
        <span className="cc-step-picture" aria-hidden="true">{step.missing ? "?" : <TokenArt token={step.token} />}</span>
        <small aria-hidden="true">{step.incorrect ? "Fix me!" : step.label === "?" || /^\d+$/.test(step.label) ? "Step" : step.label}</small>
      </div>)}
    </div>
    {sequence.reference !== undefined && <p className="cc-plan-reference">This step: {sequence.steps[sequence.reference].token.spoken}</p>}
    {sequence.repeat && <p className="cc-plan-repeat"><span aria-hidden="true">↻</span> Repeat {sequence.repeat} times</p>}
  </div>;
}
