export type TreePoint = { x: number; y: number; z: number };
export interface DistantTree { id: string; label: string; bottom: TreePoint; top: TreePoint; crownWidth: number }
// x/y are normalized coordinates in the painted landscape, before its cover crop.
// z is relative scene distance: larger means farther away. Only the ten nearest
// recognizable landscape trees are mapped; foreground willow/reed layers are not.
type TreeRow = [string, number, number, number, number, number];
const map = (location: string, rows: TreeRow[]): DistantTree[] => rows.map(([label, x, topY, bottomY, z, crownWidth], index) => ({
  id: `${location}-tree-${index + 1}`, label, top: { x, y: topY, z }, bottom: { x, y: bottomY, z }, crownWidth,
}));

export const LOCATION_TREES: Record<'dock' | 'cove', DistantTree[]> = {
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
};

export const treesForLocation = (location: string) => LOCATION_TREES[location === 'cove' ? 'cove' : 'dock'];
export function treePerch(tree: DistantTree, random: () => number): TreePoint {
  return { x: tree.top.x + (random() - .5) * tree.crownWidth * .32,
    y: tree.top.y + (tree.bottom.y - tree.top.y) * (.10 + random() * .20), z: tree.top.z };
}

export function birdPlane(location: string) {
  const cove = location === 'cove';
  return { '--bird-plane-w': cove ? 'max(102cqw,181.3cqh)' : 'max(102cqw,204cqh)',
    '--bird-plane-h': cove ? 'max(57.4cqw,102cqh)' : 'max(51cqw,102cqh)' };
}
