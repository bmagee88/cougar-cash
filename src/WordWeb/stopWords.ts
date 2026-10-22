import { normalize } from "./graph";

// Function words stay readable in definitions without becoming exploration links.
const STOP_WORDS = new Set(`
  a an the and or but nor for so yet
  about above across after against along among around as at before behind below
  beneath beside between beyond by down during except from in inside into near
  of off on onto out outside over through throughout to toward towards under
  underneath until up upon via with within without
  i me my mine myself we us our ours ourselves you your yours yourself yourselves
  he him his himself she her hers herself it its itself they them their theirs
  themselves this that these those who whom whose which what whoever whomever
  whichever whatever
  am is are was were be been being have has had having do does did doing
  can could may might must shall should will would
  if unless because although though while whereas whether when whenever where
  wherever why how than then also too very just only even ever never not no yes
  all any both each either neither every some such enough there here again once
  i'm i've i'll i'd you're you've you'll you'd he's he'll he'd she's she'll she'd
  it's it'll it'd we're we've we'll we'd they're they've they'll they'd that's
  there's here's what's who's where's when's why's how's let's
  aren't isn't wasn't weren't hasn't haven't hadn't don't doesn't didn't
  can't cannot couldn't won't wouldn't shouldn't mustn't needn't shan't
`.trim().split(/\s+/));

export const isStopWord = (word: string): boolean => STOP_WORDS.has(normalize(word));
