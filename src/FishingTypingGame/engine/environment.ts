export const ENVIRONMENT_RENDER_OPTIONS = [
  {value:'natural' as const,label:'Natural (smooth)'},
  {value:1000 as const,label:'Every 1 second'},
  {value:2000 as const,label:'Every 2 seconds'},
  {value:5000 as const,label:'Every 5 seconds'},
  {value:10000 as const,label:'Every 10 seconds'},
];
export type EnvironmentRender = typeof ENVIRONMENT_RENDER_OPTIONS[number]['value'];
export function readEnvironmentRender(value:unknown):EnvironmentRender {
  return ENVIRONMENT_RENDER_OPTIONS.some(option=>option.value===value)?value as EnvironmentRender:'natural';
}
export const environmentInterval=(value:EnvironmentRender)=>value==='natural'?0:value;
