/**
 * Lays out source files as a city around the viewer. Each folder becomes a
 * district, a square-ish grid of one building per file, and districts sit on
 * rings around an empty plaza in the middle, turned to face it. Distances
 * are in meters; angle 0 is straight ahead (-z).
 */

export const LOT = 0.45;
export const GAP = 0.12;
export const STREET = 0.7;
export const PLAZA_RADIUS = 2.2;
export const FLOOR_Y = -1.6;

const PITCH = LOT + GAP;

export function heightForLines(lines) {
  return Math.min(4, 0.15 + lines / 250);
}

// Golden-angle hues, so neighboring districts get clearly different colors
export function districtColor(index) {
  return `hsl(${(index * 137.5) % 360}, 70%, 60%)`;
}

function groupByFolder(files) {
  const groups = new Map();
  files.forEach(file => {
    if (!groups.has(file.folder)) {
      groups.set(file.folder, []);
    }
    groups.get(file.folder).push(file);
  });
  return Array.from(groups, ([folder, members]) => {
    // Short buildings in front, tall ones behind
    members.sort((a, b) => a.lines - b.lines || (a.path < b.path ? -1 : 1));
    const cols = Math.ceil(Math.sqrt(members.length));
    const rows = Math.ceil(members.length / cols);
    const width = cols * PITCH - GAP;
    const depth = rows * PITCH - GAP;
    return {
      folder,
      members,
      cols,
      rows,
      radius: Math.hypot(width, depth) / 2,
      lines: members.reduce((sum, file) => sum + file.lines, 0),
    };
  });
}

// Splits districts (largest first) into rings. Every district in a ring is
// spaced as if it were as big as the ring's first, and the next ring starts a
// street beyond the edge of this one, so no two districts can overlap.
function arrangeRings(districts) {
  const rings = [];
  let inner = PLAZA_RADIUS;
  let i = 0;
  while (i < districts.length) {
    const maxRadius = districts[i].radius;
    const ringRadius = inner + maxRadius;
    const spacing = 2 * Math.asin((2 * maxRadius + STREET) / (2 * ringRadius));
    const fit = Math.max(1, Math.floor((2 * Math.PI) / spacing));
    rings.push({radius: ringRadius, members: districts.slice(i, i + fit)});
    i += fit;
    inner = ringRadius + maxRadius + STREET;
  }
  return rings;
}

export function layoutCity(files) {
  const districts = groupByFolder(files).sort(
    (a, b) => b.radius - a.radius || b.lines - a.lines || (a.folder < b.folder ? -1 : 1),
  );

  const placedDistricts = [];
  const buildings = [];
  arrangeRings(districts).forEach(ring => {
    // Spread each ring's districts evenly all the way around, half a step
    // off, so a street runs straight ahead of the viewer
    const step = (2 * Math.PI) / ring.members.length;
    ring.members.forEach((district, k) => {
      const angle = (k + 0.5) * step;
      const radial = [Math.sin(angle), -Math.cos(angle)];
      const tangent = [Math.cos(angle), Math.sin(angle)];
      const x = radial[0] * ring.radius;
      const z = radial[1] * ring.radius;
      const index = placedDistricts.length;
      placedDistricts.push({
        folder: district.folder,
        x,
        z,
        angle,
        radius: district.radius,
        files: district.members.length,
        lines: district.lines,
      });

      district.members.forEach((file, n) => {
        const u = ((n % district.cols) - (district.cols - 1) / 2) * PITCH;
        // Row 0 is the row nearest the plaza
        const v = (Math.floor(n / district.cols) - (district.rows - 1) / 2) * PITCH;
        buildings.push({
          path: file.path,
          folder: file.folder,
          lines: file.lines,
          x: x + tangent[0] * u + radial[0] * v,
          z: z + tangent[1] * u + radial[1] * v,
          angle,
          height: heightForLines(file.lines),
          district: index,
        });
      });
    });
  });

  return {buildings, districts: placedDistricts};
}
