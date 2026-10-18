export type TreePoint = { x: number; y: number; z: number };
export type TreeFrame = 'landscape' | 'foreground' | 'viewer';
export interface DistantTree { id: string; label: string; bottom: TreePoint; top: TreePoint; crownWidth: number; frame?: TreeFrame; kind?:'tree'|'bush'; hidden?:boolean }
// x/y are normalized coordinates in the painted landscape, before its cover crop.
// z is relative scene distance: larger means farther away. Only the ten nearest
// recognizable landscape trees are mapped below. Foreground trees also take
// part in bird routes, with coordinates in their separate sitting frame.
type TreeRow = [string, number, number, number, number, number];
const map = (location: string, rows: TreeRow[]): DistantTree[] => rows.map(([label, x, topY, bottomY, z, crownWidth], index) => ({
  id: `${location}-tree-${index + 1}`, label, top: { x, y: topY, z:z/4.2 }, bottom: { x, y: bottomY, z:z/4.2 }, crownWidth, frame: 'landscape',
}));

export const LOCATION_TREES: Record<'dock' | 'cove' | 'birch', DistantTree[]> = {
  dock: map('dock', [
    ['Left shore crown', .037, .315, .476, 2.8, .028],
    ['Left broad crown', .087, .340, .474, 3.0, .028],
    ['Left red crown', .183, .365, .479, 2.7, .027],
    ['Left middle crown', .245, .370, .472, 3.2, .025],
    ['Middle left crown', .367, .409, .481, 3.6, .021],
    ['Middle shore crown', .447, .382, .479, 3.4, .024],
    ['Middle right crown', .515, .400, .480, 3.8, .024],
    ['Right yellow crown', .632, .415, .480, 3.7, .023],
    ['Right red crown', .680, .397, .477, 3.3, .027],
    ['Right shore crown', .950, .390, .474, 2.9, .026],
  ]),
  cove: map('cove', [
    ['Left edge pine', .019, .234, .504, 1.9, .024],
    ['Left broad crown', .072, .242, .515, 1.7, .029],
    ['Left tall pine', .104, .219, .503, 2.1, .021],
    ['Left bank pine', .129, .244, .500, 2.2, .020],
    ['Left inner pine', .179, .258, .527, 2.5, .025],
    ['Left inlet pine', .253, .325, .528, 2.7, .019],
    ['Right bank pine', .826, .240, .480, 2.2, .028],
    ['Right tall pine', .872, .142, .466, 1.8, .026],
    ['Right edge tall pine', .937, .078, .459, 1.4, .026],
    ['Right edge pine', .981, .108, .443, 1.5, .023],
  ]),
  birch: map('birch', [
    ['Left tall pine', .079, .307, .500, 2.2, .038],
    ['Left shore pine', .145, .327, .499, 2.0, .032],
    ['Left golden birch', .193, .365, .501, 2.4, .035],
    ['Left granite pine', .253, .304, .499, 2.1, .043],
    ['Left inner pine', .307, .344, .504, 2.6, .030],
    ['Right inner pine', .727, .351, .502, 2.8, .036],
    ['Right golden birch', .757, .384, .502, 2.6, .032],
    ['Right tall pine', .825, .334, .501, 2.2, .039],
    ['Right shore pine', .884, .355, .500, 2.4, .032],
    ['Right edge pine', .989, .314, .499, 2.1, .037],
  ]),
};

export const FOREGROUND_TREES: DistantTree[] = [
  { id: 'birch-foreground-left', label: 'Foreground slender white birch', bottom: { x: .015, y: .565, z: .043 }, top: { x: .047, y: 0, z: .043 }, crownWidth: .16, frame: 'foreground' },
  { id: 'birch-foreground-right', label: 'Foreground leaning white birch', bottom: { x: .036, y: .655, z: .033 }, top: { x: .105, y: 0, z: .033 }, crownWidth: .23, frame: 'foreground' },
];
const COVE_FOREGROUND_TREES: DistantTree[] = [
  { id: 'cove-foreground-willow', label: 'Foreground willow trunk', bottom: { x: .04, y: .56, z: .043 }, top: { x: .075, y: 0, z: .043 }, crownWidth: .18, frame: 'foreground' },
];
// These existing painted shrubs sit behind the close trunks (larger positive z).
const LOCATION_BUSHES:Record<'cove'|'birch',DistantTree[]>={
  cove:[{id:'cove-bush',label:'Bush behind the foreground willow',kind:'bush',frame:'foreground',top:{x:.16,y:.46,z:.11},bottom:{x:.16,y:.56,z:.11},crownWidth:.12}],
  birch:[{id:'birch-bush',label:'Bush behind the foreground birches',kind:'bush',frame:'foreground',top:{x:.15,y:.49,z:.10},bottom:{x:.15,y:.61,z:.10},crownWidth:.10}],
};
// Viewer-frame anchors stay outside every responsive crop. Negative z means
// behind the camera; they are destinations/directions, never visible scenery.
export const behindViewerTreesForLocation=(location:string):DistantTree[]=>[
  {id:`${location}-behind-viewer-left`,label:'Hidden tree behind viewer, left',kind:'tree',hidden:true,frame:'viewer',top:{x:-.24,y:.24,z:-.14},bottom:{x:-.24,y:.70,z:-.14},crownWidth:.12},
  {id:`${location}-behind-viewer-right`,label:'Hidden tree behind viewer, right',kind:'tree',hidden:true,frame:'viewer',top:{x:1.24,y:.24,z:-.14},bottom:{x:1.24,y:.70,z:-.14},crownWidth:.12},
];
export const bushesForLocation=(location:string)=>location==='cove'?LOCATION_BUSHES.cove:location==='birch'?LOCATION_BUSHES.birch:[];
export const treesForLocation = (location: string) => LOCATION_TREES[location === 'birch' ? 'birch' : location === 'cove' ? 'cove' : 'dock'];
export const foregroundTreesForLocation = (location: string) => location === 'birch' ? FOREGROUND_TREES : location === 'cove' ? COVE_FOREGROUND_TREES : [];
export const mappedTreesForLocation = (location: string) => [...treesForLocation(location), ...foregroundTreesForLocation(location), ...bushesForLocation(location), ...behindViewerTreesForLocation(location)];
export function treePerch(tree: DistantTree, random: () => number): TreePoint {
  const height = .10 + random() * .20;
  return { x: tree.top.x + (tree.bottom.x - tree.top.x) * height + (random() - .5) * tree.crownWidth * .32,
    y: tree.top.y + (tree.bottom.y - tree.top.y) * height, z: tree.top.z };
}

export function birdPlane(location: string) {
  const cove = location === 'cove';
  return { '--bird-plane-w': cove ? 'max(102cqw,181.3cqh)' : 'max(102cqw,204cqh)',
    '--bird-plane-h': cove ? 'max(57.4cqw,102cqh)' : 'max(51cqw,102cqh)',
    '--bird-view-left':'calc((var(--bird-plane-w) - 100cqw) / 2)', '--bird-view-top':'calc((var(--bird-plane-h) - 100cqh) / 2)' };
}
