// Node positions belong to the visual plan; edges always come from approved content.
export function planDiagram(content, layout) {
  if (!['process', 'graph'].includes(content.type) || layout === 'process-linear') return null;
  const nodes = content.steps ?? content.nodes;
  const edges = content.edges;
  const width = 1088;
  const levels = new Map(nodes.map((node) => [node.id, 0]));
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) incoming.set(edge.to, incoming.get(edge.to) + 1);
  const queue = nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id);
  let processed = 0;
  while (queue.length) {
    const current = queue.shift();
    processed += 1;
    for (const edge of edges.filter((item) => item.from === current)) {
      levels.set(edge.to, Math.max(levels.get(edge.to), levels.get(current) + 1));
      incoming.set(edge.to, incoming.get(edge.to) - 1);
      if (incoming.get(edge.to) === 0) queue.push(edge.to);
    }
  }
  if (processed !== nodes.length || layout === 'process-loop') return {
    width, height: 350, node_width: 220, flow: 'loop',
    nodes: nodes.map((node, index) => ({ id: node.id, x: width / 2 + Math.cos(-Math.PI / 2 + index * 2 * Math.PI / nodes.length) * 350, y: 175 + Math.sin(-Math.PI / 2 + index * 2 * Math.PI / nodes.length) * 108 })),
  };
  const groups = new Map();
  for (const node of nodes) {
    const level = levels.get(node.id);
    if (!groups.has(level)) groups.set(level, []);
    groups.get(level).push(node);
  }
  const maximum = Math.max(...levels.values(), 1);
  // The magazine-only vertical rewrite flattened branches and scattered related nodes in the user-rejected s06.
  // On a wide stage, preserve the left-to-right DAG reading path across themes; actual cycles keep their loop above.
  return {
    width, height: 350, node_width: 220, flow: 'across',
    nodes: nodes.map((node) => {
      const level = levels.get(node.id);
      const peers = groups.get(level);
      return { id: node.id, x: 120 + level * (width - 240) / maximum, y: (peers.indexOf(node) + .5) * 350 / peers.length };
    }),
  };
}

// Fixed half-widths placed arrows under step numbers and missed cards after font wrapping.
// Measure actual anchors and card boundaries on each visible page, including after a resize.
export function drawConnections() {
  const slide = document.querySelector('[data-storyweave-slide].active');
  for (const svg of slide?.querySelectorAll('.relationship-connections') ?? []) {
    const bounds = svg.getBoundingClientRect();
    if (!bounds.width || !bounds.height) continue;
    // SVG meet alignment can letterbox a 1088-unit frame inside the page gutter; use its actual transform.
    const inverse = svg.getScreenCTM().inverse();
    const nodes = new Map([...svg.parentElement.querySelectorAll('[data-node-id]')].map((node) => [node.dataset.nodeId, node]));
    const local = (element) => {
      const rect = element.getBoundingClientRect();
      const first = new DOMPoint(rect.left, rect.top).matrixTransform(inverse);
      const last = new DOMPoint(rect.right, rect.bottom).matrixTransform(inverse);
      return { left: first.x, right: last.x, top: first.y, bottom: last.y, x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 };
    };
    for (const edge of svg.querySelectorAll('[data-edge-from][data-edge-to]')) {
      const fromNode = nodes.get(edge.dataset.edgeFrom);
      const toNode = nodes.get(edge.dataset.edgeTo);
      if (!fromNode || !toNode) continue;
      const from = local(fromNode.querySelector('.step-anchor') ?? fromNode);
      const to = local(toNode.querySelector('.step-anchor') ?? toNode);
      const horizontal = svg.dataset.flow === 'rail' || svg.dataset.flow === 'across' || (svg.dataset.flow !== 'down' && Math.abs(to.x - from.x) >= Math.abs(to.y - from.y));
      const sign = horizontal ? Math.sign(to.x - from.x) || 1 : Math.sign(to.y - from.y) || 1;
      const x1 = horizontal ? (sign > 0 ? from.right + 8 : from.left - 8) : from.x;
      const x2 = horizontal ? (sign > 0 ? to.left - 10 : to.right + 10) : to.x;
      const y1 = horizontal ? from.y : sign > 0 ? from.bottom + 8 : from.top - 8;
      const y2 = horizontal ? to.y : sign > 0 ? to.top - 10 : to.bottom + 10;
      const path = edge.querySelector('path');
      path.setAttribute('d', horizontal ? `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}` : `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`);
      const label = edge.querySelector('text');
      if (label) { const mid = path.getPointAtLength(path.getTotalLength() / 2); label.setAttribute('x', mid.x); label.setAttribute('y', mid.y - 14); }
    }
  }
}
