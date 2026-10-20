import { FormEvent, useEffect, useRef, useState } from "react";
import { Settings, scoreKey } from "./engine";
import { GRADE_LEVELS, Grade, SKILL_GROUPS, SkillId } from "./resources";

type Props = { settings: Settings; playing: boolean; onClose: () => void; onSave: (settings: Settings) => void };

export default function SettingsDialog({ settings, playing, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<Settings>({ ...settings, skills: [...settings.skills], grades: [...settings.grades] });
  const dialog = useRef<HTMLDialogElement>(null);
  const changedGame = scoreKey(settings) !== scoreKey(draft);
  const listeningOnly = !draft.voice && Math.min(...draft.grades) < 2 && draft.skills.length > 0 && draft.skills.every(skill => skill === "letters");
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); };
  }, []);
  function update<K extends keyof Settings>(key: K, value: Settings[K]) { setDraft(current => ({ ...current, [key]: value })); }
  function submit(event: FormEvent) { event.preventDefault(); if (draft.skills.length && draft.grades.length && !listeningOnly) onSave(draft); }
  function toggleSkill(id: SkillId) {
    update("skills", draft.skills.includes(id) ? draft.skills.filter(skill => skill !== id) : [...draft.skills, id]);
  }
  function toggleGrade(id: Grade) { update("grades", draft.grades.includes(id) ? draft.grades.filter(grade => grade !== id) : [...draft.grades, id].sort()); }
  return <dialog ref={dialog} className="cc-settings" aria-labelledby="cc-settings-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <form onSubmit={submit}>
      <div className="cc-settings-heading"><div><span className="cc-eyebrow">MAKE IT THEIR OWN</span><h2 id="cc-settings-title">Garden settings</h2></div>
        <button type="button" className="cc-icon-button" aria-label="Close settings" onClick={onClose}>✕</button></div>
      <div className="cc-settings-body">
        <fieldset><legend>Pick a little world</legend><div className="cc-theme-options">
          <button type="button" aria-label="Sunny Garden theme" aria-pressed={draft.theme === "sunny"} className={`cc-theme-choice cc-theme-choice--sunny ${draft.theme === "sunny" ? "is-selected" : ""}`} onClick={() => update("theme", "sunny")}>
            <span className="cc-theme-picture">☀️<i>🌱</i><b>🌼</b></span><span>Sunny Garden</span><small>Warm skies & wildflowers</small></button>
          <button type="button" aria-label="Moonlit Meadow theme" aria-pressed={draft.theme === "moonlit"} className={`cc-theme-choice cc-theme-choice--moonlit ${draft.theme === "moonlit" ? "is-selected" : ""}`} onClick={() => update("theme", "moonlit")}>
            <span className="cc-theme-picture">🌙<i>🌿</i><b>✨</b></span><span>Moonlit Meadow</span><small>Soft stars & fireflies</small></button>
        </div></fieldset>
        <div className="cc-settings-columns">
          <fieldset><legend>Leaves on each level</legend><div className="cc-count-options">
            {[2, 3, 4, 5].map(count => <button key={count} type="button" aria-label={`${count} answer leaves`} aria-pressed={draft.platforms === count}
              className={draft.platforms === count ? "is-selected" : ""} onClick={() => update("platforms", count)}>{count}</button>)}
          </div><p className="cc-setting-note">More leaves, a bigger challenge.</p></fieldset>
          <fieldset><legend>When Pip takes a tumble</legend><div className="cc-fall-options">
            <label><input type="radio" name="fallMode" value="limited" aria-label="Limited fall. Catch a leaf within the number of answer leaves." checked={draft.fallMode === "limited"} onChange={() => update("fallMode", "limited")} /><span><strong>Little tumbles</strong><small>Fall at most {draft.platforms} levels.</small></span></label>
            <label><input type="radio" name="fallMode" value="random" aria-label="Totally random. You can fall all the way to the ground." checked={draft.fallMode === "random"} onChange={() => update("fallMode", "random")} /><span><strong>Wild tumbles</strong><small>Any leaf, any distance!</small></span></label>
          </div></fieldset>
        </div>
        <fieldset><legend>Choose grade levels</legend><p className="cc-setting-note">Start with the lowest checked grade. After six patches, grow into the next checked grade. One grade stays at that grade.</p>
          <div className="cc-grade-options">{GRADE_LEVELS.map(grade => <label key={grade.id} className={`cc-grade-choice ${draft.grades.includes(grade.id) ? "is-selected" : ""}`}>
            <input type="checkbox" aria-label={grade.label} checked={draft.grades.includes(grade.id)} onChange={() => toggleGrade(grade.id)} />
            <span className="cc-grade-mark" aria-hidden="true">{grade.icon}</span><span>{grade.label}</span>
          </label>)}</div>
          {!draft.grades.length && <p className="cc-validation" role="alert">Choose at least one grade to play.</p>}
        </fieldset>
        <fieldset><legend>What shall we practice?</legend><p className="cc-setting-note">Check any mix. Letter-name listening questions need Read aloud; upper/lowercase matching works silently. Higher grades include earlier practice.</p>
          <button type="button" className="cc-text-button" aria-label="Select all nine computer checklist topics" onClick={() => update("skills", SKILL_GROUPS.find(group => group.label === "Your computer literacy checklist").skills.map(skill => skill.id as SkillId))}>Practice the computer checklist</button>
          <div className="cc-skill-groups">{SKILL_GROUPS.map(group => <div key={group.label}><h3>{group.label}</h3>
            {group.skills.map(skill => <label className="cc-skill" key={skill.id}><input type="checkbox" checked={draft.skills.includes(skill.id as SkillId)}
              aria-label={skill.label} onChange={() => toggleSkill(skill.id as SkillId)} /><span className="cc-skill-icon" aria-hidden="true">{skill.icon}</span><span>{skill.label}</span></label>)}
          </div>)}</div>
          {!draft.skills.length && <p className="cc-validation" role="alert">Choose at least one skill to play.</p>}
          {listeningOnly && <p className="cc-validation" role="alert">Turn on Read aloud for letter names, or choose another skill such as Big & little letters.</p>}
        </fieldset>
        <fieldset><legend>Sounds & a cheeky helper</legend>
          <div className="cc-toggle-list">
            <label><span><strong>Read aloud</strong><small>Read each question automatically. Off by default. Tap question text, clues, or a written choice to hear just that item anytime.</small></span><input type="checkbox" role="switch" aria-label="Read aloud" checked={draft.voice} onChange={() => update("voice", !draft.voice)} /></label>
            <label><span><strong>Garden sounds</strong><small>Happy hops, fanfares, and a cricket reminder after 15 quiet seconds, then every minute.</small></span><input type="checkbox" role="switch" aria-label="Garden sounds and cricket reminders" checked={draft.sounds} onChange={() => update("sounds", !draft.sounds)} /></label>
            <label><span><strong>The cheeky spider</strong><small>A sneaky face marks one wrong leaf when things get tricky.</small></span><input type="checkbox" role="switch" aria-label="Spider helper" checked={draft.spider} onChange={() => update("spider", !draft.spider)} /></label>
          </div>
          {draft.spider && <div className="cc-spider-rule"><span>Invite the spider after</span>
            <label><span className="cc-sr-only">Wrong answers</span><select aria-label="Wrong answers needed for the spider" value={draft.spiderMisses} onChange={event => update("spiderMisses", Number(event.target.value))}>{Array.from({ length: draft.spiderWindow }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></label>
            <span>misses in the last</span><label><span className="cc-sr-only">Attempt window</span><select aria-label="Number of recent attempts" value={draft.spiderWindow} onChange={event => {
              const spiderWindow = Number(event.target.value); setDraft(current => ({ ...current, spiderWindow, spiderMisses: Math.min(current.spiderMisses, spiderWindow) }));
            }}>{[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => <option key={n}>{n}</option>)}</select></label><span>tries.</span>
          </div>}
        </fieldset>
        <p className="cc-settings-footnote">Your latest climb keeps five levels on this device. Continue restores the saved grades and skills. Choose a fresh little climb to use new selections. Best levels stay separate for each mix of grades, skills, and game rules.</p>
        <p className="cc-settings-footnote">Computer pictures: <a href="https://github.com/jdecked/twemoji" target="_blank" rel="noreferrer" aria-label="Twemoji picture credits">Twemoji</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" aria-label="Picture license, Creative Commons Attribution 4.0">CC BY 4.0</a>.</p>
      </div>
      <div className="cc-settings-actions"><button type="button" className="cc-text-button" aria-label="Cancel settings" onClick={onClose}>Cancel</button>
        <button className="cc-primary" type="submit" disabled={!draft.skills.length || !draft.grades.length || listeningOnly} aria-label={playing && changedGame ? "Save settings and restart the climb" : "Save settings"}>{playing && changedGame ? "Save & restart" : "Save settings"}<span aria-hidden="true">↗</span></button></div>
    </form>
  </dialog>;
}
