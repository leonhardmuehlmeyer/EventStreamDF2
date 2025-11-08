import { memo, useEffect, useMemo, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Position } from '@xyflow/react';
import { Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '~/components/ui/button';
import BaseFileNode from '~/components/explore/file/BaseFileNode';
import { useExploreFlowStore } from '~/stores/exploreStore';
import { useGetOcel } from '~/services/queries';
import { FileNode } from '~/types/explore/nodes';

const ObjectEventGraphNode = memo<NodeProps<FileNode>>((props) => {
    const [fileId, setFileId] = useState<null | string>(null);
    const { data } = useGetOcel(fileId);
    const navigate = useNavigate();
    const { updateNodeData } = useExploreFlowStore();
    const { id, data: nodeData } = props;
    const { assets } = nodeData;

    useMemo(() => {
        if (assets.length === 1) {
            setFileId(assets[0].id);
        } else {
            setFileId(null);
        }
    }, [assets]);

    useEffect(() => {
        if (data) {
            updateNodeData(id, { processedData: data });
        }
    }, [data, id, updateNodeData]);

    const visualize = () => {
        navigate(`/data/pipeline/explore/ocel/${id}`);
    };

    const renderVisualizationActions = () => {
        if (assets.length === 1) {
            return (
                <div className="flex items-center">
                    <Button
                        onClick={visualize}
                        className="flex items-center h-6 px-2 bg-gray-100 text-gray-800 hover:bg-gray-200 rounded-md"
                    >
                        <Eye className="h-3 w-3 text-blue-600 mr-1" />
                        <span className="text-xs text-blue-600">View</span>
                    </Button>
                </div>
            );
        }
        return null;
    };

    return (
        <BaseFileNode
            {...props}
            title="Object Event-Graph"
            iconName="network"
            handleOptions={[{ position: Position.Right, type: 'source' as const }]}
            dropdownOptions={[{ label: 'Change Source', action: 'changeSourceFile' as const }]}
            customActions={renderVisualizationActions()}
        />
    );
});

export default ObjectEventGraphNode;
