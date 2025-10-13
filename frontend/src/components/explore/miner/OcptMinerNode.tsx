import { memo, useEffect, useMemo, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Position } from '@xyflow/react';
import BaseMinerNode from '~/components/explore/miner/BaseMinerNode';
import { useGetOcpt } from '~/services/queries';
import type {
    BaseExploreNodeAsset,
    BaseExploreNodeDropdownActionType,
    BaseExploreNodeDropdownOption,
    TMinerNode,
} from '~/types/explore';

const OcptMinerNode = memo<NodeProps<TMinerNode>>((node) => {
    const [fileId, setFileId] = useState<null | string>(null);
    const [fileName, setFileName] = useState<string>('');

    const hasMinedAsset = useMemo(() => {
        return node.data.assets.some((asset) => asset.io === 'output' && asset.origin === 'mined');
    }, [node.data.assets]);

    const { isLoading, data } = useGetOcpt(fileId, !hasMinedAsset);

    useMemo(() => {
        const inputAsset = node.data.assets.find((asset) => asset.io === 'input');
        if (!inputAsset) return;

        setFileId(inputAsset.id);
        setFileName(inputAsset.name);
    }, [node]);

    useEffect(() => {
        const outputAssets = node.data.assets.filter((asset) => asset.io === 'output');
        if (!data || !fileName || outputAssets.length > 0) return;

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

    const handleExportJson = () => {
        if (!data) {
            console.warn('OCPT data not available for export.');
            return;
        }

        const jsonContent = JSON.stringify(data.ocpt, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ocpt_${fileName || 'export'}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleDropdownAction = (action: BaseExploreNodeDropdownActionType) => {
        if (action === 'exportJson') {
            handleExportJson();
        }
    };

    const dropdownOptions: BaseExploreNodeDropdownOption[] = [
        { label: 'Change Source', action: 'changeSourceFile' as const },
    ];

    if (hasMinedAsset && data) {
        dropdownOptions.push({ label: 'Export JSON', action: 'exportJson' as const });
    }

    return (
        <BaseMinerNode
            {...node}
            title="OCPT Miner"
            iconName="treePine"
            handleOptions={[
                { position: Position.Left, type: 'target' as const },
                { position: Position.Right, type: 'source' as const },
            ]}
            dropdownOptions={dropdownOptions}
            onDropdownAction={handleDropdownAction}
            isLoading={isLoading}
        />
    );
});

export default OcptMinerNode;
