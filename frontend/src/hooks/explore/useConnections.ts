import { type MouseEvent as ReactMouseEvent, useCallback } from 'react';
import { type Connection, type Edge, type IsValidConnection } from '@xyflow/react';
import { useExploreFlowStore } from '~/stores/exploreStore';
import { validateConnection } from '~/lib/explore/connectionGuards';
import { isFileNode } from '~/lib/explore/exploreNodes.utils';
import { BaseExploreNodeAsset } from '~/types/explore/nodeData/baseNodeData';

export const useConnections = () => {
    const { nodes, removeEdge } = useExploreFlowStore();

    const onEdgeDelete = useCallback(
        (event: ReactMouseEvent, edge: Edge) => {
            event.stopPropagation();
            removeEdge(edge.id);
        },
        [removeEdge]
    );

    /**
     * The hook that is used by ReactFlow to check if a connection is valid.
     */
    const isValidConnection: IsValidConnection = useCallback(
        (connection: Edge | Connection) => {
            return validateConnection(connection, nodes);
        },
        [nodes]
    );

    /**
     * Handles the conneciton of two nodes.
     * The validity will be checked automatically by ReactFlow.
     */
    const handleConnect = useCallback((connection: Connection) => {
        const { source, target } = connection;
        const { updateNodeData, onConnect, getNode } = useExploreFlowStore.getState();

        const sourceNode = getNode(source);
        const targetNode = getNode(target);

        // Add Edge
        onConnect(connection);

        // Propagate Assets
        if (sourceNode && targetNode) {
            const propagatedAssets: BaseExploreNodeAsset[] = (sourceNode.data.assets || [])
                .filter((asset) => asset.io === 'output')
                .flatMap((asset) => {
                    // If the target is a File Node, it acts as a pass-through/source.
                    // We strictly set it as an OUTPUT asset so it can be chained immediately.
                    if (isFileNode(targetNode)) {
                        return [{ ...asset, io: 'output' } as BaseExploreNodeAsset];
                    }

                    // For other nodes (miners), it comes in as input
                    return [{ ...asset, io: 'input' } as BaseExploreNodeAsset];
                });

            if (propagatedAssets.length > 0) {
                updateNodeData(target, (prev) => {
                    const existingAssets = prev.assets || [];
                    const uniqueNewAssets = propagatedAssets.filter(
                        (newAsset) =>
                            !existingAssets.some(
                                (existing) => existing.id === newAsset.id && existing.io === newAsset.io
                            )
                    );
                    return { assets: [...existingAssets, ...uniqueNewAssets] };
                });
            }
        }
    }, []);

    return {
        onEdgeDelete,
        isValidConnection,
        handleConnect,
    };
};
