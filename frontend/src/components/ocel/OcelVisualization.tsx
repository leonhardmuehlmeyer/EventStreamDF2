import { useCallback, useEffect, useState } from 'react';
import {
    Background,
    Controls,
    type Edge,
    MiniMap,
    type Node,
    ReactFlow,
    useEdgesState,
    useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { useSearchParams } from 'react-router-dom';
import { getOcel, saveFilteredOcel } from '~/services/api';

const nodeWidth = 180;
const nodeHeight = 60;
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
    dagreGraph.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80 });

    nodes.forEach((n) => dagreGraph.setNode(n.id, { width: nodeWidth, height: nodeHeight }));
    edges.forEach((e) => dagreGraph.setEdge(e.source, e.target));
    dagre.layout(dagreGraph);

    return nodes.map((n) => {
        const pos = dagreGraph.node(n.id);
        return {
            ...n,
            position: {
                x: pos.x - nodeWidth / 2,
                y: pos.y - nodeHeight / 2,
            },
        };
    });
}

const OcelVisualization = () => {
    const [searchParams] = useSearchParams();
    const fileId = searchParams.get('fileId');

    const [loading, setLoading] = useState(true);
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [selectedElements, setSelectedElements] = useState<{ nodes: string[]; edges: string[] }>({
        nodes: [],
        edges: [],
    });

    useEffect(() => {
        if (!fileId) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const data = await getOcel(fileId);

                const eventNodes: Node[] = data.events.map((evt: any) => ({
                    id: evt.id,
                    data: { label: `${evt.type}\n(${evt.time})` },
                    position: { x: 0, y: 0 },
                    style: {
                        background: '#f59e0b',
                        color: '#fff',
                        padding: 8,
                        borderRadius: 5,
                        fontSize: 12,
                        textAlign: 'center',
                    },
                }));

                const objectIds = new Set<string>();
                data.events.forEach((evt: any) => {
                    evt.relationships.forEach((rel: any) => objectIds.add(rel.objectId));
                });

                const objectNodes: Node[] = Array.from(objectIds).map((objId) => ({
                    id: objId,
                    data: { label: objId },
                    position: { x: 0, y: 0 },
                    style: {
                        background: '#3b82f6',
                        color: '#fff',
                        padding: 8,
                        borderRadius: 5,
                        fontSize: 12,
                        textAlign: 'center',
                    },
                }));

                const rawEdges: Edge[] = data.events.flatMap((evt: any, idx: number) =>
                    evt.relationships.map((rel: any) => ({
                        id: `e-${evt.id}-${rel.objectId}-${idx}`,
                        source: evt.id,
                        target: rel.objectId,
                        label: rel.qualifier,
                        animated: false,
                        style: { stroke: '#888' },
                        labelStyle: { fill: '#555', fontSize: 10 },
                    }))
                );

                const layoutedNodes = getLayoutedElements([...eventNodes, ...objectNodes], rawEdges);

                setNodes(layoutedNodes);
                setEdges(rawEdges);
            } catch (err) {
                console.error('Error fetching OCEL:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [fileId, setNodes, setEdges]);

    const handleDelete = useCallback(() => {
        if (selectedElements.nodes.length > 0) {
            setNodes((nds) => nds.filter((n) => !selectedElements.nodes.includes(n.id)));
            setEdges((eds) =>
                eds.filter(
                    (e) => !selectedElements.nodes.includes(e.source) && !selectedElements.nodes.includes(e.target)
                )
            );
        }
        if (selectedElements.edges.length > 0) {
            setEdges((eds) => eds.filter((e) => !selectedElements.edges.includes(e.id)));
        }
        setSelectedElements({ nodes: [], edges: [] });
    }, [selectedElements, setNodes, setEdges]);

    const handleSave = async () => {
        if (!fileId) return;
        try {
            const payload = {
                fileId,
                nodes,
                edges,
            };
            await saveFilteredOcel(payload);
            alert('Filtered graph saved successfully');
        } catch (err) {
            console.error('Error saving filtered graph:', err);
            alert('Failed to save filtered graph');
        }
    };

    if (!fileId) return <p>No File selected</p>;
    if (loading) return <p>Loading graph...</p>;

    return (
        <div style={{ width: '100%', height: '90vh' }}>
            <div className="flex gap-4 mb-2">
                {/* <button onClick={handleDelete} className="px-4 py-2 bg-red-500 text-white rounded">
                    🗑 Delete Selected
                </button>
                <button onClick={handleSave} className="px-4 py-2 bg-green-500 text-white rounded">
                    💾 Save Filtered Graph
                </button> */}
            </div>

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onSelectionChange={(sel) =>
                    setSelectedElements({
                        nodes: sel.nodes?.map((n) => n.id) || [],
                        edges: sel.edges?.map((e) => e.id) || [],
                    })
                }
                fitView
            >
                <MiniMap />
                <Controls />
                <Background />
            </ReactFlow>
        </div>
    );
};

export default OcelVisualization;
