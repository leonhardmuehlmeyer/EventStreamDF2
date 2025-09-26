import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import BaseMinerNode from '~/components/explore/miner/BaseMinerNode';
import { useGetOcpt } from '~/services/queries';
import type { BaseExploreNodeAsset, TMinerNode } from '~/types/explore';
import { Position } from '@xyflow/react';

const OcptMinerNode = memo<NodeProps<TMinerNode>>((node) => {
    const [fileId, setFileId] = useState<null | string>(null);
    const [fileName, setFileName] = useState<string>('');
    const { isLoading, data } = useGetOcpt(fileId);

    useMemo(() => {
        const inputAsset = node.data.assets.find((asset) => asset.io === 'input');
        if (!inputAsset) return;

        setFileId(inputAsset.id);
        setFileName(inputAsset.name);
    }, [node]);

    useEffect(() => {
        const outputAssets = node.data.assets.filter((asset) => asset.io === 'output');
        if (!data || !fileName || outputAssets.length > 1) return;

        const asset: BaseExploreNodeAsset = {
            id: data.file_id,
            io: 'output',
            origin: 'mined',
            type: 'ocptAsset',
            name: `ocpt_${fileName}`,
        };

        const updatedAssets = [...node.data.assets, asset];
        node.data.onDataChange(node.id, { assets: updatedAssets });
    }, [data, fileName]);

    return (
        <BaseMinerNode
            {...node}
            title="OCPT Miner"
            iconName="treePine"
            handleOptions={[
                { position: Position.Left, type: 'target' as const },
                { position: Position.Right, type: 'source' as const },
            ]}
            dropdownOptions={[{ label: 'Change Source', action: 'changeSourceFile' as const }]}
            isLoading={isLoading}
        />
    );
});

export default OcptMinerNode;
