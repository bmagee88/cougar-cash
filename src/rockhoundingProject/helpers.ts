/**
 * Accepts an SVG string that contains ONE <path> element (optionally wrapped in
 * transforms) and rewrites <svg width>, <svg height>, and <svg viewBox>
 * so they match that path’s bounding box *after* all transforms are applied.
 */
export async function fitSvgToPath(svg: string): Promise<string> {
  // Parse the SVG in a detached document so we can use getBBox()
  const dom = new DOMParser().parseFromString(svg, "image/svg+xml");
  const svgEl = dom.documentElement;
  const pathEl = svgEl.querySelector("path");

  if (!pathEl) throw new Error("SVG does not contain a <path>");

  // We must put it in the live DOM for getBBox to work:
  const temp = document.createElement("div");
  temp.style.position = "absolute";
  temp.style.visibility = "hidden";
  temp.appendChild(svgEl);
  document.body.appendChild(temp);

  const bbox = pathEl.getBBox(); // AFTER transforms

  // Clean-up the temporary DOM node
  temp.remove();

  // Update width/height and viewBox
  svgEl.setAttribute("width", `${bbox.width}`);
  svgEl.setAttribute("height", `${bbox.height}`);
  svgEl.setAttribute("viewBox", `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);

  return new XMLSerializer().serializeToString(svgEl);
}
