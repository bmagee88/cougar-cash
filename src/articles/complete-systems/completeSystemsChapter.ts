import type { ArticleSummary, ScrollyChapter } from "../types";

export const completeSystemsSummary: ArticleSummary = {
  slug: "thinking-in-complete-systems",
  title: "Thinking in Complete Systems",
  subtitle: "Computers, Devices, and Cables - Section 1.6. Follow the connections, define the purpose, and test the whole system.",
  gradeBand: "Middle School Computer Science",
  readingTime: "9 min",
  status: "Ready",
  sectionLabel: "Section 1.6",
  accent: "#9a365c",
  path: "/articles/thinking-in-complete-systems",
};

export const completeSystemsChapter: ScrollyChapter = {
  slug: completeSystemsSummary.slug,
  title: completeSystemsSummary.title,
  subtitle: "The parts matter. Their connections matter, too.",
  dek: "A microphone, a Chromebook, a saved file. A computing task succeeds when its parts work together. Follow the connections and see what changes when one part fails.",
  gradeBand: completeSystemsSummary.gradeBand,
  readingTime: completeSystemsSummary.readingTime,
  standards: ["Computing Systems", "User Needs", "System Models"],
  mobileSticky: true,
  sourceLabel: "Adapted from Computers, Devices, and Cables, section 1.6, pages 26-29. The interactive recording and weather-station simulations use simplified examples; the temperature readings are illustrative.",
  takeaways: [
    "A computing system includes interacting hardware, software, data, connections, and people. One working part cannot guarantee a successful task.",
    "Draw a boundary that fits your question. Producing a document and delivering it to a teacher require different views of the system.",
    "Evaluate equipment against the user's needs and conditions. Portability, performance, accessibility, and reliable storage matter in different ways for different tasks.",
    "Model the expected path before making changes. A graph that stops updating can have several causes; a purposeful test helps locate the affected part.",
  ],
  scenes: [
    {
      id: "systems-recording",
      kind: "recording-system",
      title: "A recording is a system",
      accent: "#007f86",
      objective: "Identify hardware, software, data, people, and connections in a classroom recording task.",
      caption: "A student supplies the narration and operates the app; hardware and software capture, hold, save, and play the audio.",
      visualElements: ["student", "USB microphone", "USB connection", "Chromebook", "operating system", "recording app", "audio data", "working memory", "saved file", "headphones"],
      initialState: "The microphone, Chromebook, and headphones are visible as separate parts.",
      finalState: "Scroll draws the audio connections and reveals the app, working memory, and saved file inside the system.",
      trigger: "Scroll scrubs the audio path and reveals its supporting parts; backward scrolling reverses the reveals.",
      interaction: "Change the USB connection, selected microphone, and save setting. Each combination models a fresh recording attempt.",
      defaultInteraction: { microphoneConnected: true, recordingSource: "usb", recordingSaved: true },
      steps: [
        {
          id: "recording-parts",
          eyebrow: "1.6.1 / Connected parts",
          title: "Look beyond the Chromebook.",
          body: [
            "You are recording narration for a class project. A USB microphone captures your voice, a Chromebook runs the recording app, and headphones let you hear the result. The useful system includes all of these parts and the connections between them.",
            "It also includes you: the person speaking, choosing the input, starting the recording, and saving the file. A system is a group of interacting parts that work together toward a result.",
          ],
        },
        {
          id: "recording-software",
          eyebrow: "The less visible parts",
          title: "Software and data belong in the picture.",
          body: [
            "The operating system helps the app use the microphone and headphones. The recording app follows instructions to capture audio data. Working memory holds data during the session; storage keeps the saved file for later.",
            "A good model includes these roles even when you cannot see them on the desk. A connected microphone alone does not tell the app which sound source to use.",
          ],
        },
        {
          id: "recording-test",
          eyebrow: "Change one part",
          title: "The same hardware can give a different result.",
          body: [
            "Try disconnecting the USB microphone while it is selected. Then reconnect it and choose the built-in microphone. Finally, turn saving off. Each change affects a different part of the task.",
            "The controls model a fresh recording attempt each time. They do not access your real microphone or create an audio file. Compare getting audio now with having a usable file later.",
          ],
          checkpoint: "recording-lab",
        },
      ],
    },
    {
      id: "systems-boundary",
      kind: "system-boundary",
      title: "Let the question set the boundary",
      accent: "#9a365c",
      objective: "Choose a system boundary for a task and connect equipment requirements to user needs.",
      caption: "Creating a document can use a local model. Delivering it to a teacher adds a network, a service, and the teacher's device.",
      visualElements: ["student device", "application", "local display", "network", "submission service", "teacher device", "expanding boundary", "user requirements"],
      initialState: "A boundary encloses the student's local document task; delivery components remain outside it.",
      finalState: "The boundary expands to include the connections and devices needed for submission.",
      trigger: "Scroll expands the model's boundary. Selecting a task pins the boundary to the student's choice; backward scrolling still reverses the connection trace.",
      interaction: "Compare creating and submitting a document, then choose a user to examine that person's equipment needs.",
      defaultInteraction: { userProfile: "student" },
      steps: [
        {
          id: "boundary-local",
          eyebrow: "1.6.2 / Purpose",
          title: "Begin with the question you are trying to answer.",
          body: [
            "How does a key press produce a letter on the screen? To answer that question, your model can focus on the keyboard, computer hardware, operating system, document app, and display.",
            "The boundary identifies the parts you are studying. It is a thinking tool, not a wall around a device. Include the parts and connections that matter to the question.",
          ],
        },
        {
          id: "boundary-submit",
          eyebrow: "A wider question",
          title: "Getting the document to a teacher is a bigger task.",
          body: [
            "Now ask how the student submits the document to a teacher. The local device is still part of the system, but your model also needs network equipment, a submission service running on servers, and the teacher's device.",
            "A letter can appear correctly on the student's screen even when delivery fails. Select each task below and compare what belongs inside its boundary.",
          ],
          checkpoint: "boundary-lab",
        },
        {
          id: "boundary-users",
          eyebrow: "1.6.3 / User needs",
          title: "Useful for whom, and under which conditions?",
          body: [
            "A student moving between classes may prioritize low weight and battery life. A photographer needs room for image files and an accurate display. A video editor may need more processing and graphics performance.",
            "A library checkout station needs durable equipment, barcode input, networking, and accessible controls. A scientist outdoors needs suitable sensors, rugged equipment, battery operation, and dependable storage. There is no single perfect computer for every user.",
          ],
          checkpoint: "user-needs",
        },
      ],
    },
    {
      id: "systems-weather",
      kind: "weather-system",
      title: "Model the school weather station",
      accent: "#4569ba",
      objective: "Trace a measurement through a complete system and distinguish failures in collection, saving, delivery, and display.",
      caption: "Illustrative readings arrive every five minutes. A single fault begins at 09:20; the first four readings were already saved.",
      visualElements: ["temperature sensor", "powered recorder", "collection software", "working memory", "saved measurements", "network", "library temperature graph"],
      initialState: "The sensor-to-recorder path is visible; the graph is not yet emphasized.",
      finalState: "Scroll traces collection, saving, and delivery, then reveals the library graph and a fault's effect.",
      trigger: "Motion scrubs the connection trace and fades in the graph; backward scrolling reverses the same values.",
      interaction: "Choose one failed component and compare captured, saved, and displayed readings. Restart the recorder to rebuild the graph from persistent storage.",
      defaultInteraction: { weatherFault: "none", weatherRestarted: false },
      steps: [
        {
          id: "weather-goal",
          eyebrow: "Worked example",
          title: "Start with the result, then trace backward.",
          body: [
            "The school wants to measure outdoor temperature every five minutes and show a graph in the library. Start with the result students need: a visible record of temperature over time.",
            "A sensor supplies measurements. A powered recorder runs software that interprets each measurement and associates it with a time. Working memory holds the current data; storage saves readings for later. A network carries updates to the library display.",
          ],
        },
        {
          id: "weather-evidence",
          eyebrow: "1.6.4 / Models before changes",
          title: "A frozen graph does not identify the cause.",
          body: [
            "A sensor problem, a stopped program, and a failed network can all stop the graph from updating. But they interrupt different parts of the expected path. A failed display can hide a graph even while measurements are being saved correctly.",
            "Technicians and engineers use diagrams and signal-flow models to understand these connections before making changes. Test one meaningful thing at a time so the result gives you evidence about that change.",
          ],
        },
        {
          id: "weather-experiment",
          eyebrow: "Investigate",
          title: "Break one connection in the model.",
          body: [
            "Choose one fault. In this example it begins at 09:20, after four measurements have been saved. Compare the recorder's data with the library graph: which parts still work?",
            "Try a saving failure. The live graph initially looks complete, but three readings exist only in working memory. Restart the recorder to rebuild the graph from saved measurements, and compare the result. These are illustrative temperatures, not live weather data.",
          ],
          checkpoint: "weather-lab",
        },
        {
          id: "weather-check",
          eyebrow: "Check your model",
          title: "Use the evidence to narrow the question.",
          body: [
            "Suppose the recorder has saved the newest readings, but the library graph shows only earlier ones. The input and collection stages have produced new data. Think about what happens between the recorder and the library.",
          ],
          checkpoint: "concept-check",
          question: {
            prompt: "Which part is a useful next place to test?",
            correctValue: "network",
            choices: [
              { value: "sensor", label: "Replace the temperature sensor", feedback: "The newest measurements were saved, so input reached the recorder. First investigate the path from the recorder to the library." },
              { value: "network", label: "Check delivery to the library", feedback: "Yes. Test the network and the library's receiving and display setup. Saved readings are evidence that collection worked; they do not prove delivery worked." },
              { value: "all", label: "Change several settings at once", feedback: "Changing several things together makes the result hard to explain. Use the model to choose one purposeful test." },
            ],
          },
        },
      ],
    },
  ],
};
