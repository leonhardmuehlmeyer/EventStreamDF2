import { useCallback } from 'react';
import { type Connection } from '@xyflow/react';
import { useExploreFlowStore } from '~/stores/exploreStore';
import { ExploreNodeType } from '~/types/explore/nodeTypesCategories';
import { NodeFactory } from '~/model/explore/node-factory.model';
import { useConnections } from './useConnections';

export const useSpawnNode = () => {
    const { nodes, addNode } = useExploreFlowStore();
    const { handleConnect } = useConnections();

    const spawnDownstreamNode = useCallback(
        (sourceNodeId: string, nodeType: ExploreNodeType) => {
            const sourceNode = nodes.find((n) => n.id === sourceNodeId);
            if (!sourceNode) return;

            const newNodePosition = {
                x: sourceNode.position.x + 400,
                y: sourceNode.position.y,
            };

            const newNode = NodeFactory.createNode(newNodePosition, nodeType);
            addNode(newNode);

            const connection: Connection = {
                source: sourceNode.id,
                target: newNode.id,
                sourceHandle: null,
                targetHandle: null,
            };
            handleConnect(connection);
        },
        [nodes, addNode, handleConnect]
    );

    return { spawnDownstreamNode };
};
