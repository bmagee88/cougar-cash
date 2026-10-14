import type { ArticleSummary, ScrollyChapter } from "../types";

export const simpleMachinesSummary: ArticleSummary = {
  slug: "simple-machines",
  title: "Simple Machines",
  subtitle: "How ramps and levers trade force for distance.",
  gradeBand: "Grade 8 Physical Science",
  readingTime: "8 min",
  status: "Prototype",
  accent: "#0f766e",
  path: "/articles/simple-machines",
};

export const simpleMachinesChapter: ScrollyChapter = {
  slug: "simple-machines",
  title: "Simple Machines",
  subtitle: "Trading Force for Distance",
  dek:
    "A scrollytelling chapter about why simple machines make work feel easier without making the work disappear.",
  gradeBand: "Grade 8 Physical Science",
  readingTime: "8 min",
  standards: ["Forces", "Energy Transfer", "Engineering Design"],
  scenes: [
    {
      id: "work-tradeoff",
      kind: "work-tradeoff",
      title: "The Trade",
      objective:
        "Students connect the everyday feeling of easier effort to the physics relationship between force, distance, and work.",
      accent: "#0f766e",
      visualElements: [
        "crate",
        "direct lift path",
        "longer machine path",
        "force arrow",
        "work meter",
      ],
      initialState:
        "A short path moves the crate with a tall force arrow and a full effort meter.",
      finalState:
        "The path stretches while the force arrow shrinks, keeping total work visible.",
      trigger:
        "Scroll progress scrubs the path length, force arrow, and equation emphasis.",
      interaction:
        "Students predict what changes when a machine makes a job feel easier.",
      defaultInteraction: {
        selectedPrediction: "",
      },
      steps: [
        {
          id: "work-intro",
          eyebrow: "Big Idea",
          title: "A machine changes the job, not the goal.",
          body: [
            "Imagine lifting a box onto a stage. You can lift it straight up, or you can push it along a ramp. Either way, the box ends at the same height.",
            "Simple machines are useful because they change how the effort feels. They can reduce the force you need, change the direction of that force, or spread the job over a longer distance.",
          ],
        },
        {
          id: "work-equation",
          eyebrow: "Model",
          title: "Less force usually means more distance.",
          body: [
            "Work depends on both force and distance. When a ramp makes the force smaller, the crate travels farther.",
            "That tradeoff is the heart of most simple machines: easier effort, longer motion.",
          ],
        },
        {
          id: "work-check",
          eyebrow: "Checkpoint",
          title: "Predict the tradeoff.",
          body: [
            "If a simple machine makes the force smaller, something else has to change. Choose the explanation that best matches the diagram.",
          ],
          checkpoint: "prediction",
        },
      ],
    },
    {
      id: "inclined-plane",
      kind: "inclined-plane",
      title: "The Ramp",
      objective:
        "Students explain why an inclined plane reduces effort by increasing the distance over which a load moves upward.",
      accent: "#2563eb",
      visualElements: [
        "adjustable ramp",
        "crate",
        "height marker",
        "distance label",
        "effort arrow",
      ],
      initialState:
        "The crate sits at the bottom of a short, steep ramp with a larger effort arrow.",
      finalState:
        "The ramp lengthens, the travel distance label grows, and the effort arrow shortens.",
      trigger:
        "The crate scrolls up the ramp while labels and force indicators update.",
      interaction:
        "Students adjust ramp length and observe the force-distance tradeoff.",
      defaultInteraction: {
        rampRun: 270,
      },
      steps: [
        {
          id: "ramp-direct",
          eyebrow: "Inclined Plane",
          title: "A ramp turns one hard lift into a longer push.",
          body: [
            "A ramp is an inclined plane: a flat surface set at an angle. It lets you raise a load gradually instead of lifting it straight up.",
            "The final height is the same, but the motion follows the slope.",
          ],
        },
        {
          id: "ramp-tradeoff",
          eyebrow: "Tradeoff",
          title: "Longer ramp, smaller force.",
          body: [
            "When the ramp is longer, each small push only raises the crate a little. That is why the needed force goes down.",
            "The cost is distance. The crate travels farther than it would in a direct lift.",
          ],
        },
        {
          id: "ramp-check",
          eyebrow: "Try It",
          title: "Change the ramp length.",
          body: [
            "Move the ramp control and watch the effort arrow. The diagram keeps the same height so the comparison stays fair.",
          ],
          checkpoint: "ramp-slider",
        },
      ],
    },
    {
      id: "lever",
      kind: "lever",
      title: "The Lever",
      objective:
        "Students use a lever diagram to reason about fulcrum position, lever arm length, and mechanical advantage.",
      accent: "#b45309",
      visualElements: [
        "lever board",
        "fulcrum",
        "load",
        "effort hand",
        "torque arcs",
      ],
      initialState:
        "The fulcrum is near the effort side, so the effort arm is short and the force arrow is large.",
      finalState:
        "The fulcrum moves near the load, making the effort arm longer and the force arrow smaller.",
      trigger:
        "Step changes and checkpoint choices move the fulcrum and update effort labels.",
      interaction:
        "Students choose fulcrum positions and compare the force needed to lift the same load.",
      defaultInteraction: {
        fulcrumPosition: "near-load",
      },
      steps: [
        {
          id: "lever-intro",
          eyebrow: "Lever",
          title: "A lever rotates around a fulcrum.",
          body: [
            "A lever is a rigid bar that pivots around a support point called the fulcrum.",
            "A seesaw, crowbar, bottle opener, and wheelbarrow all use this same idea in different layouts.",
          ],
        },
        {
          id: "lever-arm",
          eyebrow: "Mechanical Advantage",
          title: "The longer side gets an advantage.",
          body: [
            "When your effort is applied farther from the fulcrum, the same push can create a larger turning effect.",
            "That is why moving the fulcrum closer to the load can make a heavy object easier to lift.",
          ],
        },
        {
          id: "lever-check",
          eyebrow: "Try It",
          title: "Move the fulcrum.",
          body: [
            "Choose where the fulcrum belongs if you want the smallest effort force. The load stays the same, so only the lever setup changes.",
          ],
          checkpoint: "fulcrum-choice",
        },
      ],
    },
  ],
};
