import type { ArticleSummary, ScrollyChapter } from "../types";

export const inputProcessOutputSummary: ArticleSummary = {
  slug: "input-process-output",
  title: "Input, Process, Output",
  subtitle: "Computers, Devices, and Cables - Section 1.5. Follow a command through a computing system.",
  gradeBand: "Middle School Computer Science",
  readingTime: "7 min",
  status: "Ready",
  sectionLabel: "Section 1.5",
  accent: "#007f86",
  path: "/articles/input-process-output",
};

// The supplied PDF contains the vocabulary appendix, not section 1.5's prose.
// This original lesson uses its chapter 1 definitions and the requested topic.
export const inputProcessOutputChapter: ScrollyChapter = {
  slug: "input-process-output",
  title: "Input, Process, Output",
  subtitle: "How a computer turns a command into a result",
  dek: "A tap, a calculation, a result. Trace the three parts of a computing task, then change the data and instructions yourself.",
  gradeBand: "Middle School Computer Science",
  readingTime: "7 min",
  standards: ["Computing Systems", "Data", "Instructions"],
  mobileSticky: true,
  sourceLabel: "Companion lesson for Computers, Devices, and Cables, section 1.5. Definitions informed by the supplied Chapter 1 vocabulary appendix; examples and activities are original.",
  takeaways: [
    "Input is data or a command entering a computing system. Keyboards, microphones, cameras, and sensors can supply it.",
    "Processing follows instructions to work with data. A different instruction can produce a different result from the same input.",
    "Output is information or an effect produced by the system: an image, a sound, or a movement. A touchscreen can provide output and receive input.",
    "Input, process, and output describe a task. Memory holds data for current work; storage keeps data for later use. Neither is a replacement for processing.",
  ],
  scenes: [
    {
      id: "ipo-input",
      kind: "input-capture",
      title: "Input: data comes in",
      objective: "Identify the data or command entering a computing system and the hardware that captures it.",
      caption: "A key press becomes data that a program can use.",
      accent: "#007f86",
      visualElements: ["keyboard", "key press", "data packet", "system boundary", "received data"],
      initialState: "A keyboard sits outside the system boundary; its data has not arrived.",
      finalState: "A labeled packet crosses the boundary and appears in the received-data area.",
      trigger: "Scene scroll progress scrubs the packet along the arrow and reveals the received data; scrolling backward reverses the trace.",
      interaction: "Type a short message and compare the physical typing action with the data received by the system.",
      defaultInteraction: { inputText: "A" },
      steps: [
        {
          id: "input-action",
          eyebrow: "01 / Receive",
          title: "Every task begins with something coming in.",
          body: [
            "You press a key on your Chromebook. A moment later, a letter appears in a document. It feels like one action, but a computing system does several jobs between your finger and the screen.",
            "The first job is input: receiving data or a command. The keyboard detects a key press and sends information about that key to the computer. The press is the action; the information sent into the system is the input.",
          ],
        },
        {
          id: "input-sources",
          eyebrow: "Beyond the keyboard",
          title: "Input does not always come from a person.",
          body: [
            "A microphone captures sound. A camera captures light. A temperature sensor supplies measurements. All of these can give a computer data to work with.",
            "A mouse click or a tap can also send a command, such as Open this file. Ask what enters the system, and which device captures it.",
          ],
        },
        {
          id: "input-try",
          eyebrow: "Try it",
          title: "Send your own input.",
          body: [
            "Type a short message below. Your keystrokes supply input to this page. The received-data label shows the message the page now holds.",
            "The label on your screen is also output from the browser. A real task can contain several input-process-output cycles, even when we focus on just one part.",
          ],
          checkpoint: "input-lab",
        },
      ],
    },
    {
      id: "ipo-process",
      kind: "processing-rules",
      title: "Process: follow instructions",
      objective: "Explain how data and instructions work together to produce a result.",
      caption: "The input stays the same until you change it; the rule determines the result.",
      accent: "#a33860",
      visualElements: ["number input", "processor", "program instruction", "result", "direction arrows"],
      initialState: "An input number is present; the instruction and result are not yet emphasized.",
      finalState: "The instruction is revealed and the computed result arrives at the output stage.",
      trigger: "Scroll scrubs the data path, then reveals the instruction and result in order.",
      interaction: "Change an input number and select Double, Add 10, or Square; the diagram and result update from the same calculation.",
      defaultInteraction: { inputNumber: 4, processingRule: "double" },
      steps: [
        {
          id: "processing-rule",
          eyebrow: "02 / Transform",
          title: "Data needs an instruction.",
          body: [
            "The number 4 alone does not tell a computer what to do. A program supplies instructions: double it, add 10, compare it with another value, or display it.",
            "Processing is the work of following those instructions and transforming data. A processor, often called the CPU, carries out program instructions. Software describes the work; hardware carries it out.",
          ],
        },
        {
          id: "processing-memory",
          eyebrow: "Inside the system",
          title: "Working with data is different from keeping it.",
          body: [
            "Memory provides fast working space for the data and instructions a computer is using now. Storage keeps data for later, such as a saved document on a drive.",
            "Keeping the number 4 in memory is not the same as doubling it. The multiplication is processing. Holding the input and result helps the computer do that work.",
          ],
        },
        {
          id: "processing-try",
          eyebrow: "Experiment",
          title: "Same input. Different instruction.",
          body: [
            "Start with 4 and try each rule. Double produces 8, Add 10 produces 14, and Square produces 16. The input can stay fixed while the output changes.",
            "Now keep a rule fixed and change the input. Predict the result before moving the number control. Both the data and the instruction matter.",
          ],
          checkpoint: "rule-lab",
        },
      ],
    },
    {
      id: "ipo-output",
      kind: "output-loop",
      title: "Output: a result comes out",
      objective: "Recognize output as information or an effect, and explain why a touchscreen can handle both input and output.",
      caption: "The system sends a result outward. Your next action can start another cycle.",
      accent: "#4569ba",
      visualElements: ["computer", "output signal", "display", "speaker", "motor", "return input path"],
      initialState: "A result is ready inside the computer; the output device has not been emphasized.",
      finalState: "The selected device communicates the result, and a return path identifies the next input.",
      trigger: "Scroll progress reveals the outward signal and then the touchscreen's next-input path; backward scroll retracts the signal and fades the return path.",
      interaction: "Choose a display, speaker, or motor, then classify the two roles of a touchscreen.",
      defaultInteraction: { outputDestination: "display" },
      steps: [
        {
          id: "output-result",
          eyebrow: "03 / Communicate",
          title: "A result needs a way out.",
          body: [
            "Output is information or an effect produced by a computing system. A display can show a letter, image, or answer. A speaker can produce a sound. A computer controlling a robot can send a signal that makes a motor turn.",
            "Output is not limited to something you can see. Ask what the system produces, and which device communicates that result or causes the effect.",
          ],
        },
        {
          id: "output-choose",
          eyebrow: "Compare",
          title: "One system, different kinds of output.",
          body: [
            "Choose an output device below. The display presents a result visually, the speaker produces an alert, and the motor turns a shaft in response to a command.",
            "These are different programs and output signals. A number does not turn into a sound or movement by itself; the system follows instructions for the selected task.",
          ],
          checkpoint: "output-selector",
        },
        {
          id: "output-loop",
          eyebrow: "The next cycle",
          title: "One device can do two jobs.",
          body: [
            "A tablet screen displays a button: that is output. When you tap the button, its touch sensor sends the location of your tap into the system: that is input.",
            "The program processes the tap and produces a new result. In a game, this cycle repeats as you act and respond. The role depends on what the device is doing in the task.",
          ],
        },
        {
          id: "output-check",
          eyebrow: "Check your thinking",
          title: "Trace both directions.",
          body: [
            "A touchscreen shows a Play button, then detects your tap. Think about the direction information travels in each part of the task.",
          ],
          checkpoint: "concept-check",
          question: {
            prompt: "What roles does the touchscreen perform in this task?",
            correctValue: "both",
            choices: [
              { value: "input", label: "Input only", feedback: "Detecting the tap is input, but showing the button is output. Trace both directions." },
              { value: "output", label: "Output only", feedback: "Showing the button is output, but detecting the tap sends input into the system." },
              { value: "both", label: "Both input and output", feedback: "Exactly. The display sends information to you; the touch sensor sends your tap into the system. Processing connects those events." },
            ],
          },
        },
      ],
    },
  ],
};
