import { memo, useEffect, useMemo, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Position } from '@xyflow/react';
import CaseNotionDialog from '~/components/case_notion/ui/CaseNotionDialog';
import BaseMinerNode from '~/components/explore/miner/BaseMinerNode';
import { useGetOcpt } from '~/services/queries';
import type {
    BaseExploreNodeAsset,
    BaseExploreNodeDropdownActionType,
    BaseExploreNodeDropdownOption,
    TMinerNode,
} from '~/types/explore';

const CaseNotionMinerNode = memo<NodeProps<TMinerNode>>((node) => {
    const [fileId, setFileId] = useState<null | string>(null);
    const [fileName, setFileName] = useState<string>('');

    const hasMinedAsset = useMemo(() => {
        return node.data.assets.some((asset) => asset.io === 'output' && asset.origin === 'mined');
    }, [node.data.assets]);

    useMemo(() => {
        const inputAsset = node.data.assets.find((asset) => asset.io === 'input');
        if (!inputAsset) return;

        setFileId(inputAsset.id);
        setFileName(inputAsset.name);
    }, [node]);

    const dropdownOptions: BaseExploreNodeDropdownOption[] = [
        { label: 'Change Source', action: 'changeSourceFile' as const },
    ];

    const caseNotionCustomContent = (
        <div className="flex flex-col gap-2 p-2">
            <CaseNotionDialog fileId={fileId} fileName={fileName} />
        </div>
    );

    return (
        <BaseMinerNode
            {...node}
            title="CN Miner"
            iconName="treePine"
            handleOptions={[
                { position: Position.Left, type: 'target' as const },
                { position: Position.Right, type: 'source' as const },
            ]}
            dropdownOptions={dropdownOptions}
            isLoading={false}
            customContent={caseNotionCustomContent}
        />
    );
});

export default CaseNotionMinerNode;
