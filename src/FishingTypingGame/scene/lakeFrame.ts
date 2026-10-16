/** Match the painted backdrop's cover crop so mist stays on the water on any screen. */
export const lakeShoreline = (location: string) => location === 'cove' ? .555 : .5;
export const lakeFrame = (location: string) => location === 'cove' ? {
  left: 'calc(50% - max(51cqw, 90.65cqh))', top: 'calc(50% - max(28.7cqw, 51cqh))',
  width: 'max(102cqw, 181.3cqh)', height: 'max(57.4cqw, 102cqh)',
} : {
  left: 'calc(50% - max(51cqw, 102cqh))', top: 'calc(50% - max(25.5cqw, 51cqh))',
  width: 'max(102cqw, 204cqh)', height: 'max(51cqw, 102cqh)',
};
