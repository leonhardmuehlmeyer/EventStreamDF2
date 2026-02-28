import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { MousePointer } from 'lucide-react';
import LegendRect from '~/components/ocpt/ui/LegendRect';
import { useExploreFlowStore } from '~/stores/exploreStore';
import { useGetLogGraphs } from '~/services/queries';
import { getDeterministicColor } from '~/lib/colors';

type EdgeMode = 'both' | 'forward' | 'backward' | 'none';

interface CaseGraphData {
    deselected_object_types?: string[];
    deselected_event_types?: string[];
    deselected_arcs?: { source_type: string; target_type: string }[];
}

interface GraphPageProps {
    fileId: string;
    caseNotionGraph?: CaseGraphData | null;
    editable?: boolean;
    onGenericPayloadChange?: (payload: any) => void;
}

const nextEdgeMode = (mode: EdgeMode): EdgeMode => {
    switch (mode) {
        case 'both':
            return 'forward';
        case 'forward':
            return 'backward';
        case 'backward':
            return 'none';
        default:
            return 'both';
    }
};

const GraphPage: React.FC<GraphPageProps> = ({ fileId, caseNotionGraph, editable = false, onGenericPayloadChange }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);

    const { getColorForObject } = useExploreFlowStore();
    const { data, isLoading, error } = useGetLogGraphs(fileId);

    const [localGraph, setLocalGraph] = useState<any | null>(null);
    const [startingObjects, setStartingObjects] = useState<string[]>([]);

    useEffect(() => {
        if (!editable || !localGraph) return;

        const start_types = startingObjects.map((id) => ({
            name: id,
            attributes: [],
        }));

        const e2o_relations: any[] = [];
        const o2o_relations: any[] = [];

        localGraph.links.forEach((l: any) => {
            if (l.edgeMode === 'none') return;

            const s = { name: l.source.id ?? l.source, attributes: [] };
            const t = { name: l.target.id ?? l.target, attributes: [] };

            if (l.edgeMode === 'both') e2o_relations.push([s, t], [t, s]);
            if (l.edgeMode === 'forward') e2o_relations.push([s, t]);
            if (l.edgeMode === 'backward') e2o_relations.push([t, s]);
        });

        onGenericPayloadChange?.({ start_types, e2o_relations, o2o_relations });
    }, [localGraph, startingObjects, editable]);

    useEffect(() => {
        if (!data) return;
        if (editable && localGraph) return;
        console.log('API data1:', data.arcs);
        const nodes: any[] = [];
        data.event_types.forEach((et: string) =>
            nodes.push({
                id: et,
                group: 'event',
                deselected: caseNotionGraph?.deselected_event_types?.includes(et) ?? false,
            })
        );

        

        data.object_types.forEach((ot: string) =>
            nodes.push({
                id: ot,
                group: 'object',
                deselected: caseNotionGraph?.deselected_object_types?.includes(ot) ?? false,
            })
        );

        const deselectedLinks: any[] = [];
        const selectedLinks: any[] = [];
        const hasCaseNotionData =
            caseNotionGraph &&
            Array.isArray(caseNotionGraph.deselected_arcs) &&
            caseNotionGraph.deselected_arcs.length > 0;

        if (hasCaseNotionData) {
            data.arcs.forEach((a: any) => {
                const isDeselected =
                    caseNotionGraph?.deselected_arcs?.some(
                        (da) => da.source_type === a.source_type && da.target_type === a.target_type
                    ) ?? false;

                const edgeMode: EdgeMode = isDeselected ? 'none' : editable ? 'both' : 'forward';
                const link = {
                    source: a.source_type,
                    target: a.target_type,
                    edgeMode,
                    originalEdgeMode: edgeMode,
                    deselected: isDeselected,
                };

                if (isDeselected) {
                    deselectedLinks.push(link);
                } else {
                    selectedLinks.push(link);
                }
            });
        } else {
            data.arcs.forEach((a: any) => {
                const isDeselected =
                    caseNotionGraph?.deselected_arcs?.some(
                        (da) => da.source_type === a.source_type && da.target_type === a.target_type
                    ) ?? false;

                const edgeMode: EdgeMode = isDeselected ? 'none' : 'both';

                const link = {
                    source: a.source_type,
                    target: a.target_type,
                    edgeMode,
                    originalEdgeMode: edgeMode,
                    deselected: isDeselected,
                };

                if (isDeselected) {
                    deselectedLinks.push(link);
                } else {
                    selectedLinks.push(link);
                }
            });
        }
        const links = [...deselectedLinks, ...selectedLinks];
        setLocalGraph({ nodes, links });
    }, [data, caseNotionGraph, editable]);

    useEffect(() => {
        if (!localGraph || !svgRef.current || !containerRef.current) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        const g = svg.attr('viewBox', `0 0 ${width} ${height}`).append('g');

        svg.call(
            d3.zoom<SVGSVGElement, unknown>().on('zoom', (event) => {
                g.attr('transform', event.transform);
            })
        );

        const simulation = d3
            .forceSimulation(localGraph.nodes)
            .force(
                'link',
                d3
                    .forceLink(localGraph.links)
                    .id((d: any) => d.id)
                    .distance(160)
            )
            .force('charge', d3.forceManyBody().strength(-350))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(45));

        const link = g
            .append('g')
            .selectAll('line')
            .data(localGraph.links)
            .enter()
            .append('line')
            .attr('stroke-width', 3)
            .on('click', (_, d: any) => {
                if (!editable) return;
                console.log('di local graph');
                console.log(localGraph.links);
                d.edgeMode = nextEdgeMode(d.edgeMode);
                d.deselected = d.edgeMode === 'none';

                updatedLinkStyles();
            });

        const updatedLinkStyles = () => {
            link.attr('stroke', (d: any) => (d.edgeMode === 'none' ? '#C0C0C0' : 'black'))
                .attr('stroke-opacity', (d: any) => (d.edgeMode === 'none' ? 0.85 : 0.85))
                .attr('marker-end', (d: any) => (d.edgeMode === 'forward' ? 'url(#arrow)' : null))
                .attr('marker-start', (d: any) => (d.edgeMode === 'backward' ? 'url(#arrow)' : null));
        };

        updatedLinkStyles();
        const defs = svg.append('defs');

        defs.append('marker')
            .attr('id', 'arrow')
            .attr('viewBox', '0 -3 6 6')
            .attr('refX', 22)
            .attr('refY', 0)
            .attr('markerWidth', 4)
            .attr('markerHeight', 4)
            .attr('orient', 'auto-start-reverse')
            .append('path')
            .attr('d', 'M0,-3L6,0L0,3')
            .attr('fill', 'black');

        const getFill = (d: any) =>
            d.deselected ? '#C0C0C0' : d.group === 'object' ? getColorForObject(fileId, d.id) : 'white';

        const getStroke = (d: any) => (d.deselected ? '#333' : d.group === 'event' ? 'black' : '#fff');

        const getStrokeWidth = (d: any) => (d.group === 'event' ? 2.5 : 1.5);

        const updateConnectedLinks = (node: any) => {
            localGraph.links.forEach((l: any) => {
                const connected = l.source.id === node.id || l.target.id === node.id;
                if (!connected) return;

                if (node.deselected) {
                    l.edgeMode = 'none';
                    l.deselected = true;
                } else {
                    l.edgeMode = l.originalEdgeMode;
                    l.deselected = l.edgeMode === 'none';
                }
            });
            updatedLinkStyles();
        };

        const node = g
            .append('g')
            .selectAll('circle')
            .data(localGraph.nodes)
            .enter()
            .append('circle')
            .attr('r', 12)
            .attr('fill', (d: any) =>
                d.deselected ? '#C0C0C0' : d.group === 'object' ? getColorForObject(fileId, d.id) : 'white'
            )
            .attr('stroke', 'black')
            .attr('stroke-width', 2)
            .call(
                d3
                    .drag<SVGCircleElement, any>()
                    .on('start', (event, d) => {
                        if (!event.active) simulation.alphaTarget(0.3).restart();
                        d.fx = d.x;
                        d.fy = d.y;
                    })
                    .on('drag', (event, d) => {
                        d.fx = event.x;
                        d.fy = event.y;
                    })
                    .on('end', (event, d) => {
                        if (!event.active) simulation.alphaTarget(0);
                        d.fx = null;
                        d.fy = null;
                    })
            )
            .on('click', function (event, d: any) {
                if (!editable) return;

                const self = d3.select(this);

                if (d.group === 'object' && event.shiftKey) {
                    const isStarting = startingObjects.includes(d.id);
                    setStartingObjects((prev) => (isStarting ? prev.filter((x) => x !== d.id) : [...prev, d.id]));

                    self.attr('stroke', isStarting ? getStroke(d) : 'black').attr(
                        'stroke-width',
                        isStarting ? getStrokeWidth(d) : 6
                    );
                } else {
                    d.deselected = !d.deselected;
                    self.attr('fill', getFill(d)).attr('stroke-opacity', d.deselected ? 0.35 : 1);
                    updateConnectedLinks(d);
                }
            });

        const label = g
            .append('g')
            .selectAll('text')
            .data(localGraph.nodes)
            .enter()
            .append('text')
            .text((d: any) => d.id)
            .attr('font-size', 10)
            .attr('dy', -18)
            .attr('text-anchor', 'middle');

        simulation.on('tick', () => {
            link.attr('x1', (d: any) => d.source.x)
                .attr('y1', (d: any) => d.source.y)
                .attr('x2', (d: any) => d.target.x)
                .attr('y2', (d: any) => d.target.y);

            node.attr('cx', (d: any) => d.x).attr('cy', (d: any) => d.y);
            label.attr('x', (d: any) => d.x).attr('y', (d: any) => d.y);
        });
    }, [localGraph, editable, startingObjects, fileId, getColorForObject]);

    if (isLoading) return <div className="flex w-full h-full justify-center items-center">Loading graph...</div>;

    if (error)
        return <div className="flex w-full h-full justify-center items-center text-red-500">Failed to load graph</div>;

    return (
        <div className="w-full h-full p-2">
            {editable && (
                <div className="mt-2 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground/90">Starting Object Types:</span>
                        {startingObjects.length > 0 ? (
                            <div className="flex gap-1">
                                {startingObjects.map((obj) => (
                                    <span
                                        key={obj}
                                        className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs text-foreground"
                                    >
                                        <LegendRect size={8} fill={getDeterministicColor(obj)} />
                                        {obj}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <span className="italic text-muted-foreground/50">None selected</span>
                        )}
                    </div>

                    <div className="flex items-center gap-4 border-t border-border/50 pt-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <MousePointer className="h-3 w-3" />
                            <span>Select/Deselect</span>
                        </div>
                        <div className="h-3 w-[1px] bg-border" />
                        <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1">
                                <kbd className="pointer-events-none inline-flex h-5 select-none items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                                    Shift
                                </kbd>
                                +
                                <MousePointer className="h-3 w-3" />
                            </span>
                            <span>Mark as start object</span>
                        </div>
                    </div>
                </div>
            )}

            <div ref={containerRef} className="w-full h-full">
                <svg ref={svgRef} className="w-full h-full" />
            </div>
        </div>
    );
};

export default GraphPage;
