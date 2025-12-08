/*
 * This is the version with colored text names in the filter dropdowns.
 */
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { useExploreFlowStore } from '~/stores/exploreStore';
import { useGetOcel } from '~/services/queries';
import { OcelVisualizationD3Props } from './types';
import { useGraphInteractions } from './useGraphInteractions';

const MAX_CHUNK = 5;
const OcelVisualization: React.FC<OcelVisualizationD3Props> = ({ fileId, isFullScreen = false }) => {
    const { data, isLoading, error } = useGetOcel(fileId);
    // --- Access Global Color Store ---
    const { getColorForObject } = useExploreFlowStore();
    const svgRef = useRef<SVGSVGElement | null>(null);
    const eventsChartRef = useRef<SVGSVGElement | null>(null);
    const objectsChartRef = useRef<SVGSVGElement | null>(null);
    const [chunk, setChunk] = useState(1);
    const [selectedType, setSelectedType] = useState<string>('__ALL__');
    const { collapsedNodes, contextMenu, setContextMenu, handleCollapse, handleExpand, handleTypeChange, updateFlag } =
        useGraphInteractions(fileId, data, selectedType, setSelectedType, chunk, setChunk, svgRef);
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
        const createHistogram = (ref: SVGSVGElement, dataArr: [string, number][]) => {
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
                .attr('fill', ([key]) => getColorForObject(fileId, key))
                .on('mouseover', (event, [, v]) => tooltip.style('opacity', 1).html(`<strong>Count:</strong> ${v}`))
                .on('mousemove', (event) =>
                    tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 20 + 'px')
                )
                .on('mouseout', () => tooltip.style('opacity', 0));
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
        if (!isFullScreen) {
            if (eventsChartRef.current) createHistogram(eventsChartRef.current, activityCounts);
            if (objectsChartRef.current) createHistogram(objectsChartRef.current, typeCounts);
        }
        return () => tooltip.remove();
    }, [data, isFullScreen, fileId, getColorForObject]);
    const eventTypes: string[] = Array.isArray(data?.eventTypes)
        ? data!.eventTypes.map((t: any) => (typeof t === 'string' ? t : t.name))
        : [];
    if (!fileId) return <p>No File selected</p>;
    if (isLoading) return <p>Loading...</p>;
    if (error) return <p>Error loading OCEL data</p>;
    if (!data) return <p>No data available</p>;
    const gridLayoutClass = isFullScreen ? 'grid-cols-1' : 'grid-cols-4';
    return (
        <div className="flex flex-col w-full h-full overflow-hidden">
            {contextMenu && (
                <div
                    className="absolute bg-white border border-gray-300 shadow-lg rounded-md text-sm z-50"
                    style={{ left: contextMenu.x + 20, top: contextMenu.y }}
                >
                    <button
                        className="block w-full text-left px-3 py-1 hover:bg-gray-100"
                        onClick={() => handleCollapse(contextMenu.node.id)}
                    >
                        Collapse
                    </button>
                    <button
                        className="block w-full text-left px-3 py-1 hover:bg-gray-100"
                        onClick={() => handleExpand(contextMenu.node.id)}
                    >
                        Expand
                    </button>
                </div>
            )}
            <div className="border-b border-gray-200 p-4 bg-white shadow-sm flex flex-wrap gap-3 items-center">
                <h2 className="font-bold text-gray-700 mr-2">Filter by Event Type:</h2>
                {/* --- CHANGED: Replaced native select with Shadcn Select + Colors --- */}
                <Select value={selectedType} onValueChange={(val) => handleTypeChange(val)}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Filter by Event Type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__ALL__">All types</SelectItem>
                        {eventTypes.map((t) => (
                            <SelectItem key={t} value={t}>
                                {/* Apply color directly to text */}
                                <span style={{ color: getColorForObject(fileId, t), fontWeight: 'bold' }}>{t}</span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {/* --------------------------------------------------------------- */}
            </div>
            <div className={`grid ${gridLayoutClass} gap-4 p-4 flex-1 overflow-auto`}>
                <div
                    className={`bg-white rounded-xl shadow p-3 relative flex flex-col ${isFullScreen ? 'col-span-4' : 'col-span-3'}`}
                >
                    <h3 className="font-semibold mb-2 text-center text-gray-700">Event–Object Relationship Graph</h3>
                    <svg ref={svgRef} className="w-full flex-1 min-h-0 border rounded-lg bg-gray-50" />
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
                {!isFullScreen && (
                    <div className="col-span-1 flex flex-col gap-4">
                        <div className="bg-white rounded-xl shadow p-3 flex-1 flex flex-col">
                            <h3 className="font-semibold mb-2 text-center text-gray-700">Events per Activity</h3>
                            <svg ref={eventsChartRef} className="w-full h-auto flex-1" />
                        </div>
                        <div className="bg-white rounded-xl shadow p-3 flex-1 flex flex-col">
                            <h3 className="font-semibold mb-2 text-center text-gray-700">Objects per Type</h3>
                            <svg ref={objectsChartRef} className="w-full h-auto flex-1" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
export default OcelVisualization;

// /*
//  * This is the version with a colored dot being shown next to the name in the filter dropdowns.
//  */
// import { useEffect, useRef, useState } from 'react';
// import * as d3 from 'd3';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
// import { useExploreFlowStore } from '~/stores/exploreStore';
// import { useGetOcel } from '~/services/queries';
// import { OcelVisualizationD3Props } from './types';
// import { useGraphInteractions } from './useGraphInteractions';

// const MAX_CHUNK = 5;

// const OcelVisualization: React.FC<OcelVisualizationD3Props> = ({ fileId, isFullScreen = false }) => {
//     const { data, isLoading, error } = useGetOcel(fileId);

//     // Access global color store
//     const { getColorForObject } = useExploreFlowStore();

//     const svgRef = useRef<SVGSVGElement | null>(null);
//     const eventsChartRef = useRef<SVGSVGElement | null>(null);
//     const objectsChartRef = useRef<SVGSVGElement | null>(null);

//     const [chunk, setChunk] = useState(1);
//     const [selectedType, setSelectedType] = useState<string>('__ALL__');

//     // Pass fileId to the interaction hook for color consistency in the graph
//     const { collapsedNodes, contextMenu, setContextMenu, handleCollapse, handleExpand, handleTypeChange, updateFlag } =
//         useGraphInteractions(fileId, data, selectedType, setSelectedType, chunk, setChunk, svgRef);

//     useEffect(() => {
//         if (!data) return;
//         const tooltip = d3
//             .select('body')
//             .append('div')
//             .attr('class', 'd3-tooltip')
//             .style('position', 'absolute')
//             .style('background', 'rgba(0,0,0,0.7)')
//             .style('color', 'white')
//             .style('padding', '6px 10px')
//             .style('border-radius', '6px')
//             .style('font-size', '12px')
//             .style('pointer-events', 'none')
//             .style('opacity', 0);

//         const createHistogram = (ref: SVGSVGElement, dataArr: [string, number][]) => {
//             const svg = d3.select(ref);
//             svg.selectAll('*').remove();

//             const width = svg.node()?.clientWidth || 250;
//             const height = svg.node()?.clientHeight || 200;

//             const margin = { top: 20, right: 20, bottom: 50, left: 40 };
//             const x = d3
//                 .scaleBand()
//                 .domain(dataArr.map(([k]) => k))
//                 .range([margin.left, width - margin.right])
//                 .padding(0.2);
//             const y = d3
//                 .scaleLinear()
//                 .domain([0, d3.max(dataArr, ([, v]) => v)!])
//                 .nice()
//                 .range([height - margin.bottom, margin.top]);

//             svg.append('g')
//                 .selectAll('rect')
//                 .data(dataArr)
//                 .enter()
//                 .append('rect')
//                 .attr('x', ([k]) => x(k)!)
//                 .attr('y', ([, v]) => y(v))
//                 .attr('width', x.bandwidth())
//                 .attr('height', ([, v]) => y(0) - y(v))
//                 // Use global color scheme for bars
//                 .attr('fill', ([key]) => getColorForObject(fileId, key))
//                 .on('mouseover', (event, [, v]) => tooltip.style('opacity', 1).html(`<strong>Count:</strong> ${v}`))
//                 .on('mousemove', (event) =>
//                     tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 20 + 'px')
//                 )
//                 .on('mouseout', () => tooltip.style('opacity', 0));

//             svg.append('g')
//                 .attr('transform', `translate(0,${height - margin.bottom})`)
//                 .call(d3.axisBottom(x))
//                 .selectAll('text')
//                 .attr('transform', 'rotate(-35)')
//                 .style('text-anchor', 'end')
//                 .attr('font-size', 9);

//             svg.append('g').attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y));
//         };

//         const activityCounts = d3.rollups(
//             data.events || [],
//             (v) => v.length,
//             (d) => d.type || d.activity || 'Unknown'
//         );
//         const typeCounts = d3.rollups(
//             Object.values(data.objects || {}),
//             (v: any) => v.length,
//             (d: any) => d.type || 'Unknown'
//         );

//         if (!isFullScreen) {
//             if (eventsChartRef.current) createHistogram(eventsChartRef.current, activityCounts);
//             if (objectsChartRef.current) createHistogram(objectsChartRef.current, typeCounts);
//         }

//         return () => tooltip.remove();
//     }, [data, isFullScreen, fileId, getColorForObject]);

//     const eventTypes: string[] = Array.isArray(data?.eventTypes)
//         ? data!.eventTypes.map((t: any) => (typeof t === 'string' ? t : t.name))
//         : [];

//     if (!fileId) return <p>No File selected</p>;
//     if (isLoading) return <p>Loading...</p>;
//     if (error) return <p>Error loading OCEL data</p>;
//     if (!data) return <p>No data available</p>;

//     const gridLayoutClass = isFullScreen ? 'grid-cols-1' : 'grid-cols-4';

//     return (
//         <div className="flex flex-col w-full h-full overflow-hidden">
//             {contextMenu && (
//                 <div
//                     className="absolute bg-white border border-gray-300 shadow-lg rounded-md text-sm z-50"
//                     style={{ left: contextMenu.x + 20, top: contextMenu.y }}
//                 >
//                     <button
//                         className="block w-full text-left px-3 py-1 hover:bg-gray-100"
//                         onClick={() => handleCollapse(contextMenu.node.id)}
//                     >
//                         Collapse
//                     </button>
//                     <button
//                         className="block w-full text-left px-3 py-1 hover:bg-gray-100"
//                         onClick={() => handleExpand(contextMenu.node.id)}
//                     >
//                         Expand
//                     </button>
//                 </div>
//             )}

//             <div className="border-b border-gray-200 p-4 bg-white shadow-sm flex flex-wrap gap-3 items-center">
//                 <h2 className="font-bold text-gray-700 mr-2">Filter by Event Type:</h2>

//                 <Select value={selectedType} onValueChange={(val) => handleTypeChange(val)}>
//                     <SelectTrigger className="w-[200px]">
//                         <SelectValue placeholder="Filter by Event Type" />
//                     </SelectTrigger>
//                     <SelectContent>
//                         <SelectItem value="__ALL__">All types</SelectItem>
//                         {eventTypes.map((t) => (
//                             <SelectItem key={t} value={t}>
//                                 {/* Circle color indicator logic */}
//                                 <div className="flex items-center gap-2">
//                                     <div
//                                         className="w-3 h-3 rounded-full flex-shrink-0"
//                                         style={{ backgroundColor: getColorForObject(fileId, t) }}
//                                     />
//                                     <span style={{ fontWeight: 'bold' }}>{t}</span>
//                                 </div>
//                             </SelectItem>
//                         ))}
//                     </SelectContent>
//                 </Select>
//             </div>

//             <div className={`grid ${gridLayoutClass} gap-4 p-4 flex-1 overflow-auto`}>
//                 <div
//                     className={`bg-white rounded-xl shadow p-3 relative flex flex-col ${isFullScreen ? 'col-span-4' : 'col-span-3'}`}
//                 >
//                     <h3 className="font-semibold mb-2 text-center text-gray-700">Event–Object Relationship Graph</h3>
//                     <svg ref={svgRef} className="w-full flex-1 min-h-0 border rounded-lg bg-gray-50" />

//                     {chunk * MAX_CHUNK < (data.events?.length || 0) && (
//                         <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
//                             <button
//                                 onClick={() => setChunk((prev) => prev + 1)}
//                                 className="px-4 py-2 bg-blue-500 text-white rounded shadow hover:bg-blue-600"
//                             >
//                                 Load More Events ({chunk * MAX_CHUNK}/{data.events.length})
//                             </button>
//                         </div>
//                     )}
//                 </div>

//                 {!isFullScreen && (
//                     <div className="col-span-1 flex flex-col gap-4">
//                         <div className="bg-white rounded-xl shadow p-3 flex-1 flex flex-col">
//                             <h3 className="font-semibold mb-2 text-center text-gray-700">Events per Activity</h3>
//                             <svg ref={eventsChartRef} className="w-full h-auto flex-1" />
//                         </div>
//                         <div className="bg-white rounded-xl shadow p-3 flex-1 flex flex-col">
//                             <h3 className="font-semibold mb-2 text-center text-gray-700">Objects per Type</h3>
//                             <svg ref={objectsChartRef} className="w-full h-auto flex-1" />
//                         </div>
//                     </div>
//                 )}
//             </div>
//         </div>
//     );
// };

// export default OcelVisualization;
