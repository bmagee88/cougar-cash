const WYRM_ACTIONS={
  wyrmBite:{row:1,duration:1000,impact:600,label:'Bite'},
  slam:{row:2,duration:1500,impact:950,label:'Slam'},
  overrun:{row:3,duration:8000,impact:1500,label:'Overrun'},
  burrow:{row:4,duration:1600,impact:1200,label:'Burrow'},
  consume:{row:6,duration:2600,impact:1500,label:'Consume'},
  spitOut:{row:7,duration:1800,impact:1000,label:'Spit Out'},
};
const CONSUME_MS=30000,CONSUME_TICK_MS=3000;
module.exports={WYRM_ACTIONS,CONSUME_MS,CONSUME_TICK_MS};
