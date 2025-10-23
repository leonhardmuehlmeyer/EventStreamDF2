import { Plus } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { ASSET_TYPE_VISUALS } from '~/lib/assetIconMap';
import type { ExtendedFile } from '~/types/fileObject.types';

interface FileShowcaseProps {
    file: ExtendedFile;
    onFileSelect: (file: ExtendedFile) => void;
}

const FileShowcase: React.FC<FileShowcaseProps> = ({ file, onFileSelect }) => {
    const useFile = () => {
        onFileSelect(file);
    };

    const formatBytes = (bytes: number, decimals = 2) => {
        if (!+bytes) return '0 Bytes';

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const visual = ASSET_TYPE_VISUALS[file.fileType];
    const Icon = visual.icon;

    return (
        <div className="flex items-center w-full px-4 py-3">
            <div className="mr-3 h-6 w-6 flex-shrink-0">
                <Icon className={`h-6 w-6 ${visual.color}`} />
            </div>
            <div className="flex-grow overflow-hidden">
                <p className="truncate font-semibold" title={file.name}>
                    {file.name}
                </p>
                <p className="text-sm text-muted-foreground">
                    {formatBytes(file.size)} - Modified {formatDate(file.lastModified)}
                </p>
            </div>
            <div className="ml-4 flex-shrink-0">
                <Button onClick={useFile} variant="outline" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Select
                </Button>
            </div>
        </div>
    );
};

export default FileShowcase;
