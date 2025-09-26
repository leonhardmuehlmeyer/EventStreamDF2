import { useEffect, useState } from 'react';
import { Background, Controls, Edge, MiniMap, Node, ReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useSearchParams } from 'react-router-dom';
import { useGetOcel } from '~/services/queries';

const MAX_CHUNK = 500;

const OcelVisualization = () => {
    const [params] = useSearchParams();
    const fileId = params.get('fileId');
    const { data, isLoading, error } = useGetOcel(fileId || '');

    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [chunk, setChunk] = useState(1);

    useEffect(() => {
        if (!data) return;
        console.log('Fetched OCEL data:', data);

        const events = data.events || [];
        const objects = data.objects || [];

        const chunkedEvents = events.slice(0, chunk * MAX_CHUNK);

        const eventNodes: Node[] = chunkedEvents.map((evt: any, i: number) => ({
            id: evt.id?.toString(),
            data: { label: evt.type || evt.activity || 'Event' },
            position: { x: (i % 10) * 200, y: Math.floor(i / 10) * 100 },
            style: { background: '#f59e0b', color: '#fff', padding: 6, borderRadius: 5, fontSize: 12 },
        }));

        const objectIds = new Set<string>();
        chunkedEvents.forEach((evt: any) => {
            (evt.relationships || []).forEach((rel: any) => objectIds.add(rel.objectId));
        });

        const objectNodes: Node[] = Array.from(objectIds).map((objId, i) => ({
            id: objId.toString(),
            data: { label: objects[objId]?.type || objId },
            position: { x: (i % 10) * 200, y: 600 + Math.floor(i / 10) * 100 },
            style: { background: '#3b82f6', color: '#fff', padding: 6, borderRadius: 5, fontSize: 12 },
        }));

        const newEdges: Edge[] = chunkedEvents.flatMap((evt: any) =>
            (evt.relationships || []).map((rel: any, i: number) => ({
                id: `${evt.id}-${rel.objectId}-${i}`,
                source: evt.id?.toString(),
                target: rel.objectId?.toString(),
                label: rel.qualifier || '',
                style: { stroke: '#999' },
                labelStyle: { fill: '#333', fontSize: 10 },
            }))
        );

        setNodes([...eventNodes, ...objectNodes]);
        setEdges(newEdges);
    }, [data, chunk]);

    if (!fileId) return <p>No File selected</p>;
    if (isLoading) return <p>Loading...</p>;
    if (error) return <p>Error loading OCEL data</p>;
    if (!data) return <p>No data available</p>;

    const loadMore = () => {
        setChunk((prev) => prev + 1);
    };

    return (
        <div style={{ width: '100%', height: '90vh' }}>
            <h1 className="font-bold text-xl mb-4">OCEL Visualization</h1>
            <ReactFlow nodes={nodes} edges={edges} fitView onlyRenderVisibleElements>
                <MiniMap />
                <Controls />
                <Background />
            </ReactFlow>

            <div className="flex justify-center mt-4">
                {chunk * MAX_CHUNK < data.events.length && (
                    <button onClick={loadMore} className="px-4 py-2 bg-blue-500 text-white rounded">
                        Load More Events ({chunk * MAX_CHUNK}/{data.events.length})
                    </button>
                )}
            </div>
        </div>
    );
};

export default OcelVisualization;
