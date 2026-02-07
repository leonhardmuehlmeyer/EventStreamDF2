import { Connection, Edge } from '@xyflow/react';
import { ExploreNode } from '~/types/explore/nodes';

/**
 * Prevents direct file-to-file connections, unless the target is a conformance handle.
 * The conformance handle on the OcptFileNode is a special case that accepts
 * an OCEL file node as input for conformance checking.
 */
export const isTwoFileNodes = (connection: Connection | Edge, sourceNode: ExploreNode, targetNode: ExploreNode) => {
    if (connection.targetHandle === 'conformanceTarget') return false;

    const sourceCategory = sourceNode.data.nodeCategory;
    const targetCategory = targetNode.data.nodeCategory;

    return sourceCategory === 'file' && targetCategory === 'file';
};

/**
 * Ensures that only OCEL or OCPT file nodes can connect to the conformance target handle.
 * The conformance handle is used by the OcptFileNode to receive either OCEL data
 * (OCPT-vs-OCEL conformance) or another OCPT (OCPT-vs-OCPT conformance).
 */
export const isInvalidConformanceTarget = (connection: Connection | Edge, sourceNode: ExploreNode): boolean => {
    if (connection.targetHandle !== 'conformanceTarget') return false;
    return sourceNode.data.nodeType !== 'ocelFileNode' && sourceNode.data.nodeType !== 'ocptFileNode';
};

/**
 * Validates whether a connection between two nodes is allowed.
 * Passed to the ReactFlow component.
 */
export const validateConnection = (connection: Connection | Edge, nodes: ExploreNode[]): boolean => {
    const sourceNode = nodes.find((n) => n.id === connection.source);
    const targetNode = nodes.find((n) => n.id === connection.target);

    if (!sourceNode || !targetNode) return false;

    if (isTwoFileNodes(connection, sourceNode, targetNode)) return false;
    if (isInvalidConformanceTarget(connection, sourceNode)) return false;

    return true;
};
