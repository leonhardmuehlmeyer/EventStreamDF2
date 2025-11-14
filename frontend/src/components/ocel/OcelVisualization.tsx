import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Checkbox } from '~/components/ui/checkbox';
import { useGetOcel } from '~/services/queries';

type NodeDatum = {
    id: string;
    label: string;
    type: 'event' | 'object';
    x?: number;
    y?: number;
    fx?: number | null;
    fy?: number | null;
};

type EdgeDatum = {
    id: string;
    source: NodeDatum;
    target: NodeDatum;
    label: string;
};

const MAX_CHUNK = 5;
const NODE_RADIUS = 20;
const NODE_GAP = 50;

interface OcelVisualizationD3Props {
    fileId: string;
}

const OcelVisualization: React.FC<OcelVisualizationD3Props> = ({ fileId }) => {
    const { data, isLoading, error } = useGetOcel(fileId);

    const svgRef = useRef<SVGSVGElement | null>(null);
    const eventsChartRef = useRef<SVGSVGElement | null>(null);
    const objectsChartRef = useRef<SVGSVGElement | null>(null);

    const [chunk, setChunk] = useState(1);
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: NodeDatum } | null>(null);

    const nodesRef = useRef<NodeDatum[]>([]);
    const edgesRef = useRef<EdgeDatum[]>([]);
    const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
    const zoomTransformRef = useRef<d3.ZoomTransform | null>(null);

    // Utility: Get all connected node IDs using BFS
    const getConnectedNodes = (startId: string): Set<string> => {
        const visited = new Set<string>();
        const queue = [startId];
        visited.add(startId);

        while (queue.length > 0) {
            const current = queue.shift()!;
            const connectedEdges = edgesRef.current.filter((e) => e.source.id === current || e.target.id === current);
            connectedEdges.forEach((edge) => {
                const neighbor = edge.source.id === current ? edge.target.id : edge.source.id;
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push(neighbor);
                }
            });
        }
        return visited;
    };

    useEffect(() => {
        if (!data || !svgRef.current) return;

        const svg = d3.select(svgRef.current);
        const width = svgRef.current.clientWidth;
        const height = svgRef.current.clientHeight;

        svg.selectAll('*').remove();
        const g = svg.append('g');

        // Zoom support
        const zoom = d3.zoom<SVGSVGElement, unknown>().on('zoom', (event) => {
            g.attr('transform', event.transform.toString());
            zoomTransformRef.current = event.transform;
        });
        svg.call(zoom as any);
        if (zoomTransformRef.current) svg.call(zoom.transform as any, zoomTransformRef.current);

        const events = data.events || [];
        const objects = data.objects || [];

        const filteredEvents = events.filter(
            (evt: any) => selectedTypes.length === 0 || selectedTypes.includes(evt.type)
        );
        const chunkedEvents = filteredEvents.slice(0, chunk * MAX_CHUNK);

        // Create event nodes
        const eventNodes: NodeDatum[] = chunkedEvents.map((evt: any) => ({
            id: evt.id.toString(),
            label: evt.type || evt.activity || 'Event',
            type: 'event',
        }));

        // Create object nodes
        const objectIds = new Set<string>();
        chunkedEvents.forEach((evt: any) =>
            (evt.relationships || []).forEach((rel: any) => objectIds.add(rel.objectId))
        );
        const objectNodes: NodeDatum[] = Array.from(objectIds).map((objId) => ({
            id: objId.toString(),
            label: objects[objId]?.type || objId,
            type: 'object',
        }));

        nodesRef.current = [...eventNodes, ...objectNodes];

        // Create edges
        edgesRef.current = chunkedEvents.flatMap((evt: any) =>
            (evt.relationships || []).map((rel: any, j: number) => ({
                id: `${evt.id}-${rel.objectId}-${j}`,
                source: nodesRef.current.find((n) => n.id === evt.id.toString())!,
                target: nodesRef.current.find((n) => n.id === rel.objectId.toString())!,
                label: rel.qualifier || '',
            }))
        );

        // Position nodes
        nodesRef.current.forEach((n) => {
            const saved = positionsRef.current.get(n.id);
            if (saved) {
                n.x = saved.x;
                n.y = saved.y;
            } else {
                let newX, newY, overlapping;
                do {
                    newX = width / 2 + Math.random() * 400 - 200;
                    newY = height / 2 + Math.random() * 400 - 200;
                    overlapping = Array.from(positionsRef.current.values()).some(
                        (p) => Math.hypot(p.x - newX, p.y - newY) < NODE_GAP
                    );
                } while (overlapping);
                n.x = newX;
                n.y = newY;
                positionsRef.current.set(n.id, { x: n.x, y: n.y });
            }
        });

        // Draw edges
        g.selectAll('line')
            .data(edgesRef.current)
            .enter()
            .append('line')
            .attr('stroke', (d) =>
                collapsedNodes.has(d.source.id) || collapsedNodes.has(d.target.id) ? '#b0b0b0' : 'black'
            )
            .attr('stroke-width', 1.8)
            .attr('x1', (d) => positionsRef.current.get(d.source.id)?.x || 0)
            .attr('y1', (d) => positionsRef.current.get(d.source.id)?.y || 0)
            .attr('x2', (d) => positionsRef.current.get(d.target.id)?.x || 0)
            .attr('y2', (d) => positionsRef.current.get(d.target.id)?.y || 0);

        // Draw nodes
        const nodeGroup = g
            .selectAll<SVGGElement, NodeDatum>('g.node')
            .data(nodesRef.current)
            .enter()
            .append('g')
            .attr('class', 'node')
            .attr('transform', (d) => `translate(${d.x},${d.y})`)
            .call(d3.drag<SVGGElement, NodeDatum>().on('start', dragstarted).on('drag', dragged).on('end', dragended));

        nodeGroup
            .append('circle')
            .attr('r', NODE_RADIUS)
            .attr('fill', (d) => {
                if (collapsedNodes.has(d.id)) return 'lightgray';
                return d.type === 'event' ? 'orange' : 'steelblue';
            })
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5)
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
                event.stopPropagation();
                const [x, y] = d3.pointer(event, svgRef.current);
                setContextMenu({ x, y, node: d });
            });

        // Labels
        nodeGroup.each(function (d) {
            const group = d3.select(this);
            const words = d.label.split(/[\s_]+|(?=[A-Z])/g);
            const lineHeight = 8;
            const maxLines = 3;
            const wrapped: string[] = [];
            let line = '';
            words.forEach((w) => {
                if ((line + ' ' + w).length < 10) line += ' ' + w;
                else {
                    wrapped.push(line.trim());
                    line = w;
                }
            });
            wrapped.push(line.trim());
            const finalLines = wrapped.length > maxLines ? [...wrapped.slice(0, maxLines - 1), '...'] : wrapped;

            const text = group
                .append('text')
                .attr('text-anchor', 'middle')
                .attr('alignment-baseline', 'middle')
                .attr('font-size', 8)
                .attr('font-weight', '600')
                .attr('fill', 'white')
                .attr('pointer-events', 'none');

            const offset = (finalLines.length - 1) * -lineHeight * 0.5;
            text.selectAll('tspan')
                .data(finalLines)
                .enter()
                .append('tspan')
                .attr('x', 0)
                .attr('y', (_, i) => offset + i * lineHeight)
                .text((t) => t);
        });

        // Drag behavior
        function dragstarted(event: any, d: any) {
            d.fx = d.x;
            d.fy = d.y;
        }
        function dragged(event: any, d: any) {
            d.x = event.x;
            d.y = event.y;
            positionsRef.current.set(d.id, { x: d.x, y: d.y });
            d3.select(this).attr('transform', `translate(${d.x},${d.y})`);
            g.selectAll('line')
                .attr('x1', (d: any) => positionsRef.current.get(d.source.id)?.x || 0)
                .attr('y1', (d: any) => positionsRef.current.get(d.source.id)?.y || 0)
                .attr('x2', (d: any) => positionsRef.current.get(d.target.id)?.x || 0)
                .attr('y2', (d: any) => positionsRef.current.get(d.target.id)?.y || 0);
        }
        function dragended(event: any, d: any) {
            d.fx = null;
            d.fy = null;
            positionsRef.current.set(d.id, { x: d.x!, y: d.y! });
        }
    }, [data, chunk, selectedTypes, collapsedNodes]);

    const getNodeEdges = (nodeId: string) => {
        return edgesRef.current.filter((e) => e.source.id === nodeId || e.target.id === nodeId);
    };

    // Helper: get connected nodes (only immediate neighbors)
    const getImmediateNeighbors = (nodeId: string): NodeDatum[] => {
        return edgesRef.current
            .filter((e) => e.source.id === nodeId || e.target.id === nodeId)
            .map((e) => (e.source.id === nodeId ? e.target : e.source));
    };

   
    const handleCollapse = (nodeId: string) => {
        const node = nodesRef.current.find((n) => n.id === nodeId);
        if (!node) return;

        const newCollapsed = new Set(collapsedNodes);

        if (node.type === 'event') {
            // Collapse the event node
            newCollapsed.add(node.id);

            // Collapse connected object nodes only if they have no other event connections
            const connectedObjects = getImmediateNeighbors(node.id).filter((n) => n.type === 'object');

            connectedObjects.forEach((obj) => {
                const objectEdges = getNodeEdges(obj.id);
                const connectedEvents = objectEdges
                    .map((e) => (e.source.id === obj.id ? e.target : e.source))
                    .filter((n) => n.type === 'event' && n.id !== node.id);

                // If object node has no other event connections, collapse it too
                if (connectedEvents.length === 0) {
                    newCollapsed.add(obj.id);
                }
            });
        } else if (node.type === 'object') {
            // Collapse the object node only if its connected event nodes
            // have connections to other nodes (so collapsing won’t isolate them)
            const connectedEvents = getImmediateNeighbors(node.id).filter((n) => n.type === 'event');

            let canCollapse = true;
            connectedEvents.forEach((evt) => {
                const evtEdges = getNodeEdges(evt.id);
                const otherConnections = evtEdges.filter((e) => e.source.id !== node.id && e.target.id !== node.id);

                // If the event has no other connections, do not collapse object
                if (otherConnections.length === 0) {
                    canCollapse = false;
                }
            });

            if (canCollapse) newCollapsed.add(node.id);
        }

        setCollapsedNodes(newCollapsed);
        setContextMenu(null);
    };

    const handleExpand = (nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node) return;

    setCollapsedNodes(prev => {
      const newSet = new Set(prev);

      // Remove the node itself
      newSet.delete(nodeId);

      // Remove immediate neighbors only if they are collapsed
      getImmediateNeighbors(nodeId).forEach(n => {
        if (newSet.has(n.id)) newSet.delete(n.id);
      });

      return newSet;
    });

    setContextMenu(null);
  };

  const toggleType = (type: string) => {
    setChunk(5);
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

   
    useEffect(() => {
        if (!data) return;

        const tooltip = d3
            .select('body')
            .append('div')
            .attr('class', 'd3-tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(0,0,0,0.7)')
            .style('color', 'white')
            .style('padding', '6px 10px')
            .style('border-radius', '6px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('opacity', 0);

        const createHistogram = (ref: SVGSVGElement, dataArr: [string, number][], fillColor: string) => {
            const svg = d3.select(ref);
            svg.selectAll('*').remove();
            const width = svg.node()?.clientWidth || 250;
            const height = svg.node()?.clientHeight || 200;
            const margin = { top: 20, right: 20, bottom: 50, left: 40 };
            const x = d3
                .scaleBand()
                .domain(dataArr.map(([k]) => k))
                .range([margin.left, width - margin.right])
                .padding(0.2);
            const y = d3
                .scaleLinear()
                .domain([0, d3.max(dataArr, ([, v]) => v)!])
                .nice()
                .range([height - margin.bottom, margin.top]);

            svg.append('g')
                .selectAll('rect')
                .data(dataArr)
                .enter()
                .append('rect')
                .attr('x', ([k]) => x(k)!)
                .attr('y', ([, v]) => y(v))
                .attr('width', x.bandwidth())
                .attr('height', ([, v]) => y(0) - y(v))
                .attr('fill', fillColor)
                .on('mouseover', (event, [, v]) => {
                    tooltip.style('opacity', 1).html(`<strong>Count:</strong> ${v}`);
                })
                .on('mousemove', (event) => {
                    tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 20 + 'px');
                })
                .on('mouseout', () => {
                    tooltip.style('opacity', 0);
                });

            svg.append('g')
                .attr('transform', `translate(0,${height - margin.bottom})`)
                .call(d3.axisBottom(x))
                .selectAll('text')
                .attr('transform', 'rotate(-35)')
                .style('text-anchor', 'end')
                .attr('font-size', 9);

            svg.append('g').attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y));
        };

        const activityCounts = d3.rollups(
            data.events || [],
            (v) => v.length,
            (d) => d.type || d.activity || 'Unknown'
        );
        const typeCounts = d3.rollups(
            Object.values(data.objects || {}),
            (v: any) => v.length,
            (d: any) => d.type || 'Unknown'
        );

        if (eventsChartRef.current) createHistogram(eventsChartRef.current, activityCounts, 'orange');
        if (objectsChartRef.current) createHistogram(objectsChartRef.current, typeCounts, 'steelblue');

        return () => tooltip.remove();
    }, [data]);

    if (!fileId) return <p>No File selected</p>;
    if (isLoading) return <p>Loading...</p>;
    if (error) return <p>Error loading OCEL data</p>;
    if (!data) return <p>No data available</p>;

    return (
        <div className="flex flex-col h-screen bg-gray-50 relative">
            {contextMenu && (
                <div
                    className="absolute bg-white border border-gray-300 shadow-lg rounded-md text-sm z-50"
                    style={{ left: contextMenu.x + 20, top: contextMenu.y }}
                >
                    <button
                        className="block w-full text-left px-3 py-1 hover:bg-gray-100"
                        onClick={() => handleCollapse(contextMenu.node.id)}
                    >
                        Collapse Connected
                    </button>
                    <button
                        className="block w-full text-left px-3 py-1 hover:bg-gray-100"
                        onClick={() => handleExpand(contextMenu.node.id)}
                    >
                        Expand Connected
                    </button>
                </div>
            )}

           
            <div className="border-b border-gray-200 p-4 bg-white shadow-sm flex flex-wrap gap-3">
                <h2 className="font-bold text-gray-700">Filter by Event Type:</h2>
                {data.eventTypes?.map((type: any, idx: number) => {
                    const typeName = typeof type === 'string' ? type : type.name;
                    return (
                        <div key={idx} className="flex items-center space-x-2">
                            <Checkbox
                                id={`type-${idx}`}
                                checked={selectedTypes.includes(typeName)}
                                onCheckedChange={() => toggleType(typeName)}
                            />
                            <label htmlFor={`type-${idx}`} className="text-sm font-medium leading-none">
                                {typeName}
                            </label>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-4 gap-4 p-4 overflow-auto">
                <div className="col-span-3 bg-white rounded-xl shadow p-3 relative">
                    <h3 className="font-semibold mb-2 text-center text-gray-700">Event–Object Relationship Graph</h3>
                    <svg ref={svgRef} className="w-full h-[600px] border rounded-lg bg-gray-50" />
                    {chunk * MAX_CHUNK < (data.events?.length || 0) && (
                        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                            <button
                                onClick={() => setChunk((prev) => prev + 1)}
                                className="px-4 py-2 bg-blue-500 text-white rounded shadow hover:bg-blue-600"
                            >
                                Load More Events ({chunk * MAX_CHUNK}/{data.events.length})
                            </button>
                        </div>
                    )}
                </div>

                <div className="col-span-1 flex flex-col gap-4">
                    <div className="bg-white rounded-xl shadow p-3">
                        <h3 className="font-semibold mb-2 text-center text-gray-700">Events per Activity</h3>
                        <svg ref={eventsChartRef} className="w-full h-[250px]" />
                    </div>
                    <div className="bg-white rounded-xl shadow p-3">
                        <h3 className="font-semibold mb-2 text-center text-gray-700">Objects per Type</h3>
                        <svg ref={objectsChartRef} className="w-full h-[250px]" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OcelVisualization;

